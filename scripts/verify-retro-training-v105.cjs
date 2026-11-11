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
  retroTrainingStatusText:{textContent:""},retroStrengthFields:{hidden:false},retroCardioFields:{hidden:false},retroAlignTodayBtn:{hidden:true,textContent:""},retroAuditBtn:{hidden:true},retroSaveBtn:{hidden:false},retroRecordedPlan:{hidden:true,textContent:""}
 };
 const storage={getItem:key=>store.has(key)?store.get(key):null,setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)};
 const parse=k=>{try{return JSON.parse(storage.getItem(k)||"null")}catch(_){return null}};
 const ride=ds=>parse("ckRide-"+ds);
 const globals={
 localStorage:storage,document:{getElementById:id=>inputs[id]||null},localDate:()=>dateToday,
 shiftDate,dayDiff,readDayAdjustment:(ds=dateToday)=>ds===dateToday?manualChoice:null,
 dayAdjustmentKey:(ds=dateToday)=>"ckDayAdjustment-"+ds,
 dailyTrainingDecision:()=>({mode:"normal"}),
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
 const mod=new Function(...Object.keys(globals),code+";return {saveRetroTraining,alignRetroTrainingToday,readRetroTraining,retroReplay,validRetroDate,renderRetroTrainingForm,updateRetroTrainingForm,auditRecordedTraining,recordedRetroEvidence};")(...Object.values(globals));
 return {mod,store,storage,inputs,alerts,confirmations,get refreshed(){return refreshed}};
}
assert(!html.includes('id="retroTrainingDetails"'),"obsolete form removed; legacy records and API remain readable");
assert(/APP_BUILD="20261111-week-swipe-complete-v109"/.test(html));
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

// V106: an already-recorded ride is not a new workout; audit it separately.
const recordedRide=JSON.stringify({minutes:70,rpe:6,planIndex:1,completedAt:"2026-11-09T08:20:41.982Z"});
x=env({day:"2026-11-09",index:1,current:2,existing:{"ckTrain-2026-11-09":"1",
 "ckRide-2026-11-09":recordedRide}});
x.mod.updateRetroTrainingForm(true);
assert.equal(x.inputs.retroSaveBtn.hidden,true,"do not offer a duplicate backfill for completed cardio");
assert.equal(x.inputs.retroAuditBtn.hidden,false,"offer independent audit for existing session");
assert.equal(x.inputs.retroTrainingIndex.disabled,true,"existing session type is not editable");
assert.equal(x.inputs.retroTrainingIndex.hidden,true,"disabled select no longer displayed as a broken input");
assert.equal(x.inputs.retroRecordedPlan.hidden,false,"recorded plan displayed as clearly read-only content");
assert.match(x.inputs.retroRecordedPlan.textContent,/训练日2.*骑车.*已记录/,"compact recorded label");
assert.match(x.inputs.retroRecordedPlan.title,/70分钟/,"full existing record retained in title");
assert.match(x.inputs.retroTrainingStatusText.textContent,/70分钟/);
assert.match(x.inputs.retroTrainingStatusText.textContent,/RPE 6/);
const oldRide=x.storage.getItem("ckRide-2026-11-09");
const oldKeys=[...x.store.keys()];
x.mod.auditRecordedTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"2","Day2 cardio already yields Day3: don't move again");
assert.match(x.inputs.retroTrainingStatusText.textContent,/已经|已是训练日3/);
assert.equal(x.storage.getItem("ckRide-2026-11-09"),oldRide);
assert.deepEqual([...x.store.keys()],oldKeys,"no extra completion record generated on audit");
// If the user has not yet started today's plan and the cursor is genuinely stuck,
// a separate explicit confirmation corrects the plan but not the history.
x=env({day:"2026-11-09",index:1,current:1,existing:{"ckTrain-2026-11-09":"1","ckRide-2026-11-09":recordedRide}});
x.mod.auditRecordedTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"2","reconcile existing Day2 ride without a second completion");
assert.equal(x.storage.getItem("ckTrainPlanIndex-2026-11-10"),"2");
assert.equal(x.storage.getItem("ckRide-2026-11-09"),recordedRide);
assert.equal(x.storage.getItem("ckRetroTraining-2026-11-09"),null);
assert.equal(x.storage.getItem("ckActualWorkout-2026-11-09"),null);
assert.equal(x.confirmations.length,1,"must ask before changing today plan");
x=env({day:"2026-11-09",index:1,current:1,todayStarted:true,
 existing:{"ckTrain-2026-11-09":"1","ckRide-2026-11-09":recordedRide}});
x.mod.auditRecordedTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"1","already-started today's session remains protected");
assert.match(x.inputs.retroTrainingStatusText.textContent,/保护当前安排/);
x=env({day:"2026-11-09",index:1,current:1,manualChoice:{choice:"hold"},
 existing:{"ckTrain-2026-11-09":"1","ckRide-2026-11-09":recordedRide}});
x.mod.auditRecordedTraining();
assert.equal(x.storage.getItem("ckTrainingCursorIndex"),"1","manual hold remains protected");
assert.equal(x.confirmations.length,0);
x=env({day:"2026-11-09",index:2,current:2});
x.mod.updateRetroTrainingForm();
assert.equal(x.inputs.retroSaveBtn.hidden,false,"unrecorded day remains eligible for backfill");
assert.equal(x.inputs.retroTrainingIndex.hidden,false,"unrecorded day allows plan editing");
assert.equal(x.inputs.retroTrainingIndex.disabled,false,"unrecorded plan selection enabled");
assert.equal(x.inputs.retroRecordedPlan.hidden,true,"read-only label not shown for new backfill");
assert.equal(x.inputs.retroAuditBtn.hidden,true);
// V108: date selector must keep full ISO values despite compact labels;
 // initial render selects yesterday and corresponding known training index.
x=env({day:"2026-11-09",index:1,current:2});
x.inputs.retroTrainingDate.value="";
x.inputs.retroTrainingDate.dataset={};
x.mod.renderRetroTrainingForm();
assert.equal(x.inputs.retroTrainingDate.value,"2026-11-09","first load defaults to yesterday");
assert.equal(x.inputs.retroTrainingIndex.value,"1","known Day2 plan remains selected");
assert.match(x.inputs.retroTrainingDate.innerHTML,/<option value="2026-11-09">11月9日 · 昨天<\/option>/);
assert.equal((x.inputs.retroTrainingDate.innerHTML.match(/<option value=/g)||[]).length,21,"date choices are bounded to 21 days");
x.inputs.retroTrainingDate.value="2026-11-08";
x.mod.renderRetroTrainingForm();
assert.equal(x.inputs.retroTrainingDate.value,"2026-11-08","render preserves date user selected");
x.mod.updateRetroTrainingForm(true);
assert.equal(x.inputs.retroSaveBtn.hidden,false,"another date stays editable");

console.log("PASS V106 existing-session audit: actual ride shown, no double-count, aligned recovery explanation, stale cursor repair only with consent, started/manual protected.");

console.log("PASS V105: strength/cardio/partial historical backfill, 2-day rest replay, no fake exercises or rides, duplicate protection, current/manual training protection, date bounds, cancel, progress repair.");
