import type { MemoryState, Photo, Space } from '../model';
export type CloudPhoto = Omit<Photo, 'uri'> & { storagePath: string };
export type CloudDocument = {
  version: 1;
  anniversaries: MemoryState['anniversaries'];
  covers: Partial<Record<Space, string>>;
  plans: MemoryState['plans'];
  photos: CloudPhoto[];
  entries: MemoryState['entries'];
};
export const emptyDocument = (): CloudDocument => ({version:1,anniversaries:{},covers:{},plans:[],photos:[],entries:[]});
function ordered(value: unknown): unknown {
  if(Array.isArray(value))return value.map(ordered);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)]));
  return value;
}
export const same = (a: unknown,b: unknown) => JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
export class SyncConflict extends Error { constructor(){super('다른 기기에서도 같은 기록을 수정했어요. 이 기기와 서버 중 사용할 내용을 선택해 주세요.');} }
export function mergeDocuments(base: CloudDocument | null,local: CloudDocument,remote: CloudDocument,preference?:'local'|'remote'): CloudDocument {
  function choose<T>(before:T|undefined,left:T|undefined,right:T|undefined):T|undefined {
    if(same(left,right))return left;
    if(!base)return right===undefined?left:right; // First migration: do not replace an existing cloud record.
    if(same(left,before))return right;
    if(same(right,before))return left;
    if(preference)return preference==='local'?left:right;
    throw new SyncConflict();
  }
  function records<T extends {id:string}>(b:T[],l:T[],r:T[]):T[]{
    const bm=new Map(b.map(v=>[v.id,v])),lm=new Map(l.map(v=>[v.id,v])),rm=new Map(r.map(v=>[v.id,v]));
    return [...new Set([...r.map(v=>v.id),...l.map(v=>v.id),...b.map(v=>v.id)])].flatMap(id=>{const v=choose(bm.get(id),lm.get(id),rm.get(id));return v?[v]:[];});
  }
  const anniversaries:CloudDocument['anniversaries']={},covers:CloudDocument['covers']={};
  for(const space of ['couple','family'] as const){
    const date=choose(base?.anniversaries[space],local.anniversaries[space],remote.anniversaries[space]);if(date)anniversaries[space]=date;
    const cover=choose(base?.covers[space],local.covers[space],remote.covers[space]);if(cover)covers[space]=cover;
  }
  return {version:1,anniversaries,covers,plans:records(base?.plans??[],local.plans,remote.plans),photos:records(base?.photos??[],local.photos,remote.photos),entries:records(base?.entries??[],local.entries,remote.entries)};
}
export function readDocument(raw: unknown):CloudDocument {
  if(!raw||typeof raw!=='object')throw Error('서버 기록 형식을 확인하지 못했어요.');
  const d=raw as CloudDocument;
  if(d.version!==1||!Array.isArray(d.plans)||!Array.isArray(d.photos)||!Array.isArray(d.entries)||!d.anniversaries||typeof d.anniversaries!=='object'||!d.covers||typeof d.covers!=='object')throw Error('서버 기록 형식을 확인하지 못했어요.');
  for(const group of [d.plans,d.photos,d.entries])if(group.some(p=>!p||typeof p.id!=='string'||!['couple','family'].includes(p.space))||new Set(group.map(p=>p.id)).size!==group.length)throw Error('서버 기록 식별자를 확인하지 못했어요.');
  if(d.photos.some(p=>typeof p.storagePath!=='string'))throw Error('서버 사진 경로를 확인하지 못했어요.');
  return d;
}
export function assertOwnPath(path:string,userId:string){
  if(!path.startsWith(userId+'/')||path.includes('..')||!/^[-a-zA-Z0-9_./]+$/.test(path))throw Error('사진 접근 경로가 올바르지 않아요.');
}
export function referencedFiles(doc:CloudDocument){return new Set([...Object.values(doc.covers),...doc.photos.map(p=>p.storagePath)].filter((v):v is string=>!!v));}
