type ProfileUser = {
  user_metadata?: unknown;
  identities?: { provider?: string; identity_data?: unknown }[];
};
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function text(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value=data[key];
    if(typeof value==='string'&&value.trim())return value.trim();
  }
  return '';
}
function photoUrl(value: string) {
  try {
    const url=new URL(value);
    if(url.username||url.password)return '';
    // Kakao may supply its CDN photo with http; request the HTTPS variant.
    if(url.protocol==='http:'&&(url.hostname==='kakaocdn.net'||url.hostname.endsWith('.kakaocdn.net')))url.protocol='https:';
    return url.protocol==='https:'?url.href:'';
  }catch{return '';}
}
export function kakaoProfile(user: ProfileUser) {
  const identity=record(user.identities?.find(item=>item.provider==='kakao')?.identity_data);
  const metadata=record(user.user_metadata);
  const names=['name','full_name','preferred_username','user_name','nickname'];
  const photos=['avatar_url','picture','profile_image_url'];
  return {
    name:text(identity,names)||text(metadata,names)||'이름을 제공하지 않은 계정',
    avatarUrl:photoUrl(text(identity,photos))||photoUrl(text(metadata,photos)),
  };
}
