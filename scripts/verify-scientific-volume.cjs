const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const seg=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,"Missing "+a);return html.slice(i,j)};
const plans=new Function(seg("const planTemplates=","const coachLoads=")+";return planTemplates;")();
const parse=row=>{const m=String(row||"").match(/(\d+)组\s*×\s*(?:每侧)?(\d+)[–-](\d+)(次|秒)/);return m?{sets:+m[1],min:+m[2],max:+m[3],unit:m[4]}:null};
const valid=v=>v&&Number.isInteger(+v.sets)&&+v.sets>=1&&+v.sets<=8;
const apply=(row,v)=>row.replace(/\d+组\s*×\s*(每侧)?\d+[–-]\d+(次|秒)/,(m,side)=>v.sets+"组 × "+(side||"")+v.min+"–"+v.max+v.unit);
const a=seg("function adaptiveVolumeReference(row,dayIndex,isToday=true){","function applyExerciseVolumeToRow(");
const make=new Function("parseExerciseVolume","exerciseVolumeId","volumeSnapshots","exerciseDone","readTrainingVolumeJson","VOLUME_REFERENCE_KEY","lastVolumeResponses","phaseWeek","recovery","integratedTrainingDecision","rideAffectsLowerBody","validExerciseVolume",a+";return adaptiveVolumeReference;");
const adaptive=(opts={})=>make(parse,(idx,name)=>idx+"|"+name,{},opts.done||{},()=>opts.manual||{},"ckTrainingVolumeReferences",
 ()=>opts.fail?[{feedback:"fail",date:"2026-10-19"}]:[],()=>opts.week||1,{state:opts.poor?"poor":"ok"},
 ()=>({reduceLower:!!opts.ride}),name=>/深蹲|腿弯举|分腿蹲|硬拉/.test(name),valid);
let checks=0;
for(const idx of [0,2,4]){
 const base=plans[idx][3].map(row=>({row,v:parse(row)})).filter(o=>o.v);
 assert.equal(base.reduce((n,x)=>n+x.v.sets,0),({0:16,2:16,4:10})[idx]);
 for(const opts of [{},{week:4},{week:8,poor:true},{week:12,poor:true,ride:true,fail:true},{poor:true},{ride:true},{fail:true}]){
  const adapt=adaptive(opts);
  for(const {row,v} of base){
   const next=adapt(row,idx,true);checks++;
   assert(next.sets>=2,"auto reduced to "+next.sets+": "+row);
   assert(next.sets<=v.sets,"unexpected volume increase");
   assert(next.sets>=(v.sets===3?2:v.sets),"multiple reductions stacked");
  }
 }
}
assert.equal(adaptive({fail:true})("器械推胸｜2组 × 8–12次",0,true).sets,2);
assert.equal(adaptive({fail:true})("器械推胸｜2组 × 8–12次",0,true).max,11);
assert.equal(adaptive({poor:true,week:4,manual:{"4|平板哑铃飞鸟":{sets:1,min:10,max:15,unit:"次"}}})("平板哑铃飞鸟｜2组 × 10–15次",4,true).sets,1,"manual low sets must survive");
assert.equal(adaptive({poor:true,week:4,manual:{"4|杠铃卧推":{sets:4,min:6,max:8,unit:"次"}}})("杠铃卧推｜3组 × 6–8次",4,true).sets,4,"manual 4 sets must survive");
const readinessCode=seg("function applyDailyReadinessToPlans(plans,idx,ds=localDate()){","function dailyTrainingNutritionAdvice(");
const readiness=new Function("dailyTrainingDecision","basicsForDate","completedExtraActivity","readTrainingVolumeJson","VOLUME_REFERENCE_KEY","parseExerciseVolume","exerciseVolumeId","validExerciseVolume","planTemplates","applyExerciseVolumeToRow",readinessCode+";return applyDailyReadinessToPlans;")(
 ()=>({mode:"reduce",started:false,missed:false,userChoice:null}),()=>({sleep:7}),()=>[],()=>({}),"ckTrainingVolumeReferences",parse,
 (idx,name)=>idx+"|"+name,valid,plans,apply);
for(const idx of [0,2,4])for(const week of [1,4,8,12]){
 const fn=adaptive({week,poor:true});
 const day=plans.map((p,i)=>[p[0],p[1],p[2],p[3].map(row=>{
  const v=i===idx?fn(row,idx,true):null;return v?apply(row,v):row;
 })]);
 readiness(day,idx,"2026-10-27");
 for(const row of day[idx][3]){
  const v=parse(row);if(!v)continue;checks++;
  assert(v.sets>=2,"second recovery adjustment created 1 set: "+row);
 }
}
const marker="// Repair any pre-V97 one-set AUTO-reduced rows";
const i=html.indexOf(marker),j=html.indexOf(" return plans;",i);
assert(i>=0&&j>i,"Missing frozen in-progress protection");
const repair=new Function("idx","trainDone","plans","readTrainingVolumeJson","VOLUME_REFERENCE_KEY","parseExerciseVolume","exerciseVolumeId","exerciseDone","validExerciseVolume","planTemplates","applyExerciseVolumeToRow",html.slice(i,j)+"return plans;");
const day=plans.map(p=>[p[0],p[1],p[2],[...p[3]]]);
day[4][3]=["热身｜5分钟","杠铃卧推｜1组 × 6–8次","上斜哑铃卧推｜1组 × 8–12次","器械推胸｜1组 × 8–12次","平板哑铃飞鸟｜1组 × 10–15次"];
const kept=repair(4,false,day,()=>({"4|平板哑铃飞鸟":{sets:1,min:10,max:15,unit:"次"}}),"ckTrainingVolumeReferences",parse,(idx,name)=>idx+"|"+name,{"杠铃卧推":true,"上斜哑铃卧推":true},valid,plans,apply)[4][3].map(parse);
assert.equal(kept[1].sets,1,"finished bench snapshot must not change");
assert.equal(kept[2].sets,1,"finished incline snapshot must not change");
assert.equal(kept[3].sets,2,"pending one-set machine press should be corrected");
assert.equal(kept[4].sets,1,"manual one-set fly must remain as intentionally set");
assert(!html.includes("localStorage.clear("));
console.log("PASS V97: "+checks+" simulations covering all strength days, deload/recovery/ride/failure, manual priority, active/completed evidence isolation.");
