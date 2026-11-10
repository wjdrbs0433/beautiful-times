import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { configurePlatform } from './platform';
import { cloudConfig } from '../cloudConnection';
import { AUTH_STORAGE_KEY, idleSessionStorage } from './idleSession';
import { cloudFetch } from '../cloud/network';
let client: Promise<{client:SupabaseClient;redirectTo:string;activity:ReturnType<typeof idleSessionStorage>}> | undefined;
export function getAuthClient() {
  if (!client) client = createAuthClient().catch(error=>{ client=undefined; throw error; });
  return client;
}
async function createAuthClient() {
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloudConfig.url)||!cloudConfig.key.startsWith('sb_publishable_'))throw new Error('로그인 서버 연결 설정이 필요해요.');
  const config=configurePlatform();
  const activity=idleSessionStorage(config.storage);
  const instance=createClient(cloudConfig.url,cloudConfig.key,{global:{fetch:cloudFetch},auth:{storage:activity.storage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:config.detectSessionInUrl,flowType:'pkce',lock:processLock,storageKey:AUTH_STORAGE_KEY}});
  return {client:instance,redirectTo:config.redirectTo,activity};
}
