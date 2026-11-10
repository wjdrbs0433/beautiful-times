import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { parseAuthCallback, accountStorageKey } from '../src/auth/callback.ts';
import { secureChunks } from '../src/auth/secureChunks.ts';
test('OAuth 반환 주소를 검증하며 PKCE code와 flow만 처리한다',()=>{
 assert.deepEqual(parseAuthCallback('bt://auth/callback?code=abc&sb_flow_id=12345678','bt://auth/callback'),{code:'abc',flowId:'12345678'});
 for(const value of ['bt://user@auth/callback?code=abc','https://attacker.example/?code=abc','bt://auth/other?code=abc','bt://auth/callback?access_token=token','bt://auth/callback?error=access_denied','bt://auth/callback?code=abc&sb_flow_id=bad'])assert.throws(()=>parseAuthCallback(value,'bt://auth/callback'));
});
test('계정별 기기 기록은 다른 저장 키로 분리하며 기존 기록을 덮어쓰지 않는다',()=>{
 const a=accountStorageKey('11111111-1111-4111-8111-111111111111');
 const b=accountStorageKey('22222222-2222-4222-8222-222222222222');
 assert.notEqual(a,b);assert.notEqual(a,'bt.local.v1');assert.throws(()=>accountStorageKey(''));
});
test('긴 로그인 토큰을 작은 암호화 저장 단위로 왕복하고 교체·삭제한다',async()=>{
 const values=new Map();let generation=0;
 const store=secureChunks({getItemAsync:async k=>values.get(k)??null,setItemAsync:async(k,v)=>{assert.ok(Buffer.byteLength(v)<=2048);values.set(k,v);},deleteItemAsync:async k=>{values.delete(k);}},()=>String(++generation));
 const text='비밀😀'.repeat(1500);await store.setItem('session',text);assert.equal(await store.getItem('session'),text);
 await store.setItem('session','new');assert.equal(await store.getItem('session'),'new');assert.equal(values.size,2);
 await store.removeItem('session');assert.equal(await store.getItem('session'),null);assert.equal(values.size,0);
});
test('토큰 교체 중 저장 오류가 나면 이전 세션을 보존한다',async()=>{
 const values=new Map();let fail=false;let generation=0;
 const store=secureChunks({getItemAsync:async k=>values.get(k)??null,setItemAsync:async(k,v)=>{if(fail&&k.endsWith('.1'))throw Error('full');values.set(k,v);},deleteItemAsync:async k=>{values.delete(k);}},()=>String(++generation));
 await store.setItem('session','original');fail=true;
 await assert.rejects(store.setItem('session','x'.repeat(1024)),/full/);
 assert.equal(await store.getItem('session'),'original');assert.equal(values.size,2);
});
test('카카오 OAuth 요청이 이메일 없는 범위를 명시하고 PKCE S256을 유지한다',async()=>{
 const { createClient } = await import('@supabase/supabase-js');
 const { kakaoLoginOptions } = await import('../src/auth/kakao.ts');
 const client=createClient('https://test.supabase.co','sb_publishable_test',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'}});
 const result=await client.auth.signInWithOAuth(kakaoLoginOptions('http://127.0.0.1:8082/'));
 assert.equal(result.error,null);
 const url=new URL(result.data.url);
 assert.equal(url.searchParams.get('provider'),'kakao');
 assert.equal(url.searchParams.get('scope'),'profile_nickname profile_image');
 assert.equal(url.searchParams.has('scopes'),false);
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 await client.auth.stopAutoRefresh();
});
