import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCloudConnection } from '../src/cloudConnection.ts';
const config={url:'https://test-project.supabase.co',key:'sb_publishable_test'};
test('빈 프로젝트의 인증 서버와 DB API 응답을 공개 키로 확인한다',async()=>{
 const calls=[];
 const result=await checkCloudConnection(config,async(url,options)=>{
  calls.push(url);assert.equal(options.headers.apikey,config.key);
  return url.endsWith('/settings') ? Response.json({external:{kakao:false}}) : Response.json({code:'PGRST205'},{status:404});
 });
 assert.equal(result.auth,true);assert.equal(result.database,true);assert.equal(result.kakaoEnabled,false);assert.equal(result.schemaProtected,true);
 assert.ok(calls.every(url=>url.startsWith(config.url+'/')));
});
test('비밀 키나 올바르지 않은 서버 주소는 요청 전에 거절한다',async()=>{
 const unexpected=()=>{throw Error('should not call network');};
 for(const next of [{...config,key:'sb_secret_hidden'},{...config,url:'http://test-project.supabase.co'},{...config,url:'https://supabase.co.attacker.example'}])await assert.rejects(checkCloudConnection(next,unexpected),/공개 연결 설정/);
});
test('인증 실패 또는 잘못된 응답을 성공으로 표시하지 않는다',async()=>{
 await assert.rejects(checkCloudConnection(config,async()=>Response.json({message:'denied'},{status:401})),/공개 키/);
 await assert.rejects(checkCloudConnection(config,async()=>Response.json({})),/응답 형식/);
});
