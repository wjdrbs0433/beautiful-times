export async function readMedia(uri:string){
  const response=await fetch(uri);if(!response.ok)throw Error('이 기기의 사진 파일을 읽지 못했어요.');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>50*1024*1024)throw Error('50MB보다 큰 사진은 용량을 줄여 다시 선택해 주세요.');
  return {bytes,mime:response.headers.get('content-type')?.split(';')[0]||'image/jpeg'};
}
export async function localMedia(path:string,signedUrl:string,_userId:string){return signedUrl;}
export async function canReuseMedia(uri:string){return uri.startsWith('data:image/');}
