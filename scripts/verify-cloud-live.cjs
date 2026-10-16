// Integration contract against the REAL dedicated Supabase project.
// Does not register users or insert records. Anon must never read/write health data.
const assert=require('node:assert/strict');
const base="https://ampixosqbgqbsckmrhog.supabase.co";
const publicKey="sb_publishable_IlVC6d5G7aZUaXxNr9wqNQ_RKmlkA5U";
async function check(method,path,body){
 const res=await fetch(base+path,{method,headers:{"apikey":publicKey,"Content-Type":"application/json",
  "Origin":"https://cut-keep-assistant.onrender.com"},body:body?JSON.stringify(body):undefined});
 const raw=await res.text();
 if(res.status===200||res.status===201||res.status===204)throw Error(
   "Unauthenticated health data request was allowed: "+method+" "+path+" status "+res.status+" body:"+raw.slice(0,150)
 );
 assert([400,401,403,404,405].includes(res.status),
  "Unexpected response from real project "+res.status+" "+raw.slice(0,180));
 return res.status;
}
(async()=>{
 const read=await check("GET","/rest/v1/fitness_sync_snapshots?select=user_id,snapshot,revision&limit=1");
 const write=await check("POST","/rest/v1/rpc/fitness_sync_save",{p_snapshot:{ckTest:"unauthenticated-should-reject"},p_expected:0});
 const info=await fetch(base+"/auth/v1/settings",{headers:{apikey:publicKey}});
 assert(info.ok,"Dedicated Auth API unavailable ("+info.status+")");
 console.log("PASS: real fitness Supabase live anonymous access denied for reads ("+read+") and writes ("+write+"); Auth API available; no test health records created.");
})().catch(e=>{console.error(e);process.exitCode=1});
