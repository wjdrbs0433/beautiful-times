import test from 'node:test';
import assert from 'node:assert/strict';
import { mapConfig, readMapMessage } from '../src/components/KakaoMap.types.ts';
test('지도 메시지는 좌표와 장소 형식을 검증한다',()=>{
 const place={id:'1',name:'카페',address:'서울',roadAddress:'서울 도로',lat:37.5,lng:127,url:'https://place.map.kakao.com/1'};
 const message=readMapMessage(JSON.stringify({type:'results',requestId:'stop1',query:'카페',places:[place,{...place,id:'bad',lat:999}]}));
 assert.equal(message.places.length,1);assert.equal(message.places[0].name,'카페');
 assert.equal(readMapMessage('{broken'),null);assert.equal(readMapMessage({type:'results',places:[]}),null);
});
test('지도에는 방문 순서와 위치만 전달하고 메모는 전달하지 않는다',()=>{
 const stops=[{id:'a',name:'카페',time:'12:00',note:'개인 메모',mode:'walk',lat:37,lng:127},{id:'b',name:'공원',time:'13:00',note:'',mode:'walk',lat:38,lng:128}];
 const config=mapConfig({apiKey:'public-key',stops,query:'공원',requestId:'b'});
 assert.deepEqual(config.stops.map(s=>s.id),['a','b']);assert.equal('note' in config.stops[0],false);assert.equal('apiKey' in config,false);
});
test('지도 인증·연결 오류도 화면에 전달한다',()=>assert.deepEqual(readMapMessage({type:'error',message:'도메인 확인'}),{type:'error',message:'도메인 확인'}));

test('지도 구간에는 현재 경로의 예상 시간만 표시한다',()=>{
 const stops=[{id:'a',name:'출발',mode:'walk',lat:37,lng:127},{id:'b',name:'도착',mode:'car',lat:38,lng:128}];
 const routeKey=JSON.stringify([37,127,38,128,'walk']);
 const props={apiKey:'public',stops,travelTimes:{a:{status:'ready',seconds:1081,routeKey,error:'개인 오류'}}};
 assert.equal(mapConfig(props).segments[0].label,'1 → 2 · 걷기 약 19분');
 assert.equal(JSON.stringify(mapConfig(props)).includes('개인 오류'),false);
 stops[0].mode='car';
 assert.equal(mapConfig(props).segments[0].label,'1 → 2 · 자동차 조회 중…');
 props.travelTimes.a={status:'error',routeKey:JSON.stringify([37,127,38,128,'car'])};
 assert.equal(mapConfig(props).segments[0].label,'1 → 2 · 자동차 시간 확인 필요');
});
