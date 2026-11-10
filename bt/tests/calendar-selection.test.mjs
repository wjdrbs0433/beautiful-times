import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>');
const originals=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
 originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value,writable:true});
}
after(()=>{dom.window.close();for(const [key,old]of originals){if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];}});
const {createRoot}=await import('react-dom/client');const require=createRequire(import.meta.url);
const primitive=tag=>function NativePrimitive({children,onPress,accessibilityLabel,disabled}){return React.createElement(tag,{'aria-label':accessibilityLabel,onClick:onPress,disabled},children);};
const native={View:primitive('div'),Text:primitive('span'),ScrollView:primitive('div'),Pressable:primitive('button'),StyleSheet:{create:value=>value}};
const compiled=ts.transpileModule(readFileSync(new URL('../src/components/CalendarField.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
new Function('require','module','exports',compiled)(name=>name==='react-native'?native:name==='@expo/vector-icons'?{Ionicons:()=>null}:name==='../model'?require(fileURLToPath(new URL('../src/model.ts',import.meta.url))):require(name),module,module.exports);
const {CalendarField}=module.exports;
function calendar(t,initial){
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);let saved;
 function Harness(){const [date,setDate]=React.useState(initial);return React.createElement(React.Fragment,null,React.createElement(CalendarField,{label:'기준 날짜',value:date,onChange:setDate}),React.createElement('button',{onClick:()=>{saved=date;}},'저장'));}
 act(()=>root.render(React.createElement(Harness)));t.after(()=>{act(()=>root.unmount());container.remove();});
 const press=label=>{const button=[...container.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label);assert.ok(button,label);act(()=>button.click());};
 return {press,save:()=>{press('저장');return saved;}};
}
test('연도만 바꾼 뒤 바로 저장해도 기존 월·일과 변경 연도가 저장된다',t=>{
 const c=calendar(t,'2023-08-15');c.press('기준 날짜 달력 열기');c.press('연도 선택');c.press('2024년 선택');assert.equal(c.save(),'2024-08-15');
});
test('월만 바꾼 뒤 바로 저장해도 변경 월이 저장된다',t=>{
 const c=calendar(t,'2024-08-15');c.press('기준 날짜 달력 열기');c.press('월 선택');c.press('2월 선택');assert.equal(c.save(),'2024-02-15');
});
test('윤년·월말 날짜는 선택 연월의 마지막 날로 보정한다',t=>{
 const c=calendar(t,'2024-02-29');c.press('기준 날짜 달력 열기');c.press('연도 선택');c.press('2023년 선택');assert.equal(c.save(),'2023-02-28');
 const d=calendar(t,'2024-01-31');d.press('기준 날짜 달력 열기');d.press('월 선택');d.press('4월 선택');assert.equal(d.save(),'2024-04-30');
});
test('화살표로 달력을 둘러보기만 하면 기존 선택 날짜는 바뀌지 않는다',t=>{
 const c=calendar(t,'2024-08-15');c.press('기준 날짜 달력 열기');c.press('다음 달');assert.equal(c.save(),'2024-08-15');
});
