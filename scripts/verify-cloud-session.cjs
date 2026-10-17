const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const path=require("node:path"),root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"cloud-sync.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
new vm.Script(source,{filename:"cloud-sync.js"});
let clock=Date.now(),refreshes=0,transient=false,expirySeconds=3600;
const savedDb=new Map();
function indexedDB(){
 let exists=false;
 const database={
  objectStoreNames:{contains:()=>exists},
  createObjectStore(){exists=true},
  close(){},
  transaction(_name,mode){
   const tx={oncomplete:null,onerror:null,onabort:null,
    objectStore(){return{
     get(k){const req={result:savedDb.get(k),onsuccess:null,onerror:null};setImmediate(()=>req.onsuccess?.());return req},
     put(value,k){savedDb.set(k,JSON.parse(JSON.stringify(value)));setImmediate(()=>tx.oncomplete?.());return{}},
     delete(k){savedDb.delete(k);setImmediate(()=>tx.oncomplete?.());return{}}
    }}
   };
   return tx;
  }
 };
 return {open(){const req={result:database,onupgradeneeded:null,onsuccess:null,onerror:null};
  setImmediate(()=>{if(!exists)req.onupgradeneeded?.();req.onsuccess?.()});return req}};
}
const store=new Map([["ckWeights",'[{"date":"2026-10-17","weight":76.1}]'],
 ["ckTrain-2026-10-17","1"]]);
let storageBroken=false;
function storage(){
 return{get length(){return store.size},key:i=>[...store.keys()][i],
  getItem:k=>storageBroken&&k==="fitnessCloudAuth-v1"?null:store.has(k)?store.get(k):null,
  setItem(k,v){if(storageBroken&&k==="fitnessCloudAuth-v1")throw Error("Safari localStorage blocked");store.set(k,String(v))},
  removeItem(k){store.delete(k)}
 };
}
const elements=new Map();
for(const k of ["fitnessCloudStatus","fitnessCloudAuth","fitnessCloudChoices","fitnessCloudIdentity",
 "fitnessCloudEmail","fitnessCloudPassword","fitnessCloudLoginName","fitnessCloudRefresh","fitnessCloudUpload","fitnessCloudDownload"])
 elements.set(k,{hidden:false,textContent:"",value:""});
function http(status,result){return{ok:status>=200&&status<300,status,json:async()=>result}}
async function request(url,opts){
 const endpoint=new URL(url),payload=opts?.body?JSON.parse(opts.body):null;
 if(endpoint.pathname==="/auth/v1/token"){
  if(endpoint.searchParams.get("grant_type")==="password")
   return http(200,{access_token:"jwt0",refresh_token:"rt0",expires_in:expirySeconds,user:{id:"u1",email:"user@domain.test"}});
  if(endpoint.searchParams.get("grant_type")==="refresh_token"){
   refreshes++;
   if(transient){transient=false;return http(503,{message:"Temporary network/VPN interruption"})}
   return http(200,{access_token:"jwt"+refreshes,refresh_token:"rt"+refreshes,expires_in:3600,
    user:{id:"u1",email:"user@domain.test"}});
  }
 }
 if(endpoint.pathname==="/rest/v1/fitness_sync_snapshots")
  return http(200,[]);
 return http(404,{error:"Not found"});
}
const db=indexedDB();
function browser(){
 elements.get("fitnessCloudEmail").value="user@domain.test";
 elements.get("fitnessCloudPassword").value="password123";
 const win={FITNESS_CLOUD_CONFIG:{url:"https://test123.supabase.co",anonKey:"sb_publishable_for_testing_"},indexedDB:db};
 const globals={window:win,document:{readyState:"complete",visibilityState:"visible",getElementById:k=>elements.get(k),
   addEventListener(){}},localStorage:storage(),fetch:request,console,
  Date:class Clock extends Date{static now(){return clock}},
  structuredClone,location:{origin:"https://cut-keep-assistant.onrender.com",reload(){}},
  setInterval:()=>1,confirm:()=>true,createSafetySnapshot:()=>"saved"};
 vm.runInNewContext(source,globals,{filename:"cloud-sync.js"});
 return win.FitnessCloudSync;
}
async function settle(){for(let i=0;i<10;i++)await new Promise(done=>setImmediate(done))}
(async()=>{
 const first=browser();await settle();
 assert.equal(first.status().state,"auth");
 await first.login("login");await settle();
 assert.equal(first.status().state,"review");
 assert.equal(first.status().hasSession,true);
 assert(store.has("fitnessCloudAuth-v1"),"Normal Safari auth stored in localStorage");
 assert(savedDb.has("current"),"Independent Safari IndexedDB session backup stored");
 assert.equal(store.get("ckTrain-2026-10-17"),"1");
 // Reopening widget from the same Safari origin should not request password again.
 const reopened=browser();await settle();
 assert.equal(reopened.status().state,"review","Same-origin reopening must restore session");
 assert.equal(reopened.status().hasSession,true);
 // Even if localStorage session was evicted, same-origin IndexedDB restores it.
 store.delete("fitnessCloudAuth-v1");
 const restored=browser();await settle();
 assert.equal(restored.status().hasSession,true,"IndexedDB should restore auth without password");
 assert.equal(restored.status().state,"review");
 assert(store.has("fitnessCloudAuth-v1"));
 // Expired access token and short VPN outage must not destroy refresh credentials.
 clock+=3650000;
 transient=true;
 await restored.retry();await settle();
 assert.equal(restored.status().state,"error");
 assert.equal(restored.status().hasSession,true,"Temporary error must not log out");
 assert(store.has("fitnessCloudAuth-v1"),"Refresh token must stay durable during transient error");
 await Promise.all([restored.retry(),restored.retry()]);await settle();
 assert.equal(restored.status().hasSession,true);
 assert.equal(restored.status().state,"review");
 assert.equal(refreshes,2,"Simultaneous refresh should single-flight one refresh network call");
 const next=browser();await settle();
 assert.equal(next.status().state,"review","Rotated token must survive Safari relaunch");
 assert.equal(next.status().hasSession,true);
 // Safari localStorage being blocked must use IndexedDB without losing workout history.
 storageBroken=true;elements.get("fitnessCloudPassword").value="password123";
 const fallback=browser();await settle();
 assert.equal(fallback.status().hasSession,true);
 assert.equal(fallback.status().state,"review");
 assert.equal(fallback.status().persistenceWarn,false);
 assert.equal(store.get("ckTrain-2026-10-17"),"1");
 // Explicit sign-out clears BOTH stores but leaves health records untouched.
 await fallback.logout();await settle();
 assert(!savedDb.has("current"));
 assert.equal(store.get("ckTrain-2026-10-17"),"1");
 storageBroken=false;
 const afterLogout=browser();await settle();
 assert.equal(afterLogout.status().hasSession,false);
 assert.equal(afterLogout.status().state,"auth");
 assert(html.includes('cloud-sync.js'),"No change to health data UI path");
 console.log("PASS: V93 reopen auto-login; missing localStorage rescued by IndexedDB; transient failure retains refresh token; single-flight rotate; explicit logout clears auth only; health history preserved.");
})().catch(e=>{console.error(e);process.exitCode=1});
