import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const originals = new Map();
for (const [name,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
 originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
 Object.defineProperty(globalThis,name,{configurable:true,value,writable:true});
}
after(()=>{
 dom.window.close();
 for(const [name,descriptor]of originals) {
  if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
 }
});
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
function loadWebComponent(path) {
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>name==='./FieldInput.types'?require(fileURLToPath(new URL('../src/components/FieldInput.types.ts',import.meta.url))):require(name),module,module.exports);
 return module.exports.default;
}
const FieldInput=loadWebComponent('../src/components/FieldInput.web.tsx');
const PlaceResultButton=loadWebComponent('../src/components/PlaceResultButton.web.tsx');
const {usePlaceSearch}=await import('../src/usePlaceSearch.ts');

function field(t,{initial='',multiline=false}={}) {
 const container=document.createElement('div');document.body.append(container);
 const root=createRoot(container);let value=initial,tick=0;const commits=[];
 const render=()=>root.render(React.createElement('section',{'data-tick':++tick},React.createElement(FieldInput,{label:multiline?'메모':'장소 이름',value,multiline,onChange:text=>{value=text;commits.push(text);render();}})));
 act(render);
 const input=container.querySelector(multiline?'textarea':'input');input.focus();
 t.after(()=>{act(()=>root.unmount());container.remove();});
 return {input,commits,redraw:()=>act(render),replace:text=>act(()=>{value=text;render();}),event:(name,text,composing)=>act(()=>{
  if(text!==undefined)input.value=text;
  const event=name==='input'?new dom.window.InputEvent(name,{bubbles:true,data:text,isComposing:composing}):new dom.window.CompositionEvent(name,{bubbles:true,data:text});
  input.dispatchEvent(event);
 })};
}
test('한글 조합 중 부모 재렌더에도 입력값·커서를 유지하고 검색 값은 확정 뒤 한 번 전달한다',t=>{
 const f=field(t);
 f.event('compositionstart','');
 for(const text of ['ㄴ','나','낙','낙ㅅ','낙서','낙성','낙성대','낙성대여','낙성대역']) {
  f.event('input',text,true);f.input.setSelectionRange(text.length,text.length);f.redraw();
  assert.equal(f.input.value,text);assert.equal(f.input.selectionStart,text.length);assert.equal(document.activeElement,f.input);
 }
 assert.deepEqual(f.commits,[]);
 f.event('compositionend','낙성대역');f.event('input','낙성대역',false);
 assert.deepEqual(f.commits,['낙성대역']);assert.equal(f.input.value,'낙성대역');
});
test('검색 결과에서 장소를 선택한 외부 값은 반영하고 중간 커서 편집을 덮어쓰지 않는다',t=>{
 const f=field(t,{initial:'낙성대'});
 f.replace('낙성대역');assert.equal(f.input.value,'낙성대역');
 f.input.setSelectionRange(2,2);f.redraw();assert.equal(f.input.selectionStart,2);
 f.event('input','낙성대역 4번출구',false);f.redraw();assert.equal(f.input.value,'낙성대역 4번출구');
 f.event('input','',false);assert.equal(f.commits.at(-1),'');
});
test('메모의 조합이 blur로 끝나도 최종 글자를 누락하거나 중복 전달하지 않는다',t=>{
 const f=field(t,{multiline:true});
 f.event('compositionstart','');f.event('input','예약시간',true);assert.deepEqual(f.commits,[]);
 act(()=>f.input.blur());assert.deepEqual(f.commits,['예약시간']);
 f.event('compositionend','예약시간');assert.deepEqual(f.commits,['예약시간']);
});

function autocomplete(t,placeName) {
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);let controls;
 const place={id:'chosen',name:placeName,address:'서울',roadAddress:'서울',lat:37.5,lng:127,url:'https://place.map.kakao.com/1'};
 function Harness(){
  const [name,setName]=React.useState('');
  const search=usePlaceSearch(()=>document.activeElement?.blur());
  React.useLayoutEffect(()=>{controls={...search,setName};},[search]);
  return React.createElement('section',null,
   React.createElement(FieldInput,{key:search.inputRevisions.a??0,label:'장소 이름',value:name,onChange:text=>{setName(text);search.startSearch('a',text,true);}}),
   search.search.results.map(p=>React.createElement(PlaceResultButton,{key:p.id,label:p.name,onPress:()=>search.choosePlace('a',()=>setName(p.name))},p.name)));
 }
 act(()=>root.render(React.createElement(Harness)));
 t.after(()=>{act(()=>root.unmount());container.remove();});
 return {
  get input(){return container.querySelector('input');},get button(){return container.querySelector('button');},get search(){return controls.search;},
  event(event,text,composing=false){act(()=>{const input=container.querySelector('input');if(text!==undefined)input.value=text;input.dispatchEvent(event==='input'?new dom.window.InputEvent(event,{bubbles:true,isComposing:composing}):new dom.window.CompositionEvent(event,{bubbles:true,data:text}));});},
  receive(id,query,error){act(()=>controls.receiveResults(id,query,[place],error));},
 };
}
for(const [typed,composed,selected]of [['낙성대','낙성대역','낙성대역 2호선'],['서울숲','서울숲카페','스타벅스 서울숲역점']]) {
 test(`${selected}: 조합 중 결과를 눌러도 선택 이름이 유지되고 추천 목록이 다시 열리지 않는다`,t=>{
  const f=autocomplete(t,selected);f.input.focus();f.event('input',typed);
  const originalRequest=f.search.requestId;f.receive(originalRequest,typed);
  f.event('compositionstart');f.event('input',composed,true);
  const oldInput=f.input;const button=f.button;
  const down=new dom.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0});
  act(()=>button.dispatchEvent(down));assert.equal(down.defaultPrevented,true);
  act(()=>button.click());
  assert.equal(f.input.value,selected);assert.equal(f.button,null);assert.equal(f.search.stopId,'');assert.equal(f.search.busy,false);assert.notEqual(f.input,oldInput);
  act(()=>{oldInput.value=composed;oldInput.dispatchEvent(new dom.window.CompositionEvent('compositionend',{bubbles:true,data:composed}));oldInput.dispatchEvent(new dom.window.InputEvent('input',{bubbles:true}));});
  f.receive(originalRequest,typed,'늦은 오류');
  assert.equal(f.input.value,selected);assert.equal(f.button,null);assert.equal(f.search.error,'');
  const selectedInput=f.input;selectedInput.focus();f.event('input',typed);
  assert.equal(f.input,selectedInput);assert.equal(f.search.query,typed);assert.notEqual(f.search.requestId,originalRequest);
  f.receive(originalRequest,typed);assert.equal(f.button,null);assert.equal(f.search.busy,true);
  f.receive(f.search.requestId,typed);assert.equal(f.button.textContent,selected);
 });
}
