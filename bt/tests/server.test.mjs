import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('공개 설정에 REST 비밀 키가 없고 외부 Origin과 잘못된 CSRF를 차단한다',async()=>{
 const port=22000+Math.floor(Math.random()*10000);
 const rest='a'.repeat(32), js='b'.repeat(32);
 const child=spawn(process.execPath,['scripts/routes-server.mjs'],{env:{...process.env,BT_ROUTE_PORT:String(port),KAKAO_REST_API_KEY:rest,KAKAO_JS_KEY:js},stdio:['ignore','pipe','pipe']});
 const exited=once(child,'exit');
 try {
  await Promise.race([once(child.stdout,'data'),exited.then(()=>{throw Error('server stopped');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);timer.unref();})]);
  const base=`http://127.0.0.1:${port}`;
  const response=await fetch(base+'/public-config');const config=await response.json();assert.deepEqual(config,{kakaoJsKey:js});assert.ok(!JSON.stringify(config).includes(rest));
  assert.equal((await fetch(base+'/public-config',{headers:{Origin:'https://example.org'}})).status,403);
  assert.equal((await fetch(base+'/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'csrf=bad&key='+rest})).status,400);
  const setup=await fetch(base+'/setup');assert.match(setup.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 } finally { if(child.exitCode===null&&child.signalCode===null)child.kill(); await exited; }
});
