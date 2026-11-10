import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { secureChunks } from './secureChunks';
export function configurePlatform() {
  if(typeof TextEncoder === "undefined" || typeof btoa === "undefined")throw new Error("로그인 암호화 모듈 업데이트가 필요해요.");
  // auth-js needs only secure random values and SHA-256 for S256 PKCE.
  if (!globalThis.crypto?.subtle) {
    const cryptoForPKCE = {
      getRandomValues: Crypto.getRandomValues,
      randomUUID: Crypto.randomUUID,
      subtle: { async digest(algorithm:string, input:BufferSource) {
        if(algorithm!=='SHA-256')throw new Error('지원하지 않는 해시 알고리즘');
        return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,input);
      } },
    };
    Object.defineProperty(globalThis,'crypto',{value:cryptoForPKCE,configurable:true});
  }
  return {storage:secureChunks(SecureStore,Crypto.randomUUID),redirectTo:'bt://auth/callback',detectSessionInUrl:false};
}
export async function openLogin(url:string, redirect:string) {
  const result=await WebBrowser.openAuthSessionAsync(url,redirect);
  return result.type==='success'?result.url:null;
}
