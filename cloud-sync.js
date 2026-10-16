/* 健身助手 V91 · optional cloud sync. No writes until verified login and explicit initial pairing.
   Supabase Auth JWT + RLS + atomic revision CAS; each device keeps own local records. */
(function(){
"use strict";
const cfg=window.FITNESS_CLOUD_CONFIG||{};
const enabled=typeof cfg.url==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&
 typeof cfg.anonKey==="string"&&cfg.anonKey.length>=16;
const SESSION="fitnessCloudAuth-v1",BASE="fitnessCloudBaseline-v1:",URL=enabled?cfg.url:"",KEY=enabled?cfg.anonKey:"";
const OMIT=new Set(["ckAppBuild","ckWeeklyReportLogicVersion","ckLastManualBackup","ckLastRestoreAt","ckWidgetScriptName"]);
let session=null,revision=0,baseline=null,state="disabled",busy=false,alarm=null, lastError="",lastSync=0;
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
 else if(state==="ready")setMessage("已连接云端 · 自动同步中"+(lastSync?" · 最近 "+new Date(lastSync).toLocaleTimeString():""));
 else if(state==="review")setMessage(lastError&&lastError!=="conflict"?"同步操作失败："+lastError:lastError==="conflict"?"检测到两处设备数据冲突，已暂停自动同步。请先备份并确认采用哪份记录。":
  revision>0?"云端已有记录，本机也有不同数据；为保护历史记录，需要选择数据来源。":"云端尚无记录，请先从保存真实数据的桌面版上传。");
 else if(state==="auth")setMessage(lastError?"登录失败："+lastError:"使用相同账号登录桌面版与浏览器版，先在有真实记录的桌面版上传。");
 else if(state==="pendingVerification")setMessage("注册已提交，请检查邮箱并完成验证，随后返回健身助手登录。不会自动上传或清除本机记录。");
 else if(state==="error")setMessage("连接暂时中断，未覆盖本机数据："+lastError);
}
async function request(path,{method="GET",body=null,token=null}={}){
 const headers={"apikey":KEY};
 if(token)headers.Authorization="Bearer "+token;
 if(body!==null)headers["Content-Type"]="application/json";
 const res=await fetch(URL+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:"no-store"});
 let parsed=null;try{parsed=await res.json()}catch(_){}
 if(!res.ok){
  const msg=String(parsed?.message||parsed?.error_description||parsed?.error||parsed?.hint||"网络或授权错误");
  const e=new Error(msg.slice(0,200));e.code=parsed?.code||"";e.status=res.status;throw e;
 }
 return parsed;
}
function storeSession(){try{if(session)localStorage.setItem(SESSION,JSON.stringify(session));else localStorage.removeItem(SESSION)}catch(_){}}
function loadBaseline(){
 const x=(()=>{try{return JSON.parse(localStorage.getItem(BASE+session.id)||"null")}catch(_){return null}})();
 if(!x||!Number.isInteger(x.revision)||x.revision<=0||!x.data||typeof x.data!=="object")return null;
 return x;
}
function saveBaseline(rev,data){
 revision=rev;baseline=structuredClone(data);
 try{localStorage.setItem(BASE+session.id,JSON.stringify({revision:rev,data:baseline}))}catch(_){}
}
async function refreshAuth(){
 if(!session)return false;
 if(session.expires>Date.now()+60000)return true;
 try{
  const data=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:session.refresh}});
  if(!data.access_token||!data.refresh_token)throw Error("会话已过期");
  session={id:data.user.id,email:data.user.email,access:data.access_token,refresh:data.refresh_token,
   expires:Date.now()+(data.expires_in||3600)*1000};
  storeSession();return true;
 }catch(e){session=null;storeSession();state="auth";lastError=errorMessage(e);show();return false}
}
async function authCall(route,body){
 const data=await request(route,{method:"POST",body});
 if(!data.access_token)return false;
 session={id:data.user.id,email:data.user.email,access:data.access_token,refresh:data.refresh_token,
  expires:Date.now()+(data.expires_in||3600)*1000};
 storeSession();return true;
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
 safety();
 const current=snapshot();
 // CK settings not in the sync set (widget-name, local backups) remain intact.
 for(const k of Object.keys(current))if(!Object.hasOwn(data,k))localStorage.removeItem(k);
 for(const [k,v] of Object.entries(data))if(eligible(k)&&typeof v==="string")localStorage.setItem(k,v);
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
  const ok=await authCall(kind==="register"?"/auth/v1/signup":"/auth/v1/token?grant_type=password",
   kind==="register"?{email,password,options:{email_redirect_to:location.origin+"/"}}:{email,password});
  if($("fitnessCloudPassword"))$("fitnessCloudPassword").value="";
  if(ok){lastError="";state="auth";await connect();}
  else{state="pendingVerification";lastError="";}
 }catch(e){state="auth";lastError=errorMessage(e)}
 finally{busy=false;show()}
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
 session=null;storeSession();state="auth";revision=0;baseline=null;show();
}
async function retry(){
 if(!session||busy)return;try{await connect()}catch(e){lastError=errorMessage(e);state="error";show()}
}
async function initial(){
 if(!enabled){state="disabled";show();return}
 state="auth";
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(SESSION)||"null")}catch(_){return null}})();
 if(saved?.access&&saved?.refresh&&saved?.id){
  session=saved;
  try{await connect()}catch(e){lastError=errorMessage(e);state="error"}
 }
 show();
 alarm=setInterval(()=>{if(state==="ready")void tick();else if(state==="error")void retry()},12000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state==="ready")void tick()});
}
window.FitnessCloudSync={login,upload,download,logout,retry,enabled,
 status:()=>({state,revision,lastError,lastSync})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{void initial()});
else void initial();
})();