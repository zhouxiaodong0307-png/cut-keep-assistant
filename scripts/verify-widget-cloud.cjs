// V94 end-to-end Scriptable in-app model simulation with read-only cloud capability.
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const source=fs.readFileSync(path.join(__dirname,"../widgets/cut-keep-scriptable.js"),"utf8");
const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261017_widget_automatic_private.sql"),"utf8");
assert(sql.includes("extensions.gen_random_bytes(32)"));
assert(sql.includes("token_hash")&&sql.includes("expires_at>now()"));
assert(sql.includes("revoke all on public.fitness_widget_access from public,anon,authenticated"));
assert(sql.includes("grant execute on function public.fitness_widget_read(text) to anon,authenticated"));
assert(sql.includes("fitness_widget_pair")&&sql.includes("fitness_widget_revoke")&&sql.includes("fitness_widget_touch"));
const store=new Map(),events=[];
let clipboard="",cloudKcal=1550,cloudToken="a".repeat(64),backendOnline=true,requestCount=0,denied=false;
const day=new Date().toLocaleDateString("en-CA");
const makeSnapshot=(k=cloudKcal)=>({app:"cut-keep-widget",version:1,date:day,syncedAt:new Date().toISOString(),
 weight:{latest:76.3,goal:70,remaining:6.3},
 training:{kind:"cardio",title:"Zone 2 骑车",done:null,total:null},
 nutrition:{kcal:k,kcalGoal:2250,protein:35,proteinGoal:155}});
function node(){return{backgroundColor:null,cornerRadius:0,spacing:0,layoutHorizontally(){},layoutVertically(){},
 centerAlignContent(){},setPadding(){},addSpacer(){},addStack:node,addText(s){events.push(String(s));return{font:null,textColor:null,lineLimit:0,minimumScaleFactor:0}}}}
class ListWidget extends node{
 constructor(){super();this.url=null}
 async presentSmall(){}
 async presentMedium(){}
}
class Alert{
 addAction(){}
 async presentAlert(){events.push(this.title)}
}
class Color{constructor(x){this.hex=x}}
class Request{
 constructor(url){this.url=url;this.response={statusCode:200}}
 async loadJSON(){
  requestCount++;
  assert(this.url.endsWith("/rest/v1/rpc/fitness_widget_read"));
  assert.equal(this.method,"POST");
  assert(this.headers.apikey.startsWith("sb_publishable_"));
  const arg=JSON.parse(this.body);
  if(!backendOnline)throw Error("network offline");
  if(arg.p_token!==cloudToken||denied){
   this.response={statusCode:401};
   return{message:"WIDGET_UNAUTHORIZED"};
  }
  this.response={statusCode:200};
  return[{widget_summary:makeSnapshot(),widget_updated_at:new Date().toISOString()}];
 }
}
const device={
 FileManager:{local:()=>({documentsDirectory:()=>"/device",joinPath:(a,b)=>a+"/"+b,
 fileExists:k=>store.has(k),readString:k=>store.get(k),writeString:(k,v)=>store.set(k,v)})},
 Pasteboard:{pasteString:()=>clipboard,copyString:v=>{clipboard=v}},
 ListWidget,Alert,Color,Request,Font:{systemFont:()=>({}),boldSystemFont:()=>({})},
 Script:{setWidget:w=>{device.lastWidget=w},complete(){}},
 config:{runsInWidget:false,widgetFamily:"small"},args:{queryParameters:{mode:"pair"},widgetParameter:""}
};
const run=new AsyncFunction(...Object.keys(device).filter(k=>k!=="lastWidget"),source);
const launch=()=>run(...Object.keys(device).filter(k=>k!=="lastWidget").map(k=>device[k]));
(async()=>{
 clipboard=cloudToken;
 await launch();
 assert(store.has("/device/cut_keep_widget_cloud_v1.json"),"pair saves only private read token");
 assert.equal(JSON.parse(store.get("/device/cut_keep_widget_v1.json")).nutrition.kcal,1550);
 assert.equal(clipboard,"","clipboard must be cleared immediately after pairing");
 assert(events.includes("自动更新已开启"));
 const requestsAfterPair=requestCount;
 cloudKcal=1750;
 device.config.runsInWidget=true;device.args.queryParameters={};
 events.length=0;await launch();
 assert(requestCount>requestsAfterPair);
 assert.equal(JSON.parse(store.get("/device/cut_keep_widget_v1.json")).nutrition.kcal,1750);
 assert(events.some(x=>x.includes("1750 / 2250 kcal")));
 assert(events.includes("云端已更新")||events.includes("待更新"));
 const used=requestCount;
 backendOnline=false;events.length=0;await launch();
 assert(requestCount===used+1,"widget attempts backend fetch at each system-triggered refresh");
 assert.equal(JSON.parse(store.get("/device/cut_keep_widget_v1.json")).nutrition.kcal,1750,"offline must preserve last real snapshot");
 assert(events.some(x=>x.includes("1750 / 2250 kcal")));
 assert(events.includes("网络待同步")||events.includes("待更新"));
 backendOnline=true;
 const previous=store.get("/device/cut_keep_widget_cloud_v1.json");
 clipboard="f".repeat(64);device.args.queryParameters={mode:"pair"};device.config.runsInWidget=false;
 events.length=0;await launch();
 assert.equal(store.get("/device/cut_keep_widget_cloud_v1.json"),previous,"invalid pairing must not revoke working one");
 assert.equal(clipboard,"f".repeat(64),"failed pairing must not pretend success");
 assert(events.includes("配对未完成"));
 // No health data ever travels in the widget's URL or cloud request URL.
 assert.equal(device.lastWidget.url,"https://cut-keep-assistant.onrender.com/");
 assert(!source.includes("Authorization: Bearer "));
 assert(!source.includes("/fitness_sync_snapshots"));
 console.log("PASS: V94 real snapshot 1550→1750 auto refresh; one-time token, no passwords; cache offline; invalid/revoked pairing preserves old authorization; short widget read-only scope.");
})().catch(e=>{console.error(e);process.exitCode=1});
