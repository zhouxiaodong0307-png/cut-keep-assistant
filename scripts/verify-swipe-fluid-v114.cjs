const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
assert(html.includes('APP_BUILD="20261114-clip-swipe-fill-to-summary-v116"'),"V114 build");
const css=html.slice(html.indexOf("/* V114: native closed"),html.indexOf("#view-training .iosWeekList .weekDoneBadge{"));
assert(css.includes('width:var(--swipe-distance,0px)'),"fill width is a CSS custom pixel value");
assert(css.includes("left:100%")&&css.includes("right:100%"),"both directions anchored to summary edge");
assert(css.includes("swipeDragging>summary>.weekSwipeVisual{transition:none}"),"no lag behind the finger");
assert(!css.includes("inset:7px")&&!css.includes("border-radius:13px"),"old inset pill removed");
const a=html.indexOf("function weekSwipeVisualProgress(row,offset){"),b=html.indexOf("function weekSwipeReset(summary){",a);
assert(a>0&&b>a,"progress function exists");
const update=new Function(html.slice(a,b)+";return weekSwipeVisualProgress;")();
const attrs={};const row={style:{setProperty:(key,value)=>attrs[key]=String(value)}};
let prev=-1;
for(const x of [0,3,12,27,42,65,86,100,103]){
 update(row,-x);
 assert.equal(attrs["--swipe-distance"],x+"px","left drag "+x+"px");
 const strength=Number(attrs["--swipe-fill-alpha"]);
 assert(strength>=prev,"fill darkens progressively");prev=strength;
 const label=Number(attrs["--swipe-label-opacity"]);
 assert(label>=0&&label<=1,"label visible only with room");
 if(x<38)assert.equal(label,0,"small gap does not show text");
}
for(const x of [15,60,103]){update(row,x);assert.equal(attrs["--swipe-distance"],x+"px","right drag "+x+"px")}
update(row,0);assert.equal(attrs["--swipe-distance"],"0px");assert.equal(attrs["--swipe-fill-alpha"],"0");
const reset=html.slice(html.indexOf("function weekSwipeReset(summary){"),html.indexOf("function weekSwipeAnimate(index,undo=false){"));
assert(reset.includes("weekSwipeVisualProgress(row,0)"),"short drag and cancel reset to zero");
const motion=html.slice(html.indexOf('root.addEventListener("touchmove",e=>'),html.indexOf('root.addEventListener("touchend",e=>'));
assert(motion.includes("weekSwipeVisualProgress(row,offset)"),"each move tracks finger");
const animate=html.slice(html.indexOf("function weekSwipeAnimate(index,undo=false){"),html.indexOf("function installWeekSwipeGestures(){"));
assert(animate.includes("weekSwipeVisualProgress(row,100)"),"release fills final 100px");
assert(animate.includes("swipeCompleteWeekDay(index)")&&animate.includes("swipeUndoWeekDay(index)"),"history save semantics retained");
console.log("PASS V114: precise green and gray pixel-by-pixel fills, progressive intensity, release and cancel.");