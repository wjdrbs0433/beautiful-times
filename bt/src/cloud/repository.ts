import type {SupabaseClient} from '@supabase/supabase-js';
import type {MemoryState,Space} from '../model';
import {getAuthClient} from '../auth/client';
import {assertOwnPath,emptyDocument,readDocument,referencedFiles,type CloudDocument} from './document';
import {canReuseMedia,localMedia,readMedia} from './media';
export type MediaCache={sources:Record<string,string>;files:Record<string,{uri:string;expires:number}>};
export type SyncMeta={base:CloudDocument|null;cache:MediaCache;lastSyncedAt?:string;pendingCovers?:string[]};
export const newMeta=():SyncMeta=>({base:null,cache:{sources:{},files:{}}});
export type CloudRow={payload:CloudDocument;revision:number;updated_at:string};
const BUCKET='bt-private-photos';
async function fingerprint(uri:string){const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uri));return [...new Uint8Array(result)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function accountClient(userId:string){const {client}=await getAuthClient();const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==userId)throw Error('다시 로그인한 뒤 동기화해 주세요.');return client;}
export async function fetchAccount(client:SupabaseClient,userId:string):Promise<CloudRow>{
  const {data,error}=await client.from('bt_account_data').select('payload,revision,updated_at').eq('user_id',userId).maybeSingle();
  if(error)throw Error('계정 기록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 동기화해 주세요.');
  return data?{...data,payload:readDocument(data.payload)}:{payload:emptyDocument(),revision:0,updated_at:''};
}
export async function writeAccount(client:SupabaseClient,revision:number,payload:CloudDocument):Promise<CloudRow>{
  const {data,error}=await client.rpc('bt_save_account_data',{p_expected_revision:revision,p_payload:payload});
  if(error){if(error.code==='40001')throw Object.assign(Error('다른 기기의 변경을 다시 확인하고 있어요.'),{retryRevision:true});throw Error('서버 저장을 완료하지 못했어요. 기록은 이 기기에 보관 중입니다.');}
  const row=data?.[0];if(!row)throw Error('서버 저장 결과를 확인하지 못했어요.');return {...row,payload:readDocument(row.payload)};
}
export async function prepareDocument(state:MemoryState,userId:string,client:SupabaseClient,cache:MediaCache,remote?:CloudDocument,baseline?:CloudDocument|null):Promise<CloudDocument>{
  const used=remote&&referencedFiles(remote);
  const previous=baseline&&referencedFiles(baseline);
  async function upload(uri:string,kind:string,existing?:string){
    if(existing){assertOwnPath(existing,userId);return existing;}
    const source=await fingerprint(uri),cached=cache.sources[source];if(cached){
      assertOwnPath(cached,userId);
      // An unchanged old-device cover may already have been removed by a newer
      // remote edit. Preserve its baseline identity so merge can adopt that edit.
      if(!used||used.has(cached)||previous?.has(cached))return cached;
      const {error}=await client.storage.from(BUCKET).info(cached);
      if(!error)return cached;
      if(Number((error as {statusCode?:string}).statusCode)!==404&& !/not found|does not exist/i.test(error.message))throw Error('이전 사진의 보관 상태를 확인하지 못했어요. 다시 동기화해 주세요.');
      delete cache.sources[source];delete cache.files[cached];
    }
    const {bytes,mime}=await readMedia(uri);const extension=({'image/png':'png','image/webp':'webp','image/gif':'gif','image/heic':'heic','image/heif':'heif','image/avif':'avif'} as Record<string,string>)[mime]||'jpg';
    // A deleted object key must never be reused while Storage finishes removal.
    const path=`${userId}/${kind}/${source}${kind==='covers'?'-'+crypto.randomUUID():''}.${extension}`;
    const {error}=await client.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false});
    if(error&&Number((error as {statusCode?:string}).statusCode)!==409&&!/already exists|duplicate/i.test(error.message))throw Error('사진을 서버에 보관하지 못했어요. 인터넷 연결과 저장 용량을 확인해 주세요.');
    cache.sources[source]=path;return path;
  }
  const covers:CloudDocument['covers']={};for(const space of ['couple','family'] as const){const uri=state.covers?.[space];if(uri)covers[space]=await upload(uri,'covers');}
  const photos:CloudDocument['photos']=[];
  for(const photo of state.photos){const {uri,storagePath:existing,...details}=photo;photos.push({...details,storagePath:await upload(uri,'photos',existing)});}
  return {version:1,anniversaries:{...state.anniversaries},covers,plans:state.plans,photos,entries:state.entries};
}
export async function cleanupCovers(client:SupabaseClient,userId:string,meta:SyncMeta,document:CloudDocument){
  const used=referencedFiles(document),remaining:string[]=[];
  for(const path of meta.pendingCovers??[]){
    assertOwnPath(path,userId);
    if(!path.startsWith(`${userId}/covers/`)||used.has(path))continue;
    try{
      // The server policy locks the account and rechecks all live references.
      const {data,error}=await client.storage.from(BUCKET).remove([path]);
      if(error)throw error;
      if(!data?.some(item=>item.name===path)){
        const result=await client.storage.from(BUCKET).info(path);
        if(!result.error||Number((result.error as {statusCode?:string}).statusCode)!==404&&!/not found|does not exist/i.test(result.error.message))throw Error('배경 파일 정리 대기');
      }
      for(const [source,value] of Object.entries(meta.cache.sources))if(value===path)delete meta.cache.sources[source];
      delete meta.cache.files[path];
    }catch{remaining.push(path);}
  }
  meta.pendingCovers=remaining;
  return remaining.length===0;
}
export async function hydrateDocument(doc:CloudDocument,local:MemoryState,userId:string,client:SupabaseClient,cache:MediaCache):Promise<MemoryState>{
  async function download(path:string,preferred?:string){
    assertOwnPath(path,userId);
    if(preferred&&cache.sources[await fingerprint(preferred)]===path&&await canReuseMedia(preferred))return preferred;
    const hit=cache.files[path];if(hit&&hit.expires>Date.now()+300000&&(hit.uri.startsWith('https:')||await canReuseMedia(hit.uri)))return hit.uri;
    const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,3600);if(error||!data?.signedUrl)throw Error('서버 사진을 불러오지 못했어요. 잠시 후 다시 동기화해 주세요.');
    const uri=await localMedia(path,data.signedUrl,userId);cache.files[path]={uri,expires:Date.now()+3600000};cache.sources[await fingerprint(uri)]=path;return uri;
  }
  const covers:Partial<Record<Space,string>>={};for(const space of ['couple','family'] as const){const path=doc.covers[space];if(path)covers[space]=await download(path,local.covers?.[space]);}
  const photos:MemoryState['photos']=[];for(const photo of doc.photos){const old=local.photos.find(p=>p.id===photo.id);photos.push({...photo,uri:await download(photo.storagePath,old?.uri)});}
  return {...local,version:1,anniversaries:doc.anniversaries,covers,plans:doc.plans,photos,entries:doc.entries};
}
