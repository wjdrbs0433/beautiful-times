import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as documents from '../src/cloud/document.ts';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function load(code,deps){const module={exports:{}};new Function('require','module','exports',code)(name=>{if(name in deps)return deps[name];throw Error(name);},module,module.exports);return module.exports;}
const cleanup=load(compile('../src/cloud/coverCleanup.ts'),{'./document':documents});
const {pendingCoverCleanup}=cleanup;
test('다른 배경이나 앨범에서 쓰는 사진은 남기고 이전 배경만 삭제 후보로 선택한다',()=>{
 const old={...documents.emptyDocument(),covers:{couple:'user/covers/a.jpg',family:'user/covers/b.jpg'}};
 const next={...documents.emptyDocument(),covers:{couple:'user/covers/c.jpg',family:'user/covers/b.jpg'},photos:[{id:'p',space:'couple',storagePath:'user/covers/a.jpg'}]};
 assert.deepEqual(pendingCoverCleanup(['user/covers/failed.jpg','user/photos/album.jpg'],[old],next,'user'),['user/covers/failed.jpg']);
 assert.deepEqual(pendingCoverCleanup([], [old],documents.emptyDocument(),'user'),['user/covers/a.jpg','user/covers/b.jpg']);
 assert.throws(()=>pendingCoverCleanup(['other/covers/a.jpg'],[],next,'user'));
});
test('새 배경 DB 저장에 실패하면 이전 파일을 삭제하지 않고 성공 후에만 정리한다',async()=>{
 const oldPath='user/covers/old.jpg',newPath='user/covers/new.jpg';
 let remote={...documents.emptyDocument(),covers:{couple:oldPath}},revision=1,failSave=false,removed=[];
 const local=new Map();
 const initial={version:1,onboarded:true,anniversaries:{},covers:{},plans:[],photos:[],entries:[]};
 const storage=load(compile('../src/storage.ts'),{
  './auth/callback':{accountStorageKey:id=>'account.'+id},
  '@react-native-async-storage/async-storage':{getItem:async key=>local.get(key)??null,setItem:async(key,value)=>{local.set(key,value);}},
  './model':{initialState:initial},'./cloud/document':documents,'./cloud/coverCleanup':cleanup,
  './cloud/repository':{
   newMeta:()=>({base:null,cache:{sources:{},files:{}}}),accountClient:async()=>({}),
   fetchAccount:async()=>({payload:remote,revision}),
   prepareDocument:async state=>({version:1,anniversaries:state.anniversaries,covers:state.covers??{},photos:state.photos,plans:state.plans,entries:state.entries}),
   hydrateDocument:async(doc,state)=>({...state,...doc}),
   writeAccount:async(_,expected,payload)=>{assert.equal(expected,revision);if(failSave)throw Error('DB offline');remote=structuredClone(payload);revision++;return {payload:remote,revision};},
   cleanupCovers:async(_,__,meta)=>{for(const path of meta.pendingCovers??[]){assert.ok(!documents.referencedFiles(remote).has(path),'사용 중인 파일 삭제 금지');removed.push(path);}meta.pendingCovers=[];},
  },
 });
 const state=await storage.loadState('user');assert.equal(state.covers.couple,oldPath);
 failSave=true;await storage.saveState({...state,covers:{couple:newPath}},'user');await storage.syncNow('user');
 assert.deepEqual(removed,[]);assert.equal(remote.covers.couple,oldPath);assert.equal(JSON.parse(local.get('account.user')).covers.couple,newPath);
 failSave=false;await storage.syncNow('user');assert.equal(remote.covers.couple,newPath);assert.deepEqual(removed,[oldPath]);
 // Default background also clears the former file after its DB reference is gone.
 await storage.saveState({...state,covers:{}},'user');await storage.syncNow('user');assert.equal(remote.covers.couple,undefined);assert.deepEqual(removed,[oldPath,newPath]);
});
