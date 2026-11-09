const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const head=html.slice(0,html.indexOf("</head>"));
const boot=head.match(/<meta name="theme-color"[^>]*><script>([\s\S]*?)<\/script><style>/);
assert(boot,"pre-paint bootstrap must run in HEAD before stylesheet and body");
assert(head.indexOf("widgetResumePending")<head.indexOf("<style>"),"gate must activate before stylesheet");
assert(head.includes("html.widgetResumePending main.app,html.widgetResumePending nav.nav{visibility:hidden!important}"),"initial homepage must be invisible while restoring");
assert(/APP_BUILD="20\d{6}-[^"]+"/.test(html),"release build marker retained");
const early=new Function("localStorage","document","history","setTimeout",boot[1]);
function classSet(){
 const set=new Set();return {contains:k=>set.has(k),add:k=>set.add(k),remove:k=>set.delete(k),toggle:(k,on)=>{if(on)set.add(k);else set.delete(k)}};
}
function mockBootstrap(state){
 const bag=new Map(state===null?[]:[["fitnessLastLocation-v1",state]]);
 const classes=classSet(),pending=[];
 const document={documentElement:{classList:classes}};
 const localStorage={getItem:k=>bag.get(k)||null,setItem:(k,v)=>bag.set(k,v)};
 const history={scrollRestoration:"auto"};
 early(localStorage,document,history,(fn,delay)=>pending.push({fn,delay}));
 return {classes,pending,document,history,localStorage};
}
const defaultOpen=mockBootstrap(null);assert.equal(defaultOpen.classes.contains("widgetResumePending"),false);
const wrong=mockBootstrap('{"view":"<svg>","scroll":{"training":200}}');assert.equal(wrong.classes.contains("widgetResumePending"),false);
const homeTop=mockBootstrap('{"view":"today","scroll":{"today":0}}');assert.equal(homeTop.classes.contains("widgetResumePending"),false);
const trainingJson='{"view":"training","scroll":{"training":860},"details":{"training":["#todayPlanDetails"]}}';
const trainingOpen=mockBootstrap(trainingJson);
assert.equal(trainingOpen.classes.contains("widgetResumePending"),true,"saved training must be gated before home paints");
assert.equal(trainingOpen.history.scrollRestoration,"manual");
assert(trainingOpen.pending.find(t=>t.delay===2500),"fallback to prevent permanent blank");
const homeDown=mockBootstrap('{"view":"today","scroll":{"today":650}}');
assert.equal(homeDown.classes.contains("widgetResumePending"),true,"scroll restoration on Today must not visibly jump");
const navStart=html.indexOf("/* V100: restore last navigation");
const navEnd=html.indexOf("function openTodayTraining(){",navStart);
assert(navStart>0&&navEnd>navStart,"existing V100 navigation must remain intact");
const navCode=html.slice(navStart,navEnd);
const elem=(id)=>({id,classList:classSet(),details:[],querySelectorAll:function(q){
 return q==="details[open]"?this.details.filter(x=>x.open):this.details;
}});
const views=Object.fromEntries(["today","diet","training","progress"].map(k=>[k,elem("view-"+k)]));
const btns=Object.fromEntries(Object.keys(views).map(k=>[k,{dataset:{view:k},classList:classSet()}]));
const detail={id:"todayPlanDetails",open:false,closest:q=>q===".view"?views.training:q==="#weekPlan"?null:q===".view.active"?views.training:null};
views.training.details.push(detail);
views.today.classList.add("active");btns.today.classList.add("active");
const document={...trainingOpen.document,
 getElementById:id=>views[id.replace(/^view-/,"")]||null,
 querySelectorAll:q=>q===".view"?Object.values(views):q===".nav button"?Object.values(btns):[],
 querySelector:q=>{const match=q.match(/data-view="(today|diet|training|progress)"/);return match?btns[match[1]]:null},
 addEventListener:()=>{}};
const window={scrollY:0,pageYOffset:0,scrollTo:(x,y)=>{window.scrollY=y;window.pageYOffset=y},addEventListener:()=>{}};
const frame=[],timers=[];let renders=0;
const nav=new Function("document","window","localStorage","render","requestAnimationFrame","setTimeout","clearTimeout",
 navCode+";return {restoreUiLocationOnStartup,showView};")(document,window,trainingOpen.localStorage,
 ()=>{renders++},fn=>{frame.push(fn)},(fn,delay)=>{timers.push({fn,delay})},()=>{});
nav.restoreUiLocationOnStartup();
assert.equal(views.training.classList.contains("active"),true,"real target selected before unmasking");
assert.equal(views.today.classList.contains("active"),false);
assert.equal(btns.training.classList.contains("active"),true,"nav active state restored before reveal");
assert.equal(detail.open,true,"expanded card restored before reveal");
assert(trainingOpen.classes.contains("widgetResumePending"),"must hide until scroll is correct");
assert.equal(window.scrollY,0,"target scroll must not be shown at top");
assert.equal(frame.length,1);
frame.shift()();assert.equal(frame.length,1);
frame.shift()();
assert.equal(window.scrollY,860,"scroll restored while page stays concealed");
assert(trainingOpen.classes.contains("widgetResumePending"),"no frame of training top before target location");
assert.equal(timers.length,1);
assert.equal(timers[0].delay,75);
timers.shift().fn();
assert.equal(trainingOpen.classes.contains("widgetResumePending"),false,"reveal only after scroll and details are ready");
assert.equal(window.scrollY,860);
assert.equal(renders,0,"restore does not rerender or force homepage");
const captured=JSON.parse(trainingOpen.localStorage.getItem("fitnessLastLocation-v1"));
assert.equal(captured.view,"training","no user preference overwrite");
console.log("PASS V101 no first-paint homepage: head gating, invalid/first visit, restored tab+expanded card+scroll before visibility, JS fallback and no rerender.");
