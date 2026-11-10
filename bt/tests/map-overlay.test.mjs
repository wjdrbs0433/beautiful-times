import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('지도 시간 갱신은 배지를 바꾸고 확대·이동 위치를 유지한다',()=>{
 const html=readFileSync(new URL('../public/kakao-map.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8082/kakao-map.html?key='+'a'.repeat(32),runScripts:'outside-only'});
 const {window}=dom;let fits=0;const visible=new Set();
 class Overlay {constructor(options){this.content=options.content;visible.add(this);}setMap(map){if(!map)visible.delete(this);}}
 window.kakao={maps:{
  load:callback=>callback(),
  Map:class {addControl(){}setBounds(){fits++;}setCenter(){}setLevel(){}},
  LatLng:class {},LatLngBounds:class {extend(){}},CustomOverlay:Overlay,
  Polyline:class {setMap(){}},ZoomControl:class {},ControlPosition:{RIGHT:'right'},
  services:{Places:class {keywordSearch(){}},Status:{OK:'ok',ZERO_RESULT:'none'}}
 }};
 window.eval(script);
 window.document.querySelector('script[src]').onload();
 const stops=[{id:'a',name:'출발',lat:37,lng:127},{id:'b',name:'도착',lat:38,lng:128}];
 const configure=label=>window.document.dispatchEvent(new window.MessageEvent('message',{data:{type:'configure',stops,segments:[{fromId:'a',toId:'b',label}]}}));
 // The native bridge accepts document messages without a browser parent.
 window.ReactNativeWebView={postMessage(){}};
 configure('1 → 2 · 걷기 조회 중…');
 assert.equal(fits,1);
 configure('1 → 2 · 걷기 약 18분');
 assert.equal(fits,1);
 assert.deepEqual([...visible].filter(o=>o.content.className==='segment-label').map(o=>o.content.textContent),['1 → 2 · 걷기 약 18분']);
 stops[1].lat=38.1;configure('1 → 2 · 걷기 조회 중…');assert.equal(fits,2);
 dom.window.close();
});
