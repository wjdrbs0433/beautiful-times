import test from 'node:test';
import assert from 'node:assert/strict';
import { validRouteInput, providerRequest, normalizeRoute } from '../scripts/route-provider.mjs';
const points={from:{lat:37.5,lng:127},to:{lat:37.51,lng:127.02}};
test('네 이동수단의 공식 API 주소와 좌표 순서를 사용한다',()=>{
 for(const [mode,path] of Object.entries({walk:'/v2/routing/walk',bicycle:'/v2/routing/bicycle',transit:'/v2/routing/publictraffic',car:'/v1/directions'})){
  const input={...points,mode}; assert.ok(validRouteInput(input));const url=providerRequest(input);assert.equal(url.pathname,path);
  assert.equal(url.searchParams.get(mode==='car'?'origin':'start_x'),mode==='car'?'127,37.5':'127');
 }
 assert.equal(validRouteInput({...points,mode:'plane'}),false);
 assert.equal(validRouteInput({...points,mode:'walk',from:{lat:999,lng:127}}),false);
});
test('단위가 다른 네 응답을 초와 미터로 정규화한다',()=>{
 const car=normalizeRoute('car',{routes:[{result_code:101,summary:{duration:1,distance:1}},{result_code:0,summary:{duration:300,distance:1200}}]});assert.equal(car.seconds,300);
 const transit=normalizeRoute('transit',{routes:[{properties:{totalTime:400,totalDistance:1300}},{properties:{totalTime:200,totalDistance:1500}}]});assert.equal(transit.seconds,200);
 for(const mode of ['walk','bicycle'])assert.equal(normalizeRoute(mode,{route:{properties:{totalTime:600,totalDistance:1100}}}).meters,1100);
 assert.equal(normalizeRoute('walk',{}),null);
 assert.equal(normalizeRoute('car',{routes:[{result_code:0,summary:{duration:-1,distance:12}}]}),null);
});
