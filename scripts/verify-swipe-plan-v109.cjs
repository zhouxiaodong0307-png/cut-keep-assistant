const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
function sec(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start,"missing "+a);return html.slice(start,end);}
assert(html.includes('APP_BUILD="20261111-fluid-week-swipe-v110"'));
assert(!html.includes('<details id="retroTrainingDetails"'),"obsolete backfill form is no longer shown");
assert(html.includes('class="weekSwipeAction')&&html.includes('class="weekSwipeSummary"'),"swipe action is inside the seven-day plan list");
assert(html.includes('installWeekSwipeGestures()'),"touch handlers are installed after the week renders");
const touchCode=sec("function installWeekSwipeGestures(){","function syncTrainingCursor(){");
assert(touchCode.includes("touchmove"),"finger tracking must react while dragging");
assert(touchCode.includes('touch.summary.style.transform="translateX("+offset+"px)"'),"card follows finger");
assert(touchCode.includes("if(dx<0){weekSwipeAnimate(touch.index,false);return}"),"left swipe animates one-touch completion");
assert(touchCode.includes("if(swipeCanUndo(touch.index)){weekSwipeAnimate(touch.index,true);return}"),"right swipe animates undo");
assert(touchCode.includes("Math.abs(dx)>=65"),"65px threshold avoids accidental completion during scrolling");

assert(html.includes('swipeStepLog(ds).some(x=>x.index===idx)'),"next-day replay recognizes swipe-completed current step");
assert(!html.includes("localStorage.clear("),"historical records never globally cleared");
const swipes=sec("/* V109: swipe confirmation advances the sequence","function syncTrainingCursor(){");
const nextDay=sec("function syncTrainingCursor(){","function trainingIndex(){");
const strengthSession=sec("function strengthSessionDates(){","function completedStrengthSessions(){");
const shiftDate=(ds,n)=>{const d=new Date(ds+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
function testApp({current=3,date="2026-11-11",existing={},started=false,hasRide=false}={}){
 const m=new Map(Object.entries({"ckTrainingCursorIndex":String(current),"ckTrainingCursorDate":date,
  ["ckTrainPlanIndex-"+date]:String(current),...existing})),alerts=[];let refreshes=0;
 const localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
  key:i=>[...m.keys()][i],get length(){return m.size}};
 const stubs={
  localStorage,localDate:()=>date,shiftDate,
  safeJsonParse:(raw,def)=>{try{return raw===null?def:JSON.parse(raw)}catch(_){return def}},
  trainingIndex:()=>Number(localStorage.getItem("ckTrainingCursorIndex")),
  trainingIndexForDate:ds=>Number(localStorage.getItem("ckTrainPlanIndex-"+ds)??current),
  planKind:i=>[0,2,4].includes(i)?"strength":[1,5].includes(i)?"cardio":"rest",
  readActualWorkout:()=>null,storedRide:()=>hasRide?{minutes:45,rpe:3}:null,
  readStartedExercisePlan:()=>started?{}:null,exerciseDone:started?{卧推:true}:{},
  dayAdjustmentKey:(ds=date)=>"ckDayAdjustment-"+ds,readDayAdjustment:()=>null,
  refreshAfterDayChange:()=>{refreshes++},alert:t=>alerts.push(t),
  setTimeout:()=>{},document:{getElementById:()=>null}
 };
 const api=new Function(...Object.keys(stubs),swipes+
  ";return {swipeStepLog,swipeProgress,swipeCompleteWeekDay,swipeUndoWeekDay,swipeCanUndo,swipeRecentComplete};")(...Object.values(stubs));
 const sync=new Function(...Object.keys({...stubs,shouldPassOptionalCardio:()=>false,meaningfulPartialWorkout:()=>false,
  hasExtraStrengthSession:()=>false,dayDiff:()=>0,trainingStartDate:"2026-10-15"}),swipes+nextDay+
  ";return syncTrainingCursor;")(...Object.values({...stubs,shouldPassOptionalCardio:()=>false,meaningfulPartialWorkout:()=>false,
  hasExtraStrengthSession:()=>false,dayDiff:()=>0,trainingStartDate:"2026-10-15"}));
 const ses=new Function(...Object.keys({...stubs,readPartialWorkout:()=>null,hasExtraStrengthSession:()=>false}),swipes+
  strengthSession+";return strengthSessionDates;")(...Object.values({...stubs,readPartialWorkout:()=>null,hasExtraStrengthSession:()=>false}));
 return {api,sync,ses,m,localStorage,alerts,get refreshes(){return refreshes}};
}
// The reported scenario: current Day4 rest, already doing Day5 chest. Complete Day4
// without treating rest as strength and immediately show chest as current.
let a=testApp();
a.api.swipeCompleteWeekDay(3);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"4","Day4 completion immediately opens Day5 chest");
assert.equal(a.localStorage.getItem("ckTrainPlanIndex-2026-11-11"),"4","today matches Day5");
assert.equal(a.localStorage.getItem("ckTrain-2026-11-11"),null,"no fake finished chest workout");
assert.equal(a.localStorage.getItem("ckRide-2026-11-11"),null,"no fake cardio");
assert.equal(a.api.swipeStepLog()[0].kind,"rest");
assert.equal(a.api.swipeStepLog()[0].index,3);
assert.equal(a.api.swipeRecentComplete(3),true);
assert.equal(a.ses().length,0,"rest does not add to weekly strength sessions");
assert.equal(a.refreshes,1);
assert.equal(a.api.swipeCanUndo(3),true,"last swipe can undo");
a.api.swipeUndoWeekDay(3);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"3","undo recovers Day4");
assert.equal(a.api.swipeStepLog().length,0,"undo removes only its swipe record");
// Mark Day5 when it is current: one truthful strength confirmation without sets.
a.api.swipeCompleteWeekDay(3);
a.api.swipeCompleteWeekDay(4);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"5","Day5 complete advances to Day6 Zone 2");
assert.equal(a.ses().length,1,"confirmed strength adds one session but no exercise sets");
assert.equal(a.localStorage.getItem("ckExerciseDone-2026-11-11"),null,"no invented exercise completion");
assert.equal(a.localStorage.getItem("ckActualWorkout-2026-11-11"),null,"no invented weight or reps");
assert.equal(a.api.swipeStepLog().length,2,"rest and strength can both be completed on one date");
assert.equal(a.api.swipeCanUndo(4),true);
a.api.swipeUndoWeekDay(4);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"4");
assert.equal(a.ses().length,0,"undo removes confirmed undetailed strength count only");
assert.equal(a.api.swipeCanUndo(3),true,"previous step now becomes undoable");
// Day6 cardio left swipe does not invent duration or RPE.
a=testApp({current:5});a.api.swipeCompleteWeekDay(5);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"6");
assert.equal(a.localStorage.getItem("ckRide-2026-11-11"),null);
assert.equal(a.api.swipeStepLog()[0].description.includes("未填写骑行时长"),true);
// Day7 wraps to next round, clearing visible badges from the new rotation.
a=testApp({current:6,existing:{"ckSwipePlanRotation":JSON.stringify({round:2,done:[0,1,2,3,4,5]})}});
a.api.swipeCompleteWeekDay(6);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"0");
assert.equal(a.api.swipeProgress().round,3);
assert.deepEqual(a.api.swipeProgress().done,[]);
// Duplicate completion or recent already logged day cannot count twice.
a=testApp();
a.api.swipeCompleteWeekDay(3);const before=a.ses().length;
a.api.swipeCompleteWeekDay(3); // repeated left swipe never silently undoes the previous task
assert.equal(a.ses().length,before);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"4","repeat swipe does not move cursor backwards");
assert.equal(a.api.swipeStepLog().length,1,"no duplicate ledger entry");
a=testApp({current:4,started:true});a.api.swipeCompleteWeekDay(5);
assert.equal(a.localStorage.getItem("ckTrainingCursorIndex"),"4","do not replace started session");
assert.equal(a.alerts.length,1);
// Cross-date replay: if latest currently selected step was swiped, it progresses,
// but a previously completed different step cannot incorrectly progress it again.
a=testApp({current:4,date:"2026-11-12",existing:{"ckTrainingCursorDate":"2026-11-11",
 "ckSwipePlanCompletions-2026-11-11":JSON.stringify([{status:"completed",index:3,kind:"rest",date:"2026-11-11"}])}});
assert.equal(a.sync(),4,"prior Day4 rest does not auto-complete Day5 chest");
a=testApp({current:4,date:"2026-11-12",existing:{"ckTrainingCursorDate":"2026-11-11",
 "ckSwipePlanCompletions-2026-11-11":JSON.stringify([{status:"completed",index:4,kind:"strength",date:"2026-11-11"}])}});
assert.equal(a.sync(),5,"unfinished cursor after prior swipe can repair on next-day load");
console.log("PASS V109 swipe complete: Day4->Day5 same day, next-day cursor idempotence, recorded strength not fake sets, cardio honesty, reversible last swipe, started-session protection, wrap.");
