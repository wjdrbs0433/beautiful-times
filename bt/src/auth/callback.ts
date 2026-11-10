export function parseAuthCallback(value: string, expected: string) {
  const url = new URL(value);
  const target = new URL(expected);
  if (url.username || url.password || url.protocol !== target.protocol || url.host !== target.host || url.pathname !== target.pathname) {
    throw new Error('로그인 반환 주소가 올바르지 않아요.');
  }
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) {
    throw new Error('카카오 로그인이 완료되지 않았어요. 동의 화면을 확인하고 다시 시도해 주세요.');
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error('로그인 인증 코드를 받지 못했어요. 다시 시도해 주세요.');
  const flowId = url.searchParams.get('sb_flow_id');
  if (flowId && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) throw new Error('로그인 요청 정보를 확인하지 못했어요.');
  return { code, flowId };
}
export function accountStorageKey(userId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(userId)) throw new Error('사용자 식별자 오류');
  return 'bt.account.v1.' + userId;
}
