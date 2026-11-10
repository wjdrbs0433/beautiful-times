import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as documents from '../src/cloud/document.ts';
const source=readFileSync(new URL('../src/cloud/repository.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const files=new Map();let uploads=0;
let failRemoval=false;
const module={exports:{}};
new Function('require','module','exports',compiled)(name=>{
 if(name==='./document')return documents;
 if(name==='../auth/client')return {};
 if(name==='./media')return {
  readMedia:async uri=>({bytes:new TextEncoder().encode(uri).buffer,mime:'image/jpeg'}),
  canReuseMedia:async()=>false,
  localMedia:async path=>{assert.ok(files.has(path));return 'file://downloaded/'+path;},
 };
 throw Error(name);
},module,module.exports);
const client={storage:{from:bucket=>{assert.equal(bucket,'bt-private-photos');return {
 upload:async(path,bytes,options)=>{assert.equal(options.upsert,false);files.set(path,bytes);uploads++;return {error:null};},
 createSignedUrl:async path=>({data:{signedUrl:'https://private.example/'+path},error:null}),
 info:async path=>files.has(path)?{data:{},error:null}:{data:null,error:{statusCode:'404',message:'not found'}},
 remove:async paths=>{
  if(failRemoval)return {data:null,error:Error('offline')};
  const data=paths.filter(path=>files.has(path)).map(name=>({name}));for(const path of paths)files.delete(path);return {data,error:null};
 },
};}}};
const {prepareDocument,hydrateDocument,newMeta,cleanupCovers}=module.exports;
test('사진 원본은 private Storage에 올리고 DB에는 파일 경로만 저장, 빈 다른 기기에서 복원한다',async()=>{
 const state={version:1,onboarded:true,anniversaries:{couple:'2023-08-15'},covers:{couple:'file://cover.jpg'},plans:[],photos:[{id:'photo1',space:'couple',uri:'file://album.jpg',caption:'사진',date:'2026-11-09',quality:'original',bytes:10}],entries:[],kakaoJsKey:'device-only-public-key'};
 const cache=newMeta().cache;
 const doc=await prepareDocument(state,'user',client,cache);
 assert.equal(uploads,2);assert.equal(doc.photos[0].uri,undefined);assert.equal(doc.kakaoJsKey,undefined);assert.equal(doc.onboarded,undefined);
 assert.match(doc.photos[0].storagePath,/^user\/photos\//);assert.match(doc.covers.couple,/^user\/covers\//);
 await prepareDocument(state,'user',client,cache);assert.equal(uploads,2,'같은 파일 재업로드 없음');
 const other=await hydrateDocument(doc,{version:1,onboarded:false,anniversaries:{},plans:[],photos:[],entries:[]},'user',client,newMeta().cache);
 assert.equal(other.photos[0].caption,'사진');assert.match(other.photos[0].uri,/^file:\/\/downloaded\/user\/photos\//);assert.ok(other.covers.couple);assert.equal(other.anniversaries.couple,'2023-08-15');
});
test('다른 계정 경로는 서명 URL 요청 전에 차단한다',async()=>{
 const doc={...documents.emptyDocument(),covers:{couple:'someone-else/private.jpg'}};
 await assert.rejects(()=>hydrateDocument(doc,{version:1,anniversaries:{},photos:[],plans:[],entries:[]},'user',client,newMeta().cache),/접근 경로/);
});
test('이전 배경 삭제 실패는 재시도하고 성공한 파일의 캐시만 정리한다',async()=>{
 const path='user/covers/obsolete.jpg',keep='user/covers/current.jpg';files.set(path,new ArrayBuffer(1));files.set(keep,new ArrayBuffer(1));
 const meta={...newMeta(),pendingCovers:[path,keep]};meta.cache.sources.old=path;meta.cache.sources.current=keep;
 const doc={...documents.emptyDocument(),covers:{couple:keep}};
 failRemoval=true;assert.equal(await cleanupCovers(client,'user',meta,doc),false);assert.deepEqual(meta.pendingCovers,[path]);assert.ok(files.has(path));
 failRemoval=false;assert.equal(await cleanupCovers(client,'user',meta,doc),true);assert.ok(!files.has(path));assert.ok(files.has(keep));assert.equal(meta.cache.sources.old,undefined);assert.equal(meta.cache.sources.current,keep);
});
test('이미 삭제된 배경을 다시 선택하면 과거 캐시를 버리고 새 파일 경로로 업로드한다',async()=>{
 const cache=newMeta().cache,state={version:1,anniversaries:{},covers:{couple:'file://choose-again.jpg'},photos:[],plans:[],entries:[]};
 const first=await prepareDocument(state,'user',client,cache);files.delete(first.covers.couple);
 const second=await prepareDocument(state,'user',client,cache,documents.emptyDocument());
 assert.notEqual(second.covers.couple,first.covers.couple);assert.ok(files.has(second.covers.couple));
});
test('다른 기기가 지운 배경은 재업로드하지 않고 원격 변경을 받아들인다',async()=>{
 const cache=newMeta().cache,state={version:1,anniversaries:{},covers:{couple:'file://stale-device.jpg'},photos:[],plans:[],entries:[]};
 const baseline=await prepareDocument(state,'user',client,cache);files.delete(baseline.covers.couple);const count=uploads;
 const remote=documents.emptyDocument();
 const prepared=await prepareDocument(state,'user',client,cache,remote,baseline);
 assert.equal(uploads,count);assert.deepEqual(documents.mergeDocuments(baseline,prepared,remote).covers,{});
});
