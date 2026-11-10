import {accountStorageKey} from './auth/callback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {initialState,type MemoryState} from './model';
import {mergeDocuments,same,SyncConflict,type CloudDocument} from './cloud/document';
import {accountClient,cleanupCovers,fetchAccount,hydrateDocument,newMeta,prepareDocument,writeAccount,type SyncMeta} from './cloud/repository';
import {pendingCoverCleanup} from './cloud/coverCleanup';
export type SyncStatus={phase:'idle'|'syncing'|'synced'|'offline'|'conflict';message:string;lastSyncedAt?:string};
type Runtime={version:number;again:boolean;pull:boolean;running?:Promise<void>;state?:MemoryState;meta?:SyncMeta;status:SyncStatus;listeners:Set<(status:SyncStatus,state?:MemoryState)=>void>};
const accounts=new Map<string,Runtime>();
let writes:Promise<void>=Promise.resolve();
function runtime(userId:string){accountStorageKey(userId);let r=accounts.get(userId);if(!r){r={version:0,again:false,pull:false,status:{phase:'idle',message:'동기화 준비 중'},listeners:new Set()};accounts.set(userId,r);}return r;}
function enqueue<T>(task:()=>Promise<T>):Promise<T>{const next=writes.then(task);writes=next.then(()=>{},()=>{});return next;}
const metaKey=(id:string)=>accountStorageKey(id)+'.cloud.v1';
const backupKey=(id:string)=>accountStorageKey(id)+'.before-cloud.v1';
function emit(r:Runtime,status:SyncStatus,state?:MemoryState){r.status=status;for(const listener of r.listeners)listener(status,state);}
export function cloudStatus(userId:string){return runtime(userId).status;}
export function subscribeCloud(userId:string,listener:(status:SyncStatus,state?:MemoryState)=>void){const r=runtime(userId);r.listeners.add(listener);listener(r.status);return()=>{r.listeners.delete(listener);};}
async function readLocal(userId:string):Promise<MemoryState>{
 const raw=await AsyncStorage.getItem(accountStorageKey(userId));if(!raw)return {...initialState};
 const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.plans)||!Array.isArray(d.photos)||!Array.isArray(d.entries))throw Error('저장 형식 오류');return {...d,anniversaries:d.anniversaries??{}};
}
async function metadata(userId:string,r:Runtime){
 if(r.meta)return r.meta;
 const raw=await AsyncStorage.getItem(metaKey(userId));r.meta=raw?JSON.parse(raw):newMeta();
 if(!r.meta?.cache?.sources||!r.meta.cache.files)throw Error('동기화 보관 정보를 확인하지 못했어요.');return r.meta;
}
async function synchronize(userId:string,local:MemoryState,r:Runtime,preference?:'local'|'remote'){
 const client=await accountClient(userId),meta=await metadata(userId,r);
 if(await AsyncStorage.getItem(backupKey(userId))===null)await AsyncStorage.setItem(backupKey(userId),JSON.stringify(local));
 let remote=await fetchAccount(client,userId);
 const prepared=await prepareDocument(local,userId,client,meta.cache,remote.payload,meta.base);
 let merged:CloudDocument=prepared;
 for(let attempt=0;attempt<4;attempt++){
  merged=mergeDocuments(meta.base,prepared,remote.payload,preference);
  meta.pendingCovers=pendingCoverCleanup([...(meta.pendingCovers??[]),...Object.values(meta.cache.sources)], [meta.base,remote.payload],merged,userId);
  // Persist before the DB commit: a crash after saving the new cover must not
  // forget which old object needs deletion. No deletion occurs before success.
  await AsyncStorage.setItem(metaKey(userId),JSON.stringify(meta));
  if(same(merged,remote.payload))break;
  try{remote=await writeAccount(client,remote.revision,merged);break;}
  catch(error){if((error as {retryRevision?:boolean}).retryRevision&&attempt<3){remote=await fetchAccount(client,userId);continue;}throw error;}
 }
 // Acknowledging the local snapshot (not unseen remote additions) prevents a
 // later local edit from treating unseen records as deliberate deletions.
 meta.base=prepared;meta.lastSyncedAt=new Date().toISOString();
 await AsyncStorage.setItem(metaKey(userId),JSON.stringify(meta));
 const state=await hydrateDocument(merged,local,userId,client,meta.cache);
 await cleanupCovers(client,userId,meta,merged);
 await AsyncStorage.setItem(metaKey(userId),JSON.stringify(meta));
 return {state,merged,prepared,meta};
}
function stored(r:Runtime):SyncStatus{return {phase:'synced',message:r.meta?.pendingCovers?.length?'서버에 보관됨 · 이전 배경 정리 재시도 중':'서버에 보관됨',lastSyncedAt:r.meta?.lastSyncedAt};}
async function applyPulled(userId:string,r:Runtime,version:number,result:Awaited<ReturnType<typeof synchronize>>){
 await enqueue(async()=>{
  if(r.version!==version)return;
  await AsyncStorage.setItem(accountStorageKey(userId),JSON.stringify(result.state));
  if(r.version!==version)return;
  result.meta.base=result.merged;
  await AsyncStorage.setItem(metaKey(userId),JSON.stringify(result.meta));
  if(r.version!==version){result.meta.base=result.prepared;await AsyncStorage.setItem(metaKey(userId),JSON.stringify(result.meta));return;}
  r.state=result.state;emit(r,stored(r),result.state);
 });
}
export async function loadState(userId:string):Promise<MemoryState>{
 const r=runtime(userId);await writes.catch(()=>{});const local=await readLocal(userId);r.state=local;
 emit(r,{phase:'syncing',message:'계정 기록 불러오는 중…'});
 try{
  const result=await synchronize(userId,local,r);
  result.meta.base=result.merged;await AsyncStorage.setItem(metaKey(userId),JSON.stringify(result.meta));
  await AsyncStorage.setItem(accountStorageKey(userId),JSON.stringify(result.state));r.state=result.state;
  emit(r,stored(r));return result.state;
 }catch(error){failure(r,error);return local;}
}
function failure(r:Runtime,error:unknown){emit(r,{phase:error instanceof SyncConflict?'conflict':'offline',message:error instanceof Error?error.message:'동기화를 완료하지 못했어요. 기록은 이 기기에 보관 중입니다.',lastSyncedAt:r.meta?.lastSyncedAt});}
function requestSync(userId:string,pull=false,preference?:'local'|'remote'){
 const r=runtime(userId);r.again=true;r.pull ||= pull;
 if(r.running)return r.running;
 r.running=(async()=>{
  while(r.again){
   r.again=false;const wantsPull=r.pull;r.pull=false;
   await writes.catch(()=>{});const version=r.version,local=r.state??await readLocal(userId);
   emit(r,{phase:'syncing',message:'사진과 기록 동기화 중…',lastSyncedAt:r.meta?.lastSyncedAt});
   try{
    const result=await synchronize(userId,local,r,preference);preference=undefined;
    if(wantsPull&&r.version===version)await applyPulled(userId,r,version,result);
    else emit(r,stored(r));
   }catch(error){
    if(r.version!==version){r.again=true;continue;}
    failure(r,error);break;
   }
  }
 })().finally(()=>{r.running=undefined;if(r.again)void requestSync(userId,r.pull);});return r.running;
}
export function saveState(state:MemoryState,userId:string):Promise<void>{
 const r=runtime(userId);r.version++;
 return enqueue(async()=>{await AsyncStorage.setItem(accountStorageKey(userId),JSON.stringify(state));r.state=state;}).then(()=>{void requestSync(userId);});
}
export async function syncNow(userId:string,preference?:'local'|'remote'){
 const r=runtime(userId);if(r.running)await r.running;
 if(preference){const state=r.state??await readLocal(userId);await AsyncStorage.setItem(accountStorageKey(userId)+'.conflict-backup.v1',JSON.stringify(state));}
 await requestSync(userId,true,preference);
}
