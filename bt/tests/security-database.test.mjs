// Real PostgreSQL (WASM), fake Supabase auth/storage schemas, fake identities.
// No network, production credentials, or real user data are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const document = () => ({ version: 1, plans: [], photos: [], entries: [], anniversaries: {}, covers: {} });

test('격리 PostgreSQL: 수정 전 검증 우회 재현과 수정 후 계정·사진 접근 공격 차단', { timeout: 30000 }, async t => {
  const db = new PGlite();
  const migrate = async name => db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
  const identity = async (role, user = '') => {
    assert.ok(['postgres', 'anon', 'authenticated'].includes(role));
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec('set role ' + role);
  };
  const denied = promise => assert.rejects(promise, e => ['42501', '22023', '40001'].includes(e.code));
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create schema storage;
      grant usage on schema public, auth, storage to anon, authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id bigint generated always as identity primary key, bucket_id text, name text);
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
      alter table storage.objects enable row level security;
      grant select, insert, delete on storage.objects to anon, authenticated;
      grant usage on sequence storage.objects_id_seq to anon, authenticated;
    `);
    await db.query('insert into auth.users values ($1), ($2)', [A, B]);
    await migrate('20261109_account_sync.sql');
    await migrate('20261109180000_cover_cleanup.sql');
    for (const user of [A, B]) {
      await db.query("insert into storage.objects(bucket_id, name) values ('bt-private-photos', $1), ('bt-private-photos', $2)", [user + '/covers/keep.jpg', user + '/covers/unused.jpg']);
      await identity('authenticated', user);
      const doc = { ...document(), covers: { couple: user + '/covers/keep.jpg' } };
      await db.query('select * from public.bt_save_account_data(0, $1::jsonb)', [JSON.stringify(doc)]);
      await identity('postgres');
    }

    await t.test('수정 전: 직접 쓰기로 RPC의 용량 제한과 revision 증가를 우회할 수 있었음', async () => {
      await identity('authenticated', A);
      const oversized = { ...document(), entries: [{ id: 'fake', space: 'couple', text: 'x'.repeat(2097152) }] };
      await denied(db.query('select * from public.bt_save_account_data(1, $1::jsonb)', [JSON.stringify(oversized)]));
      const result = await db.query('update public.bt_account_data set payload=$1::jsonb where user_id=$2 returning revision', [JSON.stringify(oversized), A]);
      assert.equal(result.rows[0].revision, 1, 'baseline bypass must actually reproduce');
      await db.query('update public.bt_account_data set payload=$1::jsonb where user_id=$2', [JSON.stringify({ ...document(), covers: { couple: A + '/covers/keep.jpg' } }), A]);
    });

    await identity('postgres');
    await migrate('20261110120000_account_write_guard.sql');

    await t.test('익명 사용자의 계정 읽기·쓰기·RPC 접근 차단', async () => {
      await identity('anon');
      await denied(db.query('select * from public.bt_account_data'));
      await denied(db.query('insert into public.bt_account_data(user_id,payload) values ($1,$2::jsonb)', [A, JSON.stringify(document())]));
      await denied(db.query('select * from public.bt_save_account_data(0,$1::jsonb)', [JSON.stringify(document())]));
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    });

    await t.test('A 계정이 B 계정의 기록을 읽거나 수정·삭제하거나 가장할 수 없음', async () => {
      await identity('authenticated', A);
      assert.equal((await db.query('select * from public.bt_account_data where user_id=$1', [B])).rows.length, 0);
      assert.equal((await db.query('update public.bt_account_data set revision=revision+1 where user_id=$1 returning user_id', [B])).rows.length, 0);
      await denied(db.query('delete from public.bt_account_data where user_id=$1', [B]));
      await denied(db.query('insert into public.bt_account_data(user_id,payload) values ($1,$2::jsonb)', [B, JSON.stringify(document())]));
      await denied(db.query('update public.bt_account_data set user_id=$1, revision=revision+1 where user_id=$2', [B, A]));
      assert.deepEqual((await db.query('select user_id from public.bt_account_data')).rows, [{ user_id: A }]);
    });

    await t.test('타 계정 사진 조회·업로드·삭제·경로 주입과 익명 사진 접근 차단', async () => {
      await identity('authenticated', A);
      assert.ok((await db.query('select name from storage.objects')).rows.every(row => row.name.startsWith(A + '/')));
      await denied(db.query("insert into storage.objects(bucket_id,name) values ('bt-private-photos',$1)", [B + '/covers/injected.jpg']));
      assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [B + '/covers/keep.jpg'])).rows.length, 0);
      await denied(db.query('select * from public.bt_save_account_data(1,$1::jsonb)', [JSON.stringify({ ...document(), covers: { couple: B + '/covers/keep.jpg' } })]));
    });

    await t.test('수정 후: 직접 쓰기에서도 과대·비정상 payload, 사진 uri, revision 우회 차단', async () => {
      await identity('authenticated', A);
      for (const payload of [
        { ...document(), entries: [{ text: 'x'.repeat(2097152) }] },
        { ...document(), plans: 'invalid' },
        { ...document(), covers: [] },
        { ...document(), photos: [{ uri: 'file:///fake-private.jpg', storagePath: A + '/covers/keep.jpg' }] },
        { ...document(), photos: [42] },
      ]) await denied(db.query('update public.bt_account_data set payload=$1::jsonb, revision=revision+1 where user_id=$2', [JSON.stringify(payload), A]));
      await denied(db.query('update public.bt_account_data set payload=$1::jsonb where user_id=$2', [JSON.stringify(document()), A]));
      await denied(db.query('update public.bt_account_data set revision=999 where user_id=$1', [A]));
      assert.equal((await db.query('select revision from public.bt_account_data')).rows[0].revision, 1);
    });

    await t.test('정상 RPC 저장은 유지하고 stale revision과 사용 중 사진 삭제 차단', async () => {
      await identity('authenticated', A);
      assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [A + '/covers/keep.jpg'])).rows.length, 0);
      const next = { ...document(), covers: { couple: A + '/covers/keep.jpg' } };
      const saved = await db.query('select * from public.bt_save_account_data(1,$1::jsonb)', [JSON.stringify(next)]);
      assert.equal(saved.rows[0].revision, 2);
      await denied(db.query('select * from public.bt_save_account_data(1,$1::jsonb)', [JSON.stringify(next)]));
      assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [A + '/covers/unused.jpg'])).rows.length, 1);
      await identity('postgres');
      assert.equal((await db.query('select revision from public.bt_account_data where user_id=$1', [B])).rows[0].revision, 1);
    });
  } finally {
    await db.close();
  }
});
