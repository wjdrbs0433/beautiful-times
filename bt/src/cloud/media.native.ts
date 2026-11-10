import * as FileSystem from 'expo-file-system/legacy';
export async function readMedia(uri:string){
  if(!uri.startsWith('file://')&&!uri.startsWith('content://'))throw Error('이 기기의 사진 파일을 다시 선택해 주세요.');
  const info=await FileSystem.getInfoAsync(uri);if(!info.exists)throw Error('이 기기의 사진 파일을 찾지 못했어요. 원본을 다시 선택해 주세요.');
  if(info.size>50*1024*1024)throw Error('50MB보다 큰 사진은 용량을 줄여 다시 선택해 주세요.');
  const base64=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});
  const raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const ext=uri.split('.').pop()?.toLowerCase();
  const mime=({png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif',avif:'image/avif'} as Record<string,string>)[ext??'']||'image/jpeg';
  return {bytes:bytes.buffer,mime};
}
export async function localMedia(path:string,signedUrl:string,userId:string){
  const dir=`${FileSystem.documentDirectory}cloud-photos/${userId}/`;await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
  const target=dir+path.split('/').slice(1).join('-');
  if(!(await FileSystem.getInfoAsync(target)).exists){const temp=target+'.download';try{await FileSystem.downloadAsync(signedUrl,temp);await FileSystem.moveAsync({from:temp,to:target});}catch(error){await FileSystem.deleteAsync(temp,{idempotent:true}).catch(()=>{});throw error;}}
  return target;
}
export async function canReuseMedia(uri:string){return uri.startsWith('file://')&&(await FileSystem.getInfoAsync(uri)).exists;}
