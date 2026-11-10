begin;
-- Enforce the same limits for direct REST writes and RPC writes.
-- Keep security invoker + RLS; never grant clients a service-role capability.
create or replace function public.bt_guard_account_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if octet_length(new.payload::text) > 2097152
     or jsonb_typeof(new.payload) is distinct from 'object'
     or new.payload->>'version' is distinct from '1'
     or jsonb_typeof(new.payload->'plans') is distinct from 'array'
     or jsonb_typeof(new.payload->'photos') is distinct from 'array'
     or jsonb_typeof(new.payload->'entries') is distinct from 'array'
     or jsonb_typeof(new.payload->'anniversaries') is distinct from 'object'
     or jsonb_typeof(new.payload->'covers') is distinct from 'object' then
    raise exception 'Invalid account payload' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(new.payload->'photos') item
            where jsonb_typeof(item) is distinct from 'object' or item ? 'uri') then
    raise exception 'Use private storage paths for photos' using errcode='22023';
  end if;
  if tg_op = 'INSERT' then
    if new.revision <> 1 then
      raise exception 'Initial revision must be 1' using errcode='40001';
    end if;
  elsif new.user_id is distinct from old.user_id
        or new.revision <> old.revision + 1 then
    raise exception 'Account revision changed' using errcode='40001';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.bt_guard_account_write() from public, anon, authenticated;
drop trigger if exists bt_guard_account_write on public.bt_account_data;
create trigger bt_guard_account_write before insert or update on public.bt_account_data
for each row execute function public.bt_guard_account_write();
notify pgrst, 'reload schema';
commit;
