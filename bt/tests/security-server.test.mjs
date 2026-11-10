import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

test('격리 개발 서버: 비밀 탈취·CSRF·경로 탐색·SSRF·과대 요청·호출 제한 우회 시도', { timeout: 20000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bt-security-server-'));
  const port = 32000 + Math.floor(Math.random() * 12000);
  const rest = 'a'.repeat(32), js = 'b'.repeat(32);
  let child;
  let exited;
  try {
    await mkdir(join(directory, 'scripts'));
    for (const file of ['routes-server.mjs', 'route-provider.mjs']) {
      await copyFile(new URL('../scripts/' + file, import.meta.url), join(directory, 'scripts', file));
    }
    // Every provider fetch is intercepted. This process cannot call real Kakao.
    await writeFile(join(directory, 'provider-stub.mjs'), `
      import assert from 'node:assert/strict';
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).origin, 'https://apis-navi.kakaomobility.com');
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers.Authorization, 'KakaoAK ' + 'a'.repeat(32));
        return new Response(JSON.stringify({ routes: [{ result_code: 0, summary: { duration: 90, distance: 1000 } }] }));
      };
    `);
    child = spawn(process.execPath, ['--import', join(directory, 'provider-stub.mjs'), join(directory, 'scripts/routes-server.mjs')], {
      cwd: directory,
      // Deliberately do not inherit any actual application credentials.
      env: { BT_ROUTE_PORT: String(port), KAKAO_REST_API_KEY: rest, KAKAO_JS_KEY: js },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    exited = once(child, 'exit');
    await Promise.race([
      once(child.stdout, 'data'),
      exited.then(() => { throw Error('isolated server did not start'); }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('startup timeout')), 5000); timer.unref(); }),
    ]);
    const base = `http://127.0.0.1:${port}`;
    const request = async (path, init) => {
      const response = await fetch(base + path, { ...init, redirect: 'manual' });
      const text = await response.text();
      assert.ok(!text.includes(rest), 'server-only key must never enter an HTTP response');
      return { status: response.status, headers: response.headers, text };
    };
    const route = { mode: 'car', from: { lat: 37, lng: 127 }, to: { lat: 38, lng: 128 } };
    const post = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

    await t.test('REST 키 추출 시도: 공개 API·상태·설정 HTML·오류 응답에서 비밀이 없음', async () => {
      const config = await request('/public-config');
      assert.deepEqual(JSON.parse(config.text), { kakaoJsKey: js });
      assert.equal(config.headers.get('cache-control'), 'no-store');
      assert.equal((await request('/health')).status, 200);
      const setup = await request('/setup');
      assert.match(setup.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal((await request('/missing')).status, 404);
    });

    await t.test('외부 Origin·null Origin·위조 Host로 접근 및 설정 변경 불가', async () => {
      for (const origin of ['https://attacker.example', 'null']) {
        assert.equal((await request('/public-config', { headers: { Origin: origin } })).status, 403);
        assert.equal((await request('/setup', { headers: { Origin: origin } })).status, 403);
        assert.equal((await request('/route', { ...post(route), headers: { 'Content-Type': 'application/json', Origin: origin } })).status, 403);
      }
      // Fetch may normalize Host; use raw HTTP so the forged value is sent.
      const status = await new Promise((resolve, reject) => {
        const req = http.get(base + '/health', { headers: { Host: 'attacker.example' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
        req.on('error', reject);
      });
      assert.equal(status, 403);
    });

    await t.test('CSRF 누락·오류·멀티바이트 및 키 줄바꿈 주입 거절, 설정 파일 생성 없음', async () => {
      for (const csrf of ['', 'bad', '가'.repeat(48)]) {
        assert.equal((await request('/setup', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, key: rest }) })).status, 400);
      }
      const setup = await request('/setup');
      const csrf = setup.text.match(/name="csrf" value="([a-f0-9]+)"/)[1];
      assert.equal((await request('/setup', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, key: rest + '\nINJECTED=value' }) })).status, 400);
      await assert.rejects(readFile(join(directory, '.env.route.local')), { code: 'ENOENT' });
    });

    await t.test('환경파일·Git 설정·상위 경로·관리 URL을 탐색해도 내용 반환 없음', async () => {
      for (const path of ['/.env', '/.env.local', '/.env.route.local', '/.git/config', '/scripts/routes-server.mjs', '/../.env.route.local', '/%2e%2e/.env.local', '/admin']) {
        assert.equal((await request(path)).status, 404);
      }
    });

    await t.test('JSON 파손·위조 Content-Type·과대 고정길이/청크 요청을 제한된 오류로 처리', async () => {
      assert.equal((await request('/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status, 400);
      assert.equal((await request('/route', { ...post(route), headers: { 'Content-Type': 'application/json.evil' } })).status, 415);
      assert.equal((await request('/route', post({ ...route, notes: 'x'.repeat(16001) }))).status, 413);
      const status = await new Promise((resolve, reject) => {
        const req = http.request(base + '/route', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
        req.on('error', reject);
        req.write('x'.repeat(8000)); req.write('x'.repeat(8000)); req.end('x');
      });
      assert.equal(status, 413);
      assert.equal((await request('/health')).status, 200);
    });

    await t.test('잘못된 좌표·모드 거절, 주입 URL은 사용하지 않고 공급자 주소 고정', async () => {
      for (const value of [{ ...route, mode: 'http://127.0.0.1/admin' }, { ...route, from: { lat: 91, lng: 127 } }, { ...route, from: { lat: '37', lng: 127 } }]) {
        assert.equal((await request('/route', post(value))).status, 400);
      }
      const result = await request('/route', post({ ...route, url: 'http://127.0.0.1/admin', apiKey: 'attacker-value' }));
      assert.equal(result.status, 200);
      assert.equal(JSON.parse(result.text).seconds, 90);
    });

    await t.test('1분 60회 한도를 넘는 추가 조회는 429로 차단', async () => {
      for (let i = 0; i < 59; i++) assert.equal((await request('/route', post(route))).status, 200);
      assert.equal((await request('/route', post(route))).status, 429);
    });
  } finally {
    if (child) {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
