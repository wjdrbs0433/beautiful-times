import {assertOwnPath,referencedFiles,type CloudDocument} from './document';

// Only former backgrounds are eligible; album deletions are a separate action.
export function pendingCoverCleanup(pending:string[],previous:(CloudDocument|null)[],next:CloudDocument,userId:string){
 const used=referencedFiles(next);
 return [...new Set([...pending,...previous.flatMap(doc=>Object.values(doc?.covers??{}))])]
  .filter((path):path is string=>!!path)
  .filter(path=>{assertOwnPath(path,userId);return path.startsWith(`${userId}/covers/`)&&!used.has(path);});
}
