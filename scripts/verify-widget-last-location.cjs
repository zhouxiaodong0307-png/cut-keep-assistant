const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const a=html.indexOf("/* V100: restore last navigation"),b=html.indexOf("function openTodayTraining(){",a);
assert(a>=0&&b>a,"navigation restore module missing");
const code=html.slice(a,b);
assert.match(html,/targetKcalInput\.value=target;targetProteinInput\.value=pt;render\(\);restoreUiLocationOnStartup\(\);/);
assert.match(html,/APP_BUILD="20261107-widget-resume-v100"/);
const store=new Map([["ckWeights",'[{"date":"2026-10-01","weight":77.5}]'],["ckTrainingVolumeHistory",'[{"name":"杠铃卧推","sets":3}]']]);
function launch(memory=store){
 const callbacks={},elements={},buttons={};let rendered=0;
 const makeClass=()=>{
  const set=new Set();
  return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle:(x,flag)=>{if(flag===undefined?(!set.has(x)):flag)set.add(x);else set.delete(x)}};
 };
 for(const name of ["today","diet","training","progress"]){
  const details=name==="training"?["todayPlanDetails","week-plan-card"]:name==="progress"?["iosWidgetHelp"]:[];
  const view={id:"view-"+name,classList:makeClass(),details:[],querySelectorAll(sel){return sel==="details[open]"?this.details.filter(d=>d.open):this.details}};
  elements[name]=view;
  for(const id of details){
   const detail={id:id==="week-plan-card"?"":id,open:false,view,closest(q){
    if(q===".view")return view;
    if(q===".view.active")return view.classList.contains("active")?view:null;
    if(q==="#weekPlan")return id==="week-plan-card"?{querySelectorAll:()=>[detail]}:null;
    return null;
   }};
   view.details.push(detail);
  }
  buttons[name]={dataset:{view:name},classList:makeClass()};
 }
 elements.today.classList.add("active");buttons.today.classList.add("active");
 const document={
  querySelectorAll:sel=>sel===".view"?Object.values(elements):sel===".nav button"?Object.values(buttons):[],
  querySelector:sel=>{const m=sel.match(/data-view="(today|diet|training|progress)"/);return m?buttons[m[1]]:null},
  getElementById:id=>elements[id.replace(/^view-/,"")]||null,
  addEventListener:(name,fn)=>{(callbacks[name]||(callbacks[name]=[])).push(fn)}
 };
 const window={scrollY:0,pageYOffset:0,scrollTo:(x,y)=>{window.scrollY=y;window.pageYOffset=y},
  addEventListener:(name,fn)=>{(callbacks[name]||(callbacks[name]=[])).push(fn)}};
 const storage={getItem:k=>memory.has(k)?memory.get(k):null,
  setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const app=new Function("localStorage","document","window","requestAnimationFrame","setTimeout","clearTimeout","render",
  code+";return {showView,restoreUiLocationOnStartup,persistUiLocation,loadUiLocation};")(
  storage,document,window,fn=>fn(),fn=>{fn();return 1},()=>{},()=>{rendered++});
 const open=()=>Object.entries(elements).find(([k,v])=>v.classList.contains("active"))?.[0];
 return {app,storage,window,elements,buttons,callbacks,open,rendered:()=>rendered};
}
const newUser=launch();newUser.app.restoreUiLocationOnStartup();
assert.equal(newUser.open(),"today","first visit starts on Today");
newUser.app.showView("training",newUser.buttons.training);
assert.equal(newUser.open(),"training");
newUser.window.scrollTo(0,890);
newUser.elements.training.details[0].open=true;newUser.elements.training.details[1].open=true;
for(const fn of newUser.callbacks.pagehide||[])fn();
assert.equal(JSON.parse(store.get("fitnessLastLocation-v1")).view,"training");
const widgetRelaunch=launch();widgetRelaunch.app.restoreUiLocationOnStartup();
assert.equal(widgetRelaunch.open(),"training","widget relaunch preserves training tab");
assert.equal(widgetRelaunch.window.scrollY,890,"widget relaunch preserves scroll offset");
assert.equal(widgetRelaunch.elements.training.details[0].open,true,"expanded daily training preserved");
assert.equal(widgetRelaunch.elements.training.details[1].open,true,"expanded weekly plan preserved");
assert.equal(widgetRelaunch.buttons.training.classList.contains("active"),true,"nav highlight preserved");
// Manual tab clicks remain deliberate navigation-to-top, but remember the new tab.
widgetRelaunch.app.showView("diet",widgetRelaunch.buttons.diet);
assert.equal(widgetRelaunch.open(),"diet");
assert.equal(widgetRelaunch.window.scrollY,0,"manual navigation starts at top");
widgetRelaunch.window.scrollTo(0,225);
widgetRelaunch.app.persistUiLocation();
const secondWidgetTap=launch();secondWidgetTap.app.restoreUiLocationOnStartup();
assert.equal(secondWidgetTap.open(),"diet");
assert.equal(secondWidgetTap.window.scrollY,225);
secondWidgetTap.app.showView("training",secondWidgetTap.buttons.training);
assert.equal(secondWidgetTap.window.scrollY,0,"manual switch remains top");
assert.equal(secondWidgetTap.elements.training.details[0].open,true,"returning to training keeps user expansion");
assert.equal(store.get("ckWeights"),'[{"date":"2026-10-01","weight":77.5}]');
assert.equal(store.get("ckTrainingVolumeHistory"),'[{"name":"杠铃卧推","sets":3}]');
assert([...store.keys()].filter(k=>k.startsWith("ck")).length===2,"no changes to stored fitness records");
// Invalid stored route never navigates to a nonexistent page or throws.
const bad=new Map([["fitnessLastLocation-v1",'{"view":"<script>","scroll":{"today":44}}']]);
const corrupt=launch(bad);corrupt.app.restoreUiLocationOnStartup();
assert.equal(corrupt.open(),"today");
assert.equal(corrupt.window.scrollY,0);
// Browser does not share standalone WebApp and Safari localStorage; do not invent cross-container guarantees.
const widgetSource=fs.readFileSync(path.join(__dirname,"../widgets/cut-keep-scriptable.js"),"utf8");
assert(widgetSource.includes('https://cut-keep-assistant.onrender.com/'),"Scriptable still opens the canonical app site");
console.log("PASS V100 widget resume: training/diet pages, scroll and expanded cards survive fresh Scriptable launches; manual navigation, invalid state and historical data safe.");
