const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"cloud-sync.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const config=fs.readFileSync(path.join(root,"cloud-config.js"),"utf8");
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261016_fitness_cloud_snapshots.sql"),"utf8");
new vm.Script(js,{filename:"cloud-sync.js"});
assert(html.includes('id="fitnessCloudPanel"')&&html.includes('onclick="FitnessCloudSync.upload()"'));
assert(html.includes('<script defer src="./cloud-sync.js"></script>'));
assert(config.includes('url:""')&&config.includes('anonKey:""'));
assert(sql.includes('enable row level security')&&sql.includes('(select auth.uid()) = user_id'));
assert(sql.includes('revoke insert,update,delete')&&sql.includes('security definer')&&sql.includes('fitness_sync_save'));
assert(sql.includes('p_expected')&&sql.includes('where user_id=uid and revision=p_expected'));
assert(!sql.includes('service_role')&&!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
const cloud=new Map();
const accounts=new Map([['owner@example.com',{id:'user-1',email:'owner@example.com',password:'safe-password'}]]);
const calls=[];
let clock=1000;
const wait=()=>new Promise(r=>setImmediate(r));
function env(initial={},account='owner@example.com',configured=true){
 const data=new Map(Object.entries(initial)),elements=new Map(),messages=[],logs=[];
 for(const id of ["fitnessCloudStatus","fitnessCloudAuth","fitnessCloudChoices","fitnessCloudIdentity",
  "fitnessCloudEmail","fitnessCloudPassword","fitnessCloudLoginName","fitnessCloudRefresh","fitnessCloudUpload",
  "fitnessCloudDownload"]){
  elements.set(id,{value:"",textContent:"",hidden:false});
 }
 elements.get("fitnessCloudEmail").value=account;
 elements.get("fitnessCloudPassword").value="safe-password";
 let reload=0,snapshots=0;
 const localStorage={
  get length(){return data.size},
  key:i=>[...data.keys()][i]||null,
  getItem:k=>data.has(k)?data.get(k):null,
  setItem:(k,v)=>data.set(k,String(v)),
  removeItem:k=>data.delete(k)
 };
 const fetch=async(url,options={})=>{
  const endpoint=new URL(url),method=options.method||"GET";
  let body=options.body?JSON.parse(options.body):null;
  calls.push({path:endpoint.pathname,method,body:body&&endpoint.pathname==="/rest/v1/rpc/fitness_sync_save"?
    {expected:body.p_expected,keyCount:Object.keys(body.p_snapshot||{}).length}:null});
  if(endpoint.pathname==="/auth/v1/token"){
   if(endpoint.searchParams.get("grant_type")==="password"){
    const user=accounts.get(body.email);
    if(!user||user.password!==body.password)return response(400,{error:"Invalid login credentials"});
    return response(200,{access_token:"token-"+user.id,refresh_token:"refresh-"+user.id,expires_in:3600,user});
   }
   if(endpoint.searchParams.get("grant_type")==="refresh_token"){
    const user=[...accounts.values()].find(x=>"refresh-"+x.id===body.refresh_token);
    if(!user)return response(400,{error:"Invalid refresh"});
    return response(200,{access_token:"token-"+user.id,refresh_token:"refresh-"+user.id,expires_in:3600,user});
   }
  }
  if(endpoint.pathname==="/auth/v1/signup")return response(200,{user:{id:'pending',email:body.email}});
  const token=options.headers?.Authorization||"";
  const userId=token.startsWith("Bearer token-")?token.slice("Bearer token-".length):null;
  if(!userId)return response(401,{error:"Not authenticated"});
  if(endpoint.pathname==="/rest/v1/fitness_sync_snapshots"){
   const record=cloud.get(userId);
   return response(200,record?[{...record}]:[]);
  }
  if(endpoint.pathname==="/rest/v1/rpc/fitness_sync_save"){
   const row=cloud.get(userId),expected=body.p_expected;
   if((row?.revision||0)!==expected)return response(409,{message:"SYNC_CONFLICT",code:"P0001"});
   const d=body.p_snapshot;
   if(!d||Object.keys(d).some(k=>!/^ck[A-Za-z0-9_-]{0,120}$/.test(k)||k.startsWith("ckUpgradeBackup-")))
    return response(400,{error:"INVALID_RECORD"});
   cloud.set(userId,{snapshot:{...d},revision:expected+1,updated_at:new Date().toISOString()});
   return response(200,[{new_revision:expected+1,saved_at:new Date().toISOString()}]);
  }
  return response(404,{error:"Not found"});
 };
 function response(status,value){return{ok:status>=200&&status<300,status,json:async()=>value}}
 const doc={readyState:"complete",visibilityState:"visible",getElementById:id=>elements.get(id)||null,
 addEventListener:()=>{}};
 const context={window:{FITNESS_CLOUD_CONFIG:configured?{url:"https://test123.supabase.co",anonKey:"sb_publishable_testing_key"}:{}},
  document:doc,localStorage,fetch,console,
  Date:class FakeDate extends Date{static now(){return clock}},
  structuredClone,location:{reload:()=>reload++},confirm:()=>true,setInterval:()=>-1,
  createSafetySnapshot:()=>{snapshots++;return"backup-"+snapshots}};
 context.window.window=context.window;
 vm.runInNewContext(js,context,{filename:"cloud-sync.js"});
 return {app:context.window.FitnessCloudSync,data,messages,logs,elements,fetch,
   get reload(){return reload},get snapshots(){return snapshots},
   snapshot:()=>Object.fromEntries([...data].filter(([k])=>k.startsWith("ck")&&!k.startsWith("ckUpgradeBackup-"))),
   status:()=>context.window.FitnessCloudSync.status()};
}
(async()=>{
 const local={ckWeights:'[{"date":"2026-10-16","weight":77.2}]',
   'ckMeals-2026-10-16':'[{"kcal":1100}]','ckExerciseDone-2026-10-16':'{"热身":true,"器械推胸":true}',
   'ckTrain-2026-10-16':'1',ckGoalWeight:'70.0',ckWidgetScriptName:'脂保肌小组件'};
 const off=env(local,undefined,false);
 await wait();
 assert.equal(off.app.enabled,false);
 assert.equal(off.status().state,"disabled");
 assert.equal(off.data.get("ckTrain-2026-10-16"),"1");
 const phone=env(local);
 await wait();
 assert.equal(phone.status().state,"auth");
 await phone.app.login("login");
 assert.equal(phone.status().state,"review");
 assert.equal(cloud.size,0,"Logging in must NOT silently upload private health history");
 await phone.app.upload();
 assert.equal(phone.status().state,"ready");
 assert.equal(cloud.get("user-1").revision,1);
 assert.equal(cloud.get("user-1").snapshot["ckTrain-2026-10-16"],"1");
 assert(!Object.hasOwn(cloud.get("user-1").snapshot,"ckWidgetScriptName"));
 assert(!Object.hasOwn(cloud.get("user-1").snapshot,"fitnessCloudAuth-v1"));
 assert(phone.snapshots>=1,"Upload must take safety snapshot first");
 const browser=env({ckAppBuild:"V90"});
 await wait();
 await browser.app.login("login");
 assert.equal(browser.status().state,"review");
 assert.equal(browser.data.get("ckTrain-2026-10-16"),null);
 await browser.app.download();
 assert.equal(browser.reload,1);
 assert.equal(browser.data.get("ckTrain-2026-10-16"),"1");
 assert.equal(browser.data.get("ckMeals-2026-10-16"),'[{"kcal":1100}]');
 assert(browser.snapshots>=1,"Restore must backup original device before importing");
 const snapshotAfter=browser.snapshot();
 assert(!Object.hasOwn(snapshotAfter,"ckWidgetScriptName"));
 const next=env(Object.fromEntries(browser.data));
 await wait();
 assert.equal(next.status().state,"ready","Reload with persisted auth and baseline should pair safely");
 next.data.set("ckMeals-2026-10-16",'[{"kcal":1200}]');
 await next.app.retry();
 assert.equal(next.status().state,"ready");
 assert.equal(cloud.get("user-1").snapshot["ckMeals-2026-10-16"],'[{"kcal":1200}]');
 // Two devices editing the same base revision must not silently overwrite.
 const rival=env(Object.fromEntries(phone.data));
 await wait();
 assert.equal(rival.status().state,"ready");
 rival.data.set("ckWeights",'[{"date":"2026-10-16","weight":76.9}]');
 next.data.set("ckWeights",'[{"date":"2026-10-16","weight":77.0}]');
 await next.app.retry();
 assert.equal(cloud.get("user-1").snapshot.ckWeights,'[{"date":"2026-10-16","weight":77.0}]');
 await rival.app.retry();
 assert.equal(rival.status().state,"review","Conflicting device must pause");
 assert.equal(cloud.get("user-1").snapshot.ckWeights,'[{"date":"2026-10-16","weight":77.0}]');
 assert.equal(rival.data.get("ckWeights"),'[{"date":"2026-10-16","weight":76.9}]');
 assert.equal(rival.reload,0);
 assert.equal(rival.data.get("ckTrain-2026-10-16"),"1");
 // Sign-out is local and must not clear training data.
 await rival.app.logout();
 assert.equal(rival.data.get("ckTrain-2026-10-16"),"1");
 console.log("PASS: V91 cloud disabled-safe; login doesn't upload; first phone upload; browser restore+backup; future CAS; concurrent-conflict pause; logout preserves ck*.");
})().catch(e=>{console.error(e);process.exitCode=1});
