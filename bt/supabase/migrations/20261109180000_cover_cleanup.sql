begin;
-- All saves (including older app versions) reject missing or foreign media.
-- UPDATE already holds this account row's lock before the trigger runs.
create or replace function public.bt_validate_photo_paths()
returns trigger language plpgsql security definer set search_path = '' as $$
declare media_path text;
begin
  for media_path in
    select value from jsonb_each_text(coalesce(new.payload->'covers','{}'::jsonb))
    union
    select item->>'storagePath' from jsonb_array_elements(coalesce(new.payload->'photos','[]'::jsonb)) item
  loop
    if media_path is null or split_part(media_path,'/',1) <> new.user_id::text
       or not exists(select 1 from storage.objects where bucket_id='bt-private-photos' and name=media_path) then
      raise exception 'Photo file missing or inaccessible' using errcode='22023';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.bt_validate_photo_paths() from public,anon,authenticated;
drop trigger if exists bt_validate_photo_paths on public.bt_account_data;
create trigger bt_validate_photo_paths before insert or update of payload on public.bt_account_data
for each row execute function public.bt_validate_photo_paths();

-- Serialize deletion with account writes, then inspect the latest references.
-- Only reports a boolean for the caller's own record, never another user's data.
create or replace function public.bt_can_delete_photo(object_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare document jsonb;
begin
  if auth.uid() is null or split_part(object_path,'/',1) <> auth.uid()::text then return false; end if;
  select payload into document from public.bt_account_data where user_id=auth.uid() for update;
  if not found then return false; end if;
  return not exists(select 1 from jsonb_each_text(document->'covers') where value=object_path)
     and not exists(select 1 from jsonb_array_elements(document->'photos') item where item->>'storagePath'=object_path);
end $$;
revoke all on function public.bt_can_delete_photo(text) from public,anon;
grant execute on function public.bt_can_delete_photo(text) to authenticated;
alter policy bt_photo_delete_own on storage.objects using (
  bucket_id='bt-private-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and public.bt_can_delete_photo(name)
);
notify pgrst, 'reload schema';
commit;
