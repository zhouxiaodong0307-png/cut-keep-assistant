const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const css=html.slice(html.indexOf("/* V111: readable colored underlay"),html.indexOf("/* V72: match diet"));
const script=html.slice(html.indexOf("/* V109: swipe confirmation advances"),html.indexOf("function syncTrainingCursor(){",html.indexOf("/* V109: swipe confirmation advances")));
assert(/APP_BUILD="20261113-swipe-refined-pill-v113"/.test(html),"V111 deployed marker");
assert(css.includes("linear-gradient(105deg,#eef7f1 0%,#d6efdf 100%)"),"under-card completion shade is pale green, not white");
assert(css.includes("linear-gradient(125deg,#d5efde 0%,#b7e4c7 100%)"),"right reveal action uses green gradient");
assert(css.includes("linear-gradient(125deg,#cbd3df 0%,#e7eaf1 100%)"),"left undo reveal action is muted slate");
assert(css.includes("box-shadow:inset 5px 0 12px rgba(28,113,65,.14)"),"subtle depth on completion reveal");
assert(css.includes("opacity:var(--swipe-opacity,.48)"),"Safari-compatible drag intensity gradually reveals text");
assert(css.includes(".swipeReady>.weekSwipeAction")&&css.includes(".swipeUndoDragging.swipeReady>.weekSwipeUndoCue"),"strong visual signal at swipe threshold");
assert(css.includes(".swipeUndoFinishing>.weekSwipeUndoCue"),"release leaves visible gray undo confirmation");
assert(css.includes(".weekSwipeFeedback.undo"),"settled undo feedback is gray rather than green");
assert(html.includes('<span class="weekSwipeIcon">✓</span><span>已完成</span><small class="weekSwipeHint">松手完成</small>'),"left swipe exposes both checkmark and readable completed label");
assert(html.includes('<span class="weekSwipeIcon">↶</span><span>撤销</span><small class="weekSwipeHint">松手撤销</small>'),"right swipe exposes cancel cue");
assert(script.includes('row?.style?.setProperty?.("--swipe-reveal","0")'),"rebound clears reveal tint");
assert(script.includes('row?.style?.setProperty?.("--swipe-reveal",'),"finger motion updates status tint");
assert(script.includes("const progress=Math.min(1,Math.abs(offset)/86)"),"saturation follows finger travel");
assert(script.includes('setProperty?.("--swipe-opacity",String(.48+.52*progress))'),"progress drives opacity without unsupported CSS calc multiplication");
assert(script.includes('row?.classList.toggle("swipeReady",Math.abs(dx)>=65'),"highlight only after deliberate threshold");
assert(script.includes('row?.classList.toggle("swipeUndoDragging",dx>0&&allowRight)'),"undo direction changes the underlay color");
assert(script.includes('if(undo)row.classList.add("swipeUndoFinishing")'),"releasing an undo shows gray confirmation");
assert(css.includes("@media(prefers-reduced-motion:reduce)"),"reduced-motion retains status without animation");
function luminance(h){const [r,g,b]=h.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b}
function contrast(a,b){const aa=luminance(a),bb=luminance(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)}
assert(contrast("#176340","#b7e4c7")>=4.5,"completed status dark green meets AA on saturated pale-green surface");
assert(contrast("#4c5567","#ccd3de")>=4.5,"undo status slate text meets AA on gray-blue surface");
console.log("PASS V111: green completion and gray undo underlays, progressive reveal, readable labels, AA contrast, release/undo feedback and reduced-motion.");
