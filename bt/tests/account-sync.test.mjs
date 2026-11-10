import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDocument,mergeDocuments,SyncConflict,assertOwnPath,readDocument} from '../src/cloud/document.ts';
const photo=(id,path='user/photos/a.jpg')=>({id,space:'couple',storagePath:path,date:'2026-11-09',title:id});
test('빈 기기의 첫 로그인은 기존 서버 사진과 디데이를 지우지 않는다',()=>{
 const remote={...emptyDocument(),photos:[photo('a')],covers:{couple:'user/covers/a.jpg'},anniversaries:{couple:'2023-08-15'}};
 assert.deepEqual(mergeDocuments(null,emptyDocument(),remote),remote);
});
test('첫 동기화는 기기와 서버 기록을 합치고 같은 ID의 서버 기록을 보존한다',()=>{
 const remote={...emptyDocument(),photos:[photo('same'),photo('remote')]};
 const local={...emptyDocument(),photos:[photo('same','user/photos/old.jpg'),photo('local')]};
 const merged=mergeDocuments(null,local,remote);
 assert.deepEqual(merged.photos.map(p=>p.id),['same','remote','local']);assert.equal(merged.photos[0].storagePath,'user/photos/a.jpg');
});
test('다른 기록에 대한 두 기기의 변경을 모두 반영한다',()=>{
 const base={...emptyDocument(),photos:[photo('a'),photo('b')]};
 const local=structuredClone(base),remote=structuredClone(base);local.photos[0].title='local';remote.photos[1].title='remote';
 assert.deepEqual(mergeDocuments(base,local,remote).photos.map(p=>p.title),['local','remote']);
});
test('동기화했던 기록의 삭제를 반영한다',()=>{
 const base={...emptyDocument(),photos:[photo('a')]};
 assert.deepEqual(mergeDocuments(base,emptyDocument(),base).photos,[]);
 assert.deepEqual(mergeDocuments(base,base,emptyDocument()).photos,[]);
});
test('같은 기록 충돌은 덮어쓰지 않고 선택한 변경만 적용한다',()=>{
 const base={...emptyDocument(),photos:[photo('a')]};
 const local=structuredClone(base),remote=structuredClone(base);local.photos[0].title='local';remote.photos[0].title='remote';remote.photos.push(photo('b'));
 assert.throws(()=>mergeDocuments(base,local,remote),SyncConflict);
 const result=mergeDocuments(base,local,remote,'local');assert.equal(result.photos[0].title,'local');assert.equal(result.photos[1].id,'b');
});
test('다른 계정 또는 상위 폴더 사진 경로를 거절한다',()=>{
 assert.doesNotThrow(()=>assertOwnPath('user/photos/a.jpg','user'));
 for(const path of ['other/photos/a.jpg','user/../other/a.jpg','https://example.com/a.jpg'])assert.throws(()=>assertOwnPath(path,'user'));
});
test('서버 문서의 중복 ID와 사진 경로 누락을 거절한다',()=>{
 assert.throws(()=>readDocument({...emptyDocument(),photos:[photo('a'),photo('a')]}));
 assert.throws(()=>readDocument({...emptyDocument(),photos:[{id:'a',space:'couple',uri:'file:///a.jpg'}]}));
});
