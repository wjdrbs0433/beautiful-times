import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {idleSessionStorage,AUTH_STORAGE_KEY,ACTIVITY_STORAGE_KEY,IDLE_TIMEOUT_MS} from '../src/auth/idleSession.ts';
const DAY=86400000;
function fixture(){
 let clock=Date.UTC(2026,10,9);const values=new Map();
 const base={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}};
 return {values,base,setClock:t=>{clock=t;},now:()=>clock,policy:idleSessionStorage(base,()=>clock)};
}
test('재실행 시 로그인 복원, 토큰 자동 갱신은 앱 사용 시각을 연장하지 않는다',async()=>{
 const f=fixture();const start=f.now();await f.policy.storage.setItem(AUTH_STORAGE_KEY,'saved-session');
 f.setClock(start+29*DAY);await f.policy.storage.setItem(AUTH_STORAGE_KEY,'refreshed-session');
 assert.equal(f.values.get(ACTIVITY_STORAGE_KEY),String(start));
 const reopened=idleSessionStorage(f.base,f.now);
 assert.equal(await reopened.storage.getItem(AUTH_STORAGE_KEY),'refreshed-session');
 await reopened.markActive();f.setClock(start+58*DAY);
 assert.equal(await reopened.storage.getItem(AUTH_STORAGE_KEY),'refreshed-session');
});
test('30일 경계부터 현재 기기의 인증만 만료하고 기록·PKCE 흐름은 보존한다',async()=>{
 const f=fixture();const start=f.now();await f.policy.storage.setItem(AUTH_STORAGE_KEY,'session');
 f.values.set('bt.account.v1.memories','photos-and-plans');f.values.set(AUTH_STORAGE_KEY+'-code-verifier','pending-login');
 f.setClock(start+IDLE_TIMEOUT_MS-1);assert.equal(await f.policy.storage.getItem(AUTH_STORAGE_KEY),'session');
 f.setClock(start+IDLE_TIMEOUT_MS);assert.equal(await f.policy.storage.getItem(AUTH_STORAGE_KEY),null);
 assert.equal(f.policy.takeExpired(),true);assert.equal(f.policy.takeExpired(),false);
 assert.equal(f.values.get('bt.account.v1.memories'),'photos-and-plans');assert.equal(f.values.get(AUTH_STORAGE_KEY+'-code-verifier'),'pending-login');
 await f.policy.storage.setItem(AUTH_STORAGE_KEY,'new-login');assert.equal(await f.policy.storage.getItem(AUTH_STORAGE_KEY),'new-login');
});
test('31일 테스트와 실제 재진입이 같은 경로를 사용하며 다른 기기는 유지된다',async()=>{
 const a=fixture(),b=fixture();await a.policy.storage.setItem(AUTH_STORAGE_KEY,'a');await b.policy.storage.setItem(AUTH_STORAGE_KEY,'b');
 await a.policy.simulate31DaysInactive();await a.policy.markActive();
 assert.equal(await a.policy.storage.getItem(AUTH_STORAGE_KEY),null);assert.equal(a.policy.takeExpired(),true);
 assert.equal(await b.policy.storage.getItem(AUTH_STORAGE_KEY),'b');
});
test('로그아웃으로 사용 시각도 지우며 기존 설치는 첫 정상 사용부터 계산한다',async()=>{
 const f=fixture();f.values.set(AUTH_STORAGE_KEY,'legacy');assert.equal(await f.policy.storage.getItem(AUTH_STORAGE_KEY),'legacy');
 await f.policy.markActive();assert.equal(f.values.get(ACTIVITY_STORAGE_KEY),String(f.now()));
 await f.policy.storage.removeItem(AUTH_STORAGE_KEY);assert.equal(f.values.has(ACTIVITY_STORAGE_KEY),false);
});
test('실제 Supabase SDK가 재시작 세션을 복원하고 만료 시 서버 갱신 전에 차단한다',async()=>{
 const f=fixture();const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',app_metadata:{provider:'kakao'},user_metadata:{},created_at:new Date().toISOString()};
 await f.policy.storage.setItem(AUTH_STORAGE_KEY,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
 let requests=0;
 const makeClient=()=>createClient('https://test.supabase.co','sb_publishable_test',{global:{fetch:async()=>{requests++;throw Error('unexpected network');}},auth:{storage:idleSessionStorage(f.base,f.now).storage,storageKey:AUTH_STORAGE_KEY,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
 const first=makeClient();assert.equal((await first.auth.getSession()).data.session.user.id,user.id);
 f.setClock(f.now()+31*DAY);
 const reopened=makeClient();assert.equal((await reopened.auth.getSession()).data.session,null);assert.equal(requests,0);
});
