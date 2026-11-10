import http from 'node:http';
import { Buffer } from 'node:buffer';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { writeFile,chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { providerRequest,normalizeRoute,validRouteInput } from './route-provider.mjs';
const port=Number(process.env.BT_ROUTE_PORT||8090);const token=randomBytes(24).toString('hex');let key=process.env.KAKAO_REST_API_KEY||'';let jsKey=process.env.KAKAO_JS_KEY||'';let windowStart=Date.now(),count=0;
const allowed=new Set(['http://localhost:8081','http://127.0.0.1:8081','http://localhost:8082','http://127.0.0.1:8082']);
const selfOrigins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]);
function headers(req){return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(allowed.has(req.headers.origin)?{'Access-Control-Allow-Origin':req.headers.origin,'Vary':'Origin'}:{})};}
function json(req,res,status,data){res.writeHead(status,headers(req));res.end(JSON.stringify(data));}
async function body(req){
  return new Promise((resolve,reject)=>{
    let size=0,tooLarge=false;const chunks=[];
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>16000){if(!tooLarge){tooLarge=true;reject(Object.assign(new Error('large body'),{status:413}));}return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{if(!tooLarge)resolve(Buffer.concat(chunks).toString('utf8'));});
    req.on('error',()=>reject(Object.assign(new Error('invalid body'),{status:400})));
  });
}
function setupPage(saved){return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BT 이동시간 연결</title><style>body{font:16px system-ui;background:#fafbf8;color:#333833;max-width:560px;margin:60px auto;padding:24px;line-height:1.8}input,button{box-sizing:border-box;width:100%;font:inherit;padding:15px;border:1px solid #cdd5c7;border-radius:6px;margin:10px 0}button{background:#333833;color:white}small{color:#687862}</style><h1>BT 이동시간 연결</h1><p>개발자가 한 번 설정하면 BT가 지도 연결을 자동으로 사용합니다. 두 키는 서로 다른 키입니다. 기존 설정을 유지하려면 해당 칸을 비워 두세요.</p>${saved?'<p>✓ 키를 저장했습니다. BT로 돌아가 이동시간 새로고침을 누르세요.</p>':''}<p>현재 상태: ${key?'이동시간 설정됨':'이동시간 연결 전'} · ${jsKey?'지도 설정됨':'지도 연결 전'}</p><form method="post" action="/setup"><input type="hidden" name="csrf" value="${token}"><label for="jsKey">카카오 JavaScript 키 (지도·장소 검색)</label><input id="jsKey" name="jsKey" minlength="32" maxlength="32" autocomplete="off" placeholder="변경할 때만 입력"><label for="key">카카오 REST API 키 (이동시간)</label><input type="password" id="key" name="key" minlength="32" maxlength="32" autocomplete="off" placeholder="카카오 플랫폼 키에서 복사"><button>이 Mac에 저장</button></form><small>키는 .env.route.local 파일에 보관하며 앱 번들·백업·응답에 포함하지 않습니다. 키는 이 Mac과 카카오 API 호출에만 사용합니다. 개발용 로컬 연결이며 공개 서비스에서는 인증된 서버로 이전합니다.</small></html>`;}
const server=http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  try{
    const host=req.headers.host||'';
    if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(host))return json(req,res,403,{error:'허용되지 않은 호스트예요.'});
    if(Number(req.headers['content-length'])>16000)return json(req,res,413,{error:'요청 내용이 너무 커요.'});
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(url.pathname==='/setup'){
      if(req.headers.origin&&!selfOrigins.has(req.headers.origin))return json(req,res,403,{error:'설정 페이지에서 다시 저장해 주세요.'});
      if(req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(setupPage(url.searchParams.get('saved')==='1'));return;}
      if(req.method!=='POST'||!selfOrigins.has(req.headers.origin))return json(req,res,403,{error:'설정 페이지에서 다시 저장해 주세요.'});
      if(req.headers['content-type']?.split(';')[0].trim()!=='application/x-www-form-urlencoded')return json(req,res,415,{error:'설정 양식으로 저장해 주세요.'});
      const form=new URLSearchParams(await body(req));const supplied=form.get('csrf')||'';const next=(form.get('key')||'').trim();const nextJs=(form.get('jsKey')||'').trim();
      const suppliedBytes=Buffer.from(supplied),tokenBytes=Buffer.from(token);
      if(suppliedBytes.length!==tokenBytes.length||!timingSafeEqual(suppliedBytes,tokenBytes)||(next&&!/^[a-f0-9]{32}$/i.test(next))||(nextJs&&!/^[a-f0-9]{32}$/i.test(nextJs))||(!next&&!nextJs))return json(req,res,400,{error:'입력값을 확인해 주세요.'});
      const path=fileURLToPath(new URL('../.env.route.local',import.meta.url));await writeFile(path,`KAKAO_REST_API_KEY=${next||key}\nKAKAO_JS_KEY=${nextJs||jsKey}\n`,{mode:0o600});await chmod(path,0o600);key=next||key;jsKey=nextJs||jsKey;
      res.writeHead(303,{Location:'/setup?saved=1','Cache-Control':'no-store'});res.end();return;
    }
    if(req.headers.origin&&!allowed.has(req.headers.origin))return json(req,res,403,{error:'허용되지 않은 앱 주소예요.'});
    if(req.method==='OPTIONS'){res.writeHead(204,{...headers(req),'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
    if(req.method==='GET'&&url.pathname==='/public-config')return json(req,res,200,{kakaoJsKey:jsKey});
    if(req.method==='GET'&&url.pathname==='/health')return json(req,res,200,{configured:!!key});
    if(req.method!=='POST'||url.pathname!=='/route')return json(req,res,404,{error:'요청 주소를 확인해 주세요.'});
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return json(req,res,415,{error:'JSON 요청이 필요해요.'});
    if(!key)return json(req,res,503,{error:'REST API 키 연결이 필요해요. 설정에서 이동시간 연결을 열어 주세요.',code:'SETUP_REQUIRED'});
    const input=JSON.parse(await body(req));if(!validRouteInput(input))return json(req,res,400,{error:'이동수단과 두 장소의 좌표를 확인해 주세요.'});
    if(Date.now()-windowStart>60000){windowStart=Date.now();count=0;}if(++count>60)return json(req,res,429,{error:'조회가 많아요. 잠시 후 다시 시도해 주세요.'});
    const response=await fetch(providerRequest(input),{headers:{Authorization:`KakaoAK ${key}`},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)return json(req,res,response.status===429?429:502,{error:response.status===429?'카카오 조회 한도에 도달했어요.':'카카오 길찾기 응답을 받지 못했어요. REST API 키와 사용 설정을 확인해 주세요.'});
    const result=normalizeRoute(input.mode,await response.json());if(!result)return json(req,res,404,{error:'해당 이동수단으로 가능한 경로를 찾지 못했어요.'});return json(req,res,200,result);
  }catch(error){
    const status=error instanceof SyntaxError?400:error.status===413?413:500;
    return json(req,res,status,{error:status===400?'요청 형식을 확인해 주세요.':status===413?'요청 내용이 너무 커요.':'이동시간 조회를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'});
  }
});
server.maxRequestsPerSocket=100;
server.setTimeout(15000,socket=>socket.destroy());
server.listen(port,'127.0.0.1',()=>console.log(`BT 이동시간 개발 서버: http://127.0.0.1:${port}/setup (키 ${key?'설정됨':'연결 전'})`));
