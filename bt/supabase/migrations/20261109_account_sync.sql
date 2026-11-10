begin;
create table if not exists public.bt_account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.bt_account_data enable row level security;
revoke all on public.bt_account_data from anon, public;
grant select, insert, update on public.bt_account_data to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bt_account_data' and policyname='bt_account_owner') then
    create policy bt_account_owner on public.bt_account_data to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;

create or replace function public.bt_save_account_data(p_expected_revision bigint, p_payload jsonb)
returns setof public.bt_account_data language plpgsql security invoker
set search_path = '' as $$
declare result public.bt_account_data;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_expected_revision < 0 or p_expected_revision is null or p_payload is null
     or jsonb_typeof(p_payload) <> 'object' or p_payload->>'version' is distinct from '1'
     or jsonb_typeof(p_payload->'plans') is distinct from 'array'
     or jsonb_typeof(p_payload->'photos') is distinct from 'array'
     or jsonb_typeof(p_payload->'entries') is distinct from 'array'
     or jsonb_typeof(p_payload->'anniversaries') is distinct from 'object'
     or jsonb_typeof(p_payload->'covers') is distinct from 'object'
     or octet_length(p_payload::text) > 2097152 then
    raise exception 'Invalid account payload' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'photos') item where item ? 'uri') then
    raise exception 'Use private storage paths for photos' using errcode='22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.bt_account_data(user_id,payload,revision) values(auth.uid(),p_payload,1)
    on conflict(user_id) do nothing returning * into result;
  else
    update public.bt_account_data set payload=p_payload,revision=revision+1,updated_at=now()
    where user_id=auth.uid() and revision=p_expected_revision returning * into result;
  end if;
  if result.user_id is null then raise exception 'Account revision changed' using errcode='40001'; end if;
  return next result;
end $$;
revoke all on function public.bt_save_account_data(bigint,jsonb) from public,anon;
grant execute on function public.bt_save_account_data(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bt-private-photos','bt-private-photos',false,52428800,array['image/*'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='bt_photo_read_own') then
    create policy bt_photo_read_own on storage.objects for select to authenticated
    using(bucket_id='bt-private-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
    create policy bt_photo_insert_own on storage.objects for insert to authenticated
    with check(bucket_id='bt-private-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
    create policy bt_photo_delete_own on storage.objects for delete to authenticated
    using(bucket_id='bt-private-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
end $$;
comment on table public.bt_account_data is 'BT account records; photo bytes live in private Storage. Revision checked by bt_save_account_data.';
notify pgrst, 'reload schema';
commit;
