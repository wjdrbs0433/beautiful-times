import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('지도: 외부 메시지 주입 차단 및 장소·라벨 HTML을 실행하지 않고 텍스트로 표시', () => {
  const html = readFileSync(new URL('../public/kakao-map.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:8082/kakao-map.html?key=' + 'a'.repeat(32), runScripts: 'outside-only' });
  const { window } = dom;
  let fits = 0;
  const contents = [];
  window.kakao = { maps: {
    load: callback => callback(),
    Map: class { addControl() {} setBounds() { fits++; } setCenter() {} setLevel() {} },
    LatLng: class {}, LatLngBounds: class { extend() {} },
    CustomOverlay: class { constructor(options) { contents.push(options.content); } setMap() {} },
    Polyline: class { setMap() {} }, ZoomControl: class {}, ControlPosition: { RIGHT: 'right' },
    services: { Places: class { keywordSearch() { throw Error('unexpected provider request'); } }, Status: { OK: 'ok', ZERO_RESULT: 'none' } },
  } };
  try {
    window.eval(script);
    window.document.querySelector('script[src]').onload();
    const attack = '<img src=x onerror="window.privateDataLeaked=true">';
    const data = { type: 'configure', stops: [{ id: 'a', name: attack, lat: 37, lng: 127 }, { id: 'b', name: attack, lat: 38, lng: 128 }], segments: [{ fromId: 'a', toId: 'b', label: attack }] };
    for (const options of [{ origin: 'https://attacker.example', source: window }, { origin: window.location.origin, source: null }]) {
      window.dispatchEvent(new window.MessageEvent('message', { ...options, data }));
      assert.equal(fits, 0);
    }
    window.dispatchEvent(new window.MessageEvent('message', { origin: window.location.origin, source: window, data }));
    assert.equal(fits, 1);
    assert.equal(contents.find(c => c.className === 'segment-label').textContent, attack);
    for (const content of contents) assert.equal(content.querySelectorAll('img,script,iframe').length, 0);
    assert.equal(window.privateDataLeaked, undefined);
  } finally { window.close(); }
});
