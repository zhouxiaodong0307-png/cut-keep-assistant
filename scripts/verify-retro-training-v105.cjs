const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
function segment(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,"missing "+start);return html.slice(a,b)}
const code=segment("/* V105: retrospectively reconcile a truly completed session","function syncTrainingCursor(){");
const shiftDate=(d,n)=>{let x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const dayDiff=(a,b)=>Math.max(0,Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/86400000));
const dateToday="2026-11-10";
const validIndex=[0,1,2,4,5];
function env({day="2026-11-09",index=2,current=index,kind="completed",minutes="",rpe="",todayStarted=false,manualChoice=null,existing={},confirmAnswer=true}={}){
 const store=new Map(Object.entries({"ckTrainingCursorIndex":String(current),"ckTrainingCursorDate":dateToday,
  ["ckTrainPlanIndex-"+day]:String(index),...existing})),alerts=[],confirmations=[];
 let refreshed=0;
 const inputs={
  retroTrainingDate:{value:day},retroTrainingIndex:{value:String(index)},
  retroTrainingStatus:{value:kind},retroRideMinutes:{value:minutes},retroRideRpe:{value:rpe},
  retroTrainingStatusText:{textContent:""},retroStrengthFields:{hidden:false},retroCardioFields:{hidden:false},retroAlignTodayBtn:{hidden:true,textContent:""}
 };
 const storage={getItem:key=>store.has(key)?store.get(key):null,setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)};
 const parse=k=>{try{return JSON.parse(storage.getItem(k)||"null")}catch(_){return null}};
 const ride=ds=>parse("ckRide-"+ds);
 const globals={
 localStorage:storage,document:{getElementById:id=>inputs[id]||null},localDate:()=>dateToday,
 shiftDate,dayDiff,readDayAdjustment:(ds=dateToday)=>ds===dateToday?manualChoice:null,
 trainingIndexForDate:ds=>{const v=storage.getItem("ckTrainPlanIndex-"+ds);return v===null?index:+v},
 trainingIndex:()=>Number(storage.getItem("ckTrainingCursorIndex")),
 planKind:idx=>[0,2,4].includes(idx)?"strength":[1,5].includes(idx)?"cardio":"rest",
 readActualWorkout:()=>null,hasExtraStrengthSession:()=>false,meaningfulPartialWorkout:()=>false,
 shouldPassOptionalCardio:()=>false,readPartialWorkout:()=>null,
 storedRide:ride,rideStorageKey:ds=>"ckRide-"+ds,
 readStartedExercisePlan:()=>todayStarted?{index,rows:[]}:null,
 exerciseDone:{},trainDone:todayStarted,confirm:prompt=>{confirmations.push(prompt);return confirmAnswer},
 alert:msg=>alerts.push(msg),refreshAfterDayChange:()=>{refreshed++},safeJsonParse:(raw,def)=>{try{return JSON.parse(raw||"null")||def}catch(_){return def}}
 };
 const mod=new Function(...Object.keys(globals),code+";return {saveRetroTraining,alignRetroTrainingToday,readRetroTraining,retroReplay,validRetroDate,renderRetroTrainingForm,updateRetroTrainingForm};")(...Object.values(globals));
 return {mod,store,storage,inputs,alerts,confirmations,get refreshed(){return refreshed}};
}
assert(html.includes('id="retroTrainingDetails"')&&html.includes("忘记打卡？补记过去训练并校准后续安排"),"UI is discoverable");
assert(/APP_BUILD="20261110-retroactive-training-repair-v105"/.test(html));
assert(!html.includes("localStorage.clear("));
let x=env();x.mod.saveRetroTraining();
assert.equal(x.alerts.length,0);assert.equal(x.refreshed,1);
assert.equal(x.storage.getItem("ckTrain-2026-11-09"),"1");
assert.equal(x.storage.getItem("ckTrainPlanIndex-2026-11-09"),"2");
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"3","Day3 completed yesterday → Day4 rest today");
assert.equal(x.storage.getItem("ckTrainPlanIndex-2026-11-10"),"3");
assert.equal(x.storage.getItem("ckExerciseDone-2026-11-09"),null,"never pretend all sets were checked");
assert.equal(x.storage.getItem("ckActualWorkout-2026-11-09"),null,"never fabricate exercise weight or reps");
assert.equal(x.storage.getItem("ckTrain-2026-11-10"),null,"today never marked complete");
assert.equal(x.mod.readRetroTraining("2026-11-09").kind,"strength");
assert(x.confirmations[0].includes("整堂"));
const before=new Map(x.store);x.mod.saveRetroTraining();assert(x.alerts.at(-1).includes("重复")||x.alerts.at(-1).includes("覆盖"));
assert.deepEqual([...x.store],[...before],"duplicate historical completion must be idempotently blocked");
x=env({day:"2026-11-09",index:1,current:1,minutes:"",rpe:""});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrain-2026-11-09"),null,"missing ride details never count as cardio");
assert(x.alerts.at(-1).includes("骑行"));
x=env({day:"2026-11-09",index:1,current:1,minutes:"45",rpe:"3"});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"2","recorded Day2 ride advances to Day3");
assert.equal(JSON.parse(x.storage.getItem("ckRide-2026-11-09")).minutes,45);
assert.equal(JSON.parse(x.storage.getItem("ckRide-2026-11-09")).rpe,3);
assert.equal(x.mod.readRetroTraining("2026-11-09").kind,"cardio");
x=env({day:"2026-11-09",index:0,current:0,kind:"partial"});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"1","partial session ends the stale schedule");
assert.equal(x.storage.getItem("ckTrain-2026-11-09"),null,"partial NEVER counts as fully completed strength");
assert.equal(x.mod.readRetroTraining("2026-11-09").status,"partial");
x=env({day:"2026-11-08",index:2,current:2});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"4","historical Day3→Day4 rest day→Day5 strength");
x=env({day:"2026-11-09",index:2,current:2,todayStarted:true});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"2","never replace current started strength training");
assert.equal(x.storage.getItem("ckTrain-2026-11-09"),"1","still accurately record the past session");
assert.equal(x.mod.readRetroTraining("2026-11-09").pendingTarget,null,"already-started current day must not offer realignment");
x=env({day:"2026-11-09",index:2,current:2,manualChoice:{choice:"next-strength",selectedIndex:4}});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"2","manual choice protected");
assert.equal(x.mod.readRetroTraining("2026-11-09").pendingTarget,3,"a user-approved realignment remains available");
x.mod.updateRetroTrainingForm();
assert.equal(x.inputs.retroAlignTodayBtn.hidden,false,"visible manual reconcile action when safe");
x.mod.alignRetroTrainingToday();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"3","explicit confirmation aligns a previously protected current day");
assert.equal(x.mod.readRetroTraining("2026-11-09").pendingTarget,null,"successful alignment clears pending action");
assert.equal(x.storage.getItem("ckTrain-2026-11-10"),null,"manual align does not mark today as trained");
x=env({day:"2026-11-09",index:2,current:2,existing:{"ckActualWorkout-2026-11-09":'{"status":"completed"}', "ckTrain-2026-11-09":"1"}});
x.mod.saveRetroTraining();assert.equal(x.storage.getItem("ckRetroTraining-2026-11-09"),null,"previously completed date must not be overwritten");
x=env({day:"2026-11-10"});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckRetroTraining-2026-11-10"),null,"cannot mark current day retrospectively");
x=env({day:"2026-10-15"});x.mod.saveRetroTraining();
assert.equal(x.storage.getItem("ckRetroTraining-2026-10-15"),null,"cannot change older than 21 days without history UI");
x=env({confirmAnswer:false});x.mod.saveRetroTraining();
assert.equal(x.store.size,3,"cancel must leave all records untouched");
console.log("PASS V105: strength/cardio/partial historical backfill, 2-day rest replay, no fake exercises or rides, duplicate protection, current/manual training protection, date bounds, cancel, progress repair.");
