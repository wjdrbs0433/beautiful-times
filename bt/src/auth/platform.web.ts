export function configurePlatform() {
  if(!window.crypto?.subtle)throw new Error("로그인은 HTTPS 또는 localhost에서 사용해 주세요.");
  return {
    storage: window.localStorage,
    redirectTo: window.location.origin + '/',
    detectSessionInUrl: true,
  };
}
export async function openLogin(url:string, _redirect:string) { window.location.assign(url); return null; }
