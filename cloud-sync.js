/* 健身助手 V93 · resilient login persistence and offline-safe refresh. No writes until verified login and explicit initial pairing.
   Supabase Auth JWT + RLS + atomic revision CAS; each device keeps own local records. */
(function(){
"use strict";
const cfg=window.FITNESS_CLOUD_CONFIG||{};
const enabled=typeof cfg.url==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&
 typeof cfg.anonKey==="string"&&cfg.anonKey.length>=16;
const SESSION="fitnessCloudAuth-v1",BASE="fitnessCloudBaseline-v1:",URL=enabled?cfg.url:"",KEY=enabled?cfg.anonKey:"";
const OMIT=new Set(["ckAppBuild","ckWeeklyReportLogicVersion","ckLastManualBackup","ckLastRestoreAt","ckWidgetScriptName"]);
let session=null,revision=0,baseline=null,state="disabled",busy=false,alarm=null, lastError="",lastErrorCode="",lastSync=0;
let refreshFlight=null,persistenceWarn=false;
const AUTH_CACHE_DB="fitnessCloudSessionBackup",AUTH_CACHE_STORE="auth";
function validSession(v){
 return !!(v&&typeof v==="object"&&typeof v.id==="string"&&typeof v.access==="string"&&
  typeof v.refresh==="string"&&Number.isFinite(v.expires)&&v.expires>0);
}
/* IndexedDB is a same-origin fallback if Safari accepts sign-in but fails to
   retain its localStorage record. Both stores are local to each browser context:
   neither crosses private/isolated Scriptable sessions. */
function sessionIdb(op,value){
 return new Promise(resolve=>{
  try{
   const engine=window.indexedDB;
   if(!engine)return resolve(op==="read"?null:false);
   const request=engine.open(AUTH_CACHE_DB,1);
   request.onupgradeneeded=()=>{try{const db=request.result;if(!db.objectStoreNames.contains(AUTH_CACHE_STORE))db.createObjectStore(AUTH_CACHE_STORE)}catch(_){}};
   request.onerror=()=>resolve(op==="read"?null:false);
   request.onsuccess=()=>{
    const db=request.result;
    try{
     const tx=db.transaction(AUTH_CACHE_STORE,op==="read"?"readonly":"readwrite");
     const store=tx.objectStore(AUTH_CACHE_STORE);
     const action=op==="read"?store.get("current"):op==="remove"?store.delete("current"):store.put(value,"current");
     action.onsuccess=()=>{if(op==="read"){db.close();resolve(validSession(action.result)?action.result:null)}};
     action.onerror=()=>{db.close();resolve(op==="read"?null:false)};
     if(op!=="read"){
      tx.oncomplete=()=>{db.close();resolve(true)};
      tx.onerror=()=>{db.close();resolve(false)};
      tx.onabort=()=>{db.close();resolve(false)};
     }
    }catch(_){db.close();resolve(op==="read"?null:false)}
   };
  }catch(_){resolve(op==="read"?null:false)}
 });
}
async function storeSession(){
 let localOk=false;
 try{
  if(session){localStorage.setItem(SESSION,JSON.stringify(session));localOk=validSession(JSON.parse(localStorage.getItem(SESSION)||"null"))}
  else{localStorage.removeItem(SESSION);localOk=localStorage.getItem(SESSION)===null}
 }catch(_){}
 const backupOk=await sessionIdb(session?"write":"remove",session);
 if(session)persistenceWarn=!(localOk||backupOk);
 else persistenceWarn=false;
 return localOk||backupOk;
}
async function readSavedSession(){
 let local=null;
 try{local=JSON.parse(localStorage.getItem(SESSION)||"null")}catch(_){}
 if(validSession(local))return local;
 const backup=await sessionIdb("read");
 if(validSession(backup)){
  try{localStorage.setItem(SESSION,JSON.stringify(backup))}catch(_){}
  return backup;
 }
 return null;
}
const $=id=>document.getElementById(id);
function eligible(k){return /^ck[A-Za-z0-9_-]{0,120}$/.test(k)&&!k.startsWith("ckUpgradeBackup-")&&!OMIT.has(k)}
function snapshot(){
 const out={}; for(let i=0;i<localStorage.length;i++){
  const k=localStorage.key(i);if(eligible(k)){const v=localStorage.getItem(k);if(typeof v==="string")out[k]=v}
 }return out;
}
function canonical(v){return JSON.stringify(Object.keys(v||{}).sort().map(k=>[k,v[k]]))}
function equal(a,b){return canonical(a)===canonical(b)}
function count(v){return Object.keys(v||{}).length}
function setMessage(message){const node=$("fitnessCloudStatus");if(node)node.textContent=message}
function errorMessage(e){return String(e&&e.message||e||"未知错误").slice(0,190)}
function show(){
 const ready=!!session&&state==="ready";const link=!!session;
 const auth=$("fitnessCloudAuth"),pending=$("fitnessCloudChoices"),info=$("fitnessCloudIdentity");
 if(auth)auth.hidden=link;if(info)info.hidden=!link;
 if($("fitnessCloudLoginName"))$("fitnessCloudLoginName").textContent=session?.email||"";
 if(pending)pending.hidden=!(link&&state==="review");
 if($("fitnessCloudUpload"))$("fitnessCloudUpload").hidden=!(state==="review"&&(!revision||lastError==="conflict"));
 if($("fitnessCloudDownload"))$("fitnessCloudDownload").hidden=!(state==="review"&&revision>0);
 if($("fitnessCloudRefresh"))$("fitnessCloudRefresh").hidden=!link;
 if(!enabled)setMessage("安全云同步尚未配置。原有本机记录和小组件照常使用。");
 else if(state==="checking")setMessage("正在核对本机与云端记录，暂不修改任何历史数据…");
 else if(state==="ready")setMessage("已连接云端 · 自动同步中"+(lastSync?" · 最近 "+new Date(lastSync).toLocaleTimeString():"")+
 (persistenceWarn?" · 当前浏览器无法可靠保存登录，请用普通 Safari 打开本站检查隐私浏览模式。":""));
 else if(state==="review")setMessage(lastError&&lastError!=="conflict"?"同步操作失败："+lastError:lastError==="conflict"?"检测到两处设备数据冲突，已暂停自动同步。请先备份并确认采用哪份记录。":
  revision>0?"云端已有记录，本机也有不同数据；为保护历史记录，需要选择数据来源。":"云端尚无记录，请先从保存真实数据的桌面版上传。");
 else if(state==="auth")setMessage(lastError?"登录失败："+lastError:"使用相同账号登录桌面版与浏览器版，先在有真实记录的桌面版上传。");
 else if(state==="pendingVerification")setMessage("注册已提交，确认邮件已申请发送。请检查收件箱及垃圾邮件，验证后返回登录；不要反复点击注册。");
 else if(state==="resendDone")setMessage("已申请重新发送验证邮件。请稍后检查收件箱和垃圾邮件；频繁发送会受到限制。");
 else if(state==="error")setMessage("连接暂时中断，未覆盖本机数据："+lastError);
}
async function request(path,{method="GET",body=null,token=null}={}){
 const headers={"apikey":KEY};
 if(token)headers.Authorization="Bearer "+token;
 if(body!==null)headers["Content-Type"]="application/json";
 const res=await fetch(URL+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:"no-store"});
 let parsed=null;try{parsed=await res.json()}catch(_){}
 if(!res.ok){
  const code=String(parsed?.code||parsed?.error_code||"");
  const raw=String(parsed?.message||parsed?.msg||parsed?.error_description||parsed?.error||parsed?.hint||"");
  const msg=authErrorMessage(code,raw,res.status);
  const e=new Error(msg.slice(0,200));e.code=code;e.status=res.status;throw e;
 }
 return parsed;
}
function authErrorMessage(code,raw,status){
 if(code==="email_not_confirmed"||/email not confirmed|email not verified/i.test(raw))return "邮箱还没有完成验证，请检查确认邮件（含垃圾邮件），验证后再登录。";
 if(code==="invalid_credentials"||/invalid login credentials/i.test(raw))return "邮箱或密码不正确。若刚注册，请先完成邮箱验证；不要重复注册。";
 if(code==="over_email_send_rate_limit"||code==="email_rate_limit_exceeded"||status===429)return "请求过于频繁，邮件发送暂时受限。请等待一段时间，查看之前收到的验证邮件，勿连续重试。";
 if(code==="email_exists"||/already registered/i.test(raw))return "此邮箱已经注册。请返回登录，或先完成邮件验证。";
 if(status===401||status===403)return raw||"账号尚未通过验证或授权，请检查邮箱和登录信息。";
 return raw||("服务器返回 HTTP "+status+"，暂时无法登录，请稍后重试。");
}
function loadBaseline(){
 const x=(()=>{try{return JSON.parse(localStorage.getItem(BASE+session.id)||"null")}catch(_){return null}})();
 if(!x||!Number.isInteger(x.revision)||x.revision<=0||!x.data||typeof x.data!=="object")return null;
 return x;
}
function saveBaseline(rev,data){
 revision=rev;baseline=structuredClone(data);
 try{localStorage.setItem(BASE+session.id,JSON.stringify({revision:rev,data:baseline}))}catch(_){}
}
function invalidRefresh(e){
 const c=String(e?.code||"").toLowerCase(),msg=String(e?.message||"").toLowerCase();
 return ["refresh_token_not_found","invalid_refresh_token","invalid_grant","session_not_found","session_expired"].includes(c)||
  ((e?.status===400||e?.status===401)&&/invalid refresh token|refresh token not found|refresh token already used|session not found/.test(msg));
}
async function refreshAuth(){
 if(!session)return false;
 if(session.expires>Date.now()+60000)return true;
 if(refreshFlight)return refreshFlight;
 const current=session;
 refreshFlight=(async()=>{
  try{
   const data=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:current.refresh}});
   if(!data.access_token||!data.refresh_token)throw Error("云端没有返回有效的续期凭据");
   // Keep previously verified account identity if refresh response omits user.
   session={id:data.user?.id||current.id,email:data.user?.email||current.email,
    access:data.access_token,refresh:data.refresh_token,
    expires:Date.now()+(data.expires_in||3600)*1000};
   await storeSession();lastError="";
   return true;
  }catch(e){
   // Another tab may have rotated the refresh token while this one was suspended.
   const newer=await readSavedSession();
   if(newer&&newer.refresh!==current.refresh&&newer.id===current.id){
    session=newer;return true;
   }
   if(invalidRefresh(e)){
    session=null;
    await storeSession();
    state="auth";lastError="登录会话已失效，请重新登录一次。";show();
   }else{
    // Temporary VPN/network failure is NOT a logout. Retry automatically when
    // connection returns; the last valid refresh token stays on-device.
    state="error";
    lastError="网络暂时不可用，已保留登录状态，恢复网络后将自动重试："+errorMessage(e);
    show();
   }
   return false;
  }
 })();
 try{return await refreshFlight}finally{refreshFlight=null}
}
async function authCall(route,body){
 const data=await request(route,{method:"POST",body});
 if(!data.access_token)return false;
 session={id:data.user.id,email:data.user.email,access:data.access_token,refresh:data.refresh_token,
  expires:Date.now()+(data.expires_in||3600)*1000};
 await storeSession();return true;
}
async function readCloud(){
 if(!await refreshAuth())throw Error("登录已过期，请重新登录");
 const rows=await request("/rest/v1/fitness_sync_snapshots?select=snapshot,revision,updated_at&limit=1",{
  token:session.access});
 return Array.isArray(rows)&&rows[0]?rows[0]:null;
}
async function writeCloud(data,expected){
 if(!await refreshAuth())throw Error("登录已过期");
 const r=await request("/rest/v1/rpc/fitness_sync_save",{method:"POST",token:session.access,
  body:{p_snapshot:data,p_expected:expected}});
 if(!Array.isArray(r)||!r[0]?.new_revision)throw Error("云端未返回保存版本");
 return Number(r[0].new_revision);
}
function safety(){
 if(typeof createSafetySnapshot!=="function")throw Error("安全快照不可用，已取消操作");
 const id=createSafetySnapshot("before-fitness-cloud-restore");
 if(!id)throw Error("本机备份失败，已取消恢复以保护原有记录");
 return id;
}
function applyCloud(data,rev){
 if(!data||typeof data!=="object"||Array.isArray(data)||!Number.isInteger(rev)||rev<1||
   Object.entries(data).some(([k,v])=>!eligible(k)||typeof v!=="string"))
  throw Error("云端记录格式校验失败，已拒绝恢复");
 safety(); // Full original is captured before any mutation.
 const current=snapshot();
 try{
  // CK settings not in the sync set (widget-name, local backups) remain intact.
  for(const k of Object.keys(current))if(!Object.hasOwn(data,k))localStorage.removeItem(k);
  for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);
 }catch(e){
  // localStorage writes are not transactional: restore original in-memory
  // records best-effort if a write ever fails; never mark cloud as adopted.
  try{
   for(const k of Object.keys(snapshot()))if(!Object.hasOwn(current,k))localStorage.removeItem(k);
   for(const [k,v] of Object.entries(current))localStorage.setItem(k,v);
  }catch(_){}
  throw Error("恢复过程中本机存储写入失败，已停止并尝试回滚；恢复前安全快照仍保留");
 }
 saveBaseline(rev,data);
 state="ready";lastSync=Date.now();show();
 location.reload(); // In-memory meals, training and weight must be reconstructed from new storage.
}
async function connect(){
 if(!session)return;
 state="checking";show();
 const remote=await readCloud(),local=snapshot();
 const saved=loadBaseline();
 if(!remote){
  if(!count(local)){state="ready";revision=0;baseline={};lastSync=Date.now()}
  else {state="review";revision=0;baseline=null}
 }else{
  revision=Number(remote.revision);
  const cloud=remote.snapshot||{};
  if(equal(cloud,local)){saveBaseline(revision,local);state="ready";lastSync=Date.now()}
  else if(saved&&saved.revision===revision&&equal(saved.data,cloud)){
   // Previously paired device has only local edits, safe to CAS upload.
   baseline=cloud;state="ready";await tick(true);return;
  }else if(saved&&equal(saved.data,local)&&saved.revision<revision){
   // Previously paired device is unchanged; remote-only update is safe to import.
   applyCloud(cloud,revision);return;
  }else {
   state="review";lastError="conflict";
   baseline=saved?saved.data:null;
  }
 }
 show();
}
async function tick(force=false){
 if(!session||state!=="ready"||busy||(!force&&document.visibilityState==="hidden"))return;
 busy=true;
 try{
  const remote=await readCloud(),local=snapshot(),cloud=remote?.snapshot||{},rev=remote?.revision||0;
  const localChanged=!equal(local,baseline||{});
  const remoteChanged=rev!==revision;
  if(remoteChanged&&localChanged){
   state="review";lastError="conflict";revision=rev;show();return;
  }
  if(remoteChanged){
   applyCloud(cloud,rev);return;
  }
  if(localChanged){
   const newRev=await writeCloud(local,rev);
   saveBaseline(newRev,local);
  }
  revision=revision||rev;lastSync=Date.now();state="ready";show();
 }catch(e){lastError=errorMessage(e);state=(e.code==="P0001"||lastError.includes("SYNC_CONFLICT"))?"review":"error";show()}
 finally{busy=false}
}
async function login(kind){
 if(!enabled||busy)return;
 const email=String($("fitnessCloudEmail")?.value||"").trim();
 const password=String($("fitnessCloudPassword")?.value||"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8)return setMessage("请输入有效邮箱及至少 8 位密码。");
 busy=true;state="checking";show();
 try{
  const signupPath="/auth/v1/signup?redirect_to="+encodeURIComponent(location.origin+"/");
  const ok=await authCall(kind==="register"?signupPath:"/auth/v1/token?grant_type=password",{email,password});
  if($("fitnessCloudPassword"))$("fitnessCloudPassword").value="";
  if(ok){lastError="";lastErrorCode="";state="auth";await connect();}
  else{state="pendingVerification";lastError="";lastErrorCode="";}
 }catch(e){state="auth";lastError=errorMessage(e);lastErrorCode=String(e.code||"")}
 finally{busy=false;show()}
}
/* Only a real click can request resend. Throttle across refreshes/devices locally,
   and let Supabase's server-side rate limit apply as well. No change to ck* data. */
async function resendVerification(){
 if(!enabled||busy)return;
 const email=String($("fitnessCloudEmail")?.value||"").trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return setMessage("请填写注册时使用的邮箱。");
 const key="fitnessCloudEmailResendAt";
 let previous=0;try{previous=Number(localStorage.getItem(key)||0)}catch(_){}
 const diff=Date.now()-previous;
 if(previous&&diff<90000)return setMessage("已发送过验证请求，请等待约 "+Math.ceil((90000-diff)/1000)+" 秒再尝试，优先检查邮件。");
 busy=true;state="checking";show();
 try{
  await request("/auth/v1/resend?redirect_to="+encodeURIComponent(location.origin+"/"),
   {method:"POST",body:{type:"signup",email}});
  try{localStorage.setItem(key,String(Date.now()))}catch(_){}
  state="resendDone";lastError="";lastErrorCode="";
 }catch(e){
  state="auth";lastError=errorMessage(e);lastErrorCode=String(e.code||"");
 }finally{busy=false;show()}
}
async function upload(){
 if(!session||busy||state!=="review")return;
 if(!confirm("将本机当前记录保存到云端。若云端已有数据，可能覆盖该账号的原有记录。请确认已先导出完整备份。继续吗？"))return;
 busy=true;
 try{
  const remote=await readCloud(),local=snapshot(),rev=remote?.revision||0;
  if(!count(local))throw Error("本机没有可上传的记录");
  if(remote&&!confirm("云端已有 "+count(remote.snapshot)+" 项记录，此操作会替换云端版本。确定以本机记录为准吗？"))return;
  // Local snapshot always taken before a manual reconciliation.
  safety();
  const newRev=await writeCloud(local,rev);
  saveBaseline(newRev,local);state="ready";lastError="";lastSync=Date.now();
 }catch(e){lastError=errorMessage(e);state="review"}
 finally{busy=false;show()}
}
async function download(){
 if(!session||busy||state!=="review")return;
 if(!confirm("准备把云端记录恢复到这个设备。当前设备数据会先自动保留恢复前快照。继续吗？"))return;
 busy=true;
 try{
  const remote=await readCloud();if(!remote)throw Error("云端暂无记录");
  applyCloud(remote.snapshot,Number(remote.revision));
 }catch(e){lastError=errorMessage(e);state="review";show()}
 finally{busy=false}
}
async function logout(){
 if(!session)return;
 if(!confirm("退出此设备的云同步账号？本机记录将完整保留。"))return;
 session=null;await storeSession();state="auth";revision=0;baseline=null;show();
}
async function retry(){
 if(!session||busy)return;try{await connect()}catch(e){lastError=errorMessage(e);state="error";show()}
}
async function initial(){
 if(!enabled){state="disabled";show();return}
 state="auth";
 const saved=await readSavedSession();
 if(saved?.access&&saved?.refresh&&saved?.id){
  session=saved;
  try{await connect()}catch(e){lastError=errorMessage(e);state="error"}
 }
 show();
 alarm=setInterval(()=>{if(state==="ready")void tick();else if(state==="error")void retry()},12000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state==="ready")void tick()});
}
window.FitnessCloudSync={login,resendVerification,upload,download,logout,retry,enabled,
 status:()=>({state,revision,lastError,lastSync,persistenceWarn,hasSession:!!session})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{void initial()});
else void initial();
})();