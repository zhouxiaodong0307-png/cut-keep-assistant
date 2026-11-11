const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const begin=html.indexOf("/* V109: swipe confirmation advances the sequence"),
 end=html.indexOf("function syncTrainingCursor(){",begin);
assert(begin>=0&&end>begin,"V109/V110 swipe code exists");
const code=html.slice(begin,end);
assert(/APP_BUILD="20261111-fluid-week-swipe-v110"/.test(html));
assert(html.includes('id="weekSwipeFeedback"')&&html.includes('aria-live="polite"'),
 "after-swipe status is accessible");
assert(html.includes("weekSwipeNextGlow")&&html.includes("swipeNewCurrent"),
 "new current step must have a visible arrival cue");
assert(html.includes("@media(prefers-reduced-motion:reduce)"),
 "respect reduced motion setting");
assert(html.includes("touch-action:pan-y"),"allow natural vertical scrolling");
function test({index=3,reducedMotion=false,started=false}={}){
 const date="2026-11-11",store=new Map([
  ["ckTrainingCursorIndex",String(index)],
  ["ckTrainingCursorDate",date],
  ["ckTrainPlanIndex-"+date,String(index)]
 ]),timers=[],alerts=[],handlers={};
 const storage={getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const classes=new Set(),style={removeProperty(name){delete this[name]}};
 const row={dataset:{weekIndex:String(index)},classList:{
  add:n=>classes.add(n),remove:n=>classes.delete(n),
  toggle:(n,on)=>on?classes.add(n):classes.delete(n)
 }};
 const summary={style,isConnected:true,parentElement:row,closest(s){return s===".weekSwipeSummary"?this:null}};
 const action={textContent:"完成"},undo={textContent:"↶ 撤销"};
 row.querySelector=s=>s===".weekSwipeSummary"?summary:
  s===".weekSwipeAction"?action:s===".weekSwipeUndoCue"?undo:null;
 const root={dataset:{},addEventListener:(name,fn)=>{handlers[name]=fn},
  contains:el=>el===summary,
  querySelector:s=>s.includes('[data-week-index="'+index+'"]')?row:null,
  querySelectorAll:s=>s===".planDetails"?[row]:[]};
 const feedback={textContent:"",hidden:true};
 const document={getElementById:name=>name==="weekPlan"?root:
  name==="weekSwipeFeedback"?feedback:null};
 let refreshes=0;
 const globals={localStorage:storage,localDate:()=>date,
  safeJsonParse:(raw,fallback)=>{try{return raw===null?fallback:JSON.parse(raw)}catch(_){return fallback}},
  planKind:i=>[0,2,4].includes(i)?"strength":[1,5].includes(i)?"cardio":"rest",
  trainingIndex:()=>Number(storage.getItem("ckTrainingCursorIndex")),
  trainingIndexForDate:d=>Number(storage.getItem("ckTrainPlanIndex-"+d)||index),
  dayAdjustmentKey:()=> "ckDayAdjustment-"+date,
  readActualWorkout:()=>null,storedRide:()=>null,readStartedExercisePlan:()=>started?{}:null,
  exerciseDone:started?{"杠铃卧推":true}:{},
  refreshAfterDayChange:()=>{refreshes++},alert:msg=>alerts.push(msg),
  window:{matchMedia:()=>({matches:reducedMotion})},document,
  planTemplates:Array.from({length:7},(_,i)=>["训练日"+(i+1),["全身力量","骑车","腿背","休息","胸部专项","骑车","休息"][i]]),
  setTimeout:(fn,ms)=>{const token={fn,ms};timers.push(token);return token},
  clearTimeout:token=>{const i=timers.indexOf(token);if(i>=0)timers.splice(i,1)}
 };
 const api=new Function(...Object.keys(globals),code+
  ";return {installWeekSwipeGestures,weekSwipeAnimate,swipeStepLog,swipeCanUndo,swipeProgress,state:()=>({weekSwipeAnimating,weekSwipeHighlightIndex})};")(...Object.values(globals));
 api.installWeekSwipeGestures();
 assert.equal(root.dataset.swipeReady,"1");
 function dispatch(name,{startX,endX,startY=30,endY=30}={}){
  let prevented=0;
  const touch=(x,y)=>({clientX:x,clientY:y});
  handlers.touchstart({target:summary,touches:[touch(startX,startY)]});
  if(name!=="start-only"){
   handlers.touchmove({touches:[touch(endX,endY)],preventDefault:()=>{prevented++}});
   handlers.touchend({changedTouches:[touch(endX,endY)],preventDefault:()=>{prevented++}});
  }
  return prevented;
 }
 function flush(ms){
  const selected=timers.filter(t=>t.ms<=ms);
  selected.forEach(t=>{const i=timers.indexOf(t);if(i>=0)timers.splice(i,1);t.fn()});
 }
 return {api,store,style,summary,feedback,classes,action,undo,handlers,dispatch,flush,
  get refreshes(){return refreshes},alerts};
}
// Finger moves with the card before the pointer is released.
let x=test();
x.handlers.touchstart({target:x.summary,touches:[{clientX:260,clientY:42}]});
let prevented=0;
x.handlers.touchmove({touches:[{clientX:174,clientY:43}],preventDefault:()=>prevented++});
assert.equal(prevented,1,"horizontal move prevents Safari horizontal navigation");
assert.equal(x.style.transform,"translateX(-86px)","card tracks exact finger distance");
assert.equal(x.store.get("ckTrainingCursorIndex"),"3","dragging alone never counts as completed");
x.handlers.touchend({changedTouches:[{clientX:157,clientY:43}],preventDefault:()=>prevented++});
assert.equal(x.store.get("ckTrainingCursorIndex"),"4","state saved immediately on release");
assert.equal(x.api.swipeStepLog().length,1,"one ledger entry for gesture");
assert.equal(x.refreshes,0,"keep old DOM for visible 220ms release animation");
assert.equal(x.action.textContent,"✓ 已完成");
assert.equal(x.style.transform,"translateX(-100px)");
assert.equal(x.api.state().weekSwipeAnimating,true,"prevent duplicate gestures mid-transition");
x.flush(239);
assert.equal(x.refreshes,0,"no premature instant replacement");
x.flush(240);
assert.equal(x.refreshes,1,"refresh after animation completes");
assert.equal(x.api.state().weekSwipeAnimating,false);
assert.match(x.feedback.textContent,/训练日5.*胸部专项/,"correct next step displayed");
assert.equal(x.feedback.hidden,false);
// Rightward swipe of the last completion animates an undo, but no history is invented.
x.handlers.touchstart({target:x.summary,touches:[{clientX:120,clientY:42}]});
x.handlers.touchmove({touches:[{clientX:210,clientY:43}],preventDefault:()=>{}});
assert.equal(x.style.transform,"translateX(90px)","undo tracks finger to the right");
x.handlers.touchend({changedTouches:[{clientX:215,clientY:43}],preventDefault:()=>{}});
assert.equal(x.store.get("ckTrainingCursorIndex"),"3");
assert.equal(x.api.swipeStepLog().length,0);
assert.equal(x.undo.textContent,"↶ 已撤销");
x.flush(240);
assert.match(x.feedback.textContent,/已撤销.*训练日4/);
// Vertical scroll must not trigger the gesture.
x=test();assert.equal(x.dispatch("vertical",{startX:240,endX:236,startY:40,endY:160}),0);
assert.equal(x.store.get("ckTrainingCursorIndex"),"3");
assert.equal(x.refreshes,0);
// Short, uncertain horizontal moves spring back without writing anything.
x=test();x.dispatch("short",{startX:245,endX:199});
assert.equal(x.store.get("ckTrainingCursorIndex"),"3");
assert.equal(x.style.transform,"translateX(0px)");
x.flush(220);assert.equal(x.refreshes,0);
// Reduced motion commits instantly without visual hold or CSS animation.
x=test({reducedMotion:true});x.api.weekSwipeAnimate(3,false);
assert.equal(x.store.get("ckTrainingCursorIndex"),"4");
assert.equal(x.refreshes,1,"reduced-motion preference does not delay new training day");
assert.equal(x.classes.has("swipeFinishing"),false);
// Failed protection never shows a false completion animation.
x=test({index:4,started:true});x.api.weekSwipeAnimate(3,false);
assert.equal(x.refreshes,0);
assert.equal(x.api.swipeStepLog().length,0);
assert.equal(x.api.state().weekSwipeAnimating,false);
assert.equal(x.classes.has("swipeFinishing"),false);
assert.equal(x.alerts.length,1);
console.log("PASS V110: iPhone touchmove follows finger, persisted release+220ms finish, new-current feedback, right undo, short/vertical rejection, reduced motion, no false success.");
