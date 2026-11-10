export const cloudConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
};
export type CloudConnection = {
  database: boolean;
  auth: boolean;
  kakaoEnabled: boolean;
  schemaProtected: boolean;
  checkedAt: string;
};

export async function checkCloudConnection(
  config = cloudConfig,
  fetcher: typeof fetch = fetch,
): Promise<CloudConnection> {
  let url: URL;
  try { url = new URL(config.url); } catch { throw new Error('Supabase 연결 설정이 필요해요.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) {
    throw new Error('Supabase 공개 연결 설정을 확인해 주세요. 비밀 키는 사용할 수 없어요.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const base = url.origin;
    const options = { headers: { apikey: config.key }, signal: controller.signal };
    const [auth, database] = await Promise.all([
      fetcher(base + '/auth/v1/settings', options),
      fetcher(base + '/rest/v1/bt_connection_probe?select=id&limit=0', options),
    ]);
    const [settings, result] = await Promise.all([auth.json(), database.json()]);
    // A missing probe table is expected on an empty project. It confirms the
    // authenticated Data API responded without opening schema metadata or data.
    const missingProbe = database.status === 404 && result?.code === 'PGRST205';
    if (!auth.ok || (!database.ok && !missingProbe)) throw new Error('서버 연결을 확인하지 못했어요. 공개 키와 프로젝트 상태를 확인해 주세요.');
    if (!settings || typeof settings.external !== 'object' || (database.ok && !Array.isArray(result))) throw new Error('서버 응답 형식을 확인하지 못했어요.');
    return { database: true, auth: true, kakaoEnabled: settings.external.kakao === true, schemaProtected: missingProbe, checkedAt: new Date().toISOString() };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('서버 응답이 늦어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('Supabase에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
    throw error;
  } finally { clearTimeout(timeout); }
}
