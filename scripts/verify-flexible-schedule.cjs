const fs=require("node:fs"),assert=require("node:assert/strict"),vm=require("node:vm");
const html=fs.readFileSync(require("node:path").join(__dirname,"../index.html"),"utf8");
const segment=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,"missing "+a);return html.slice(i,j)};
const evaluate=new Function(segment("function evaluateDailyReadiness(data){","function dailyTrainingDecision(")+";return evaluateDailyReadiness;")();
const d=(sleep,priorSleep=null,activities=[],feeling="ok",pain=false)=>evaluate({sleep,priorSleep,activities,feeling,pain});
assert.equal(d(6.3).mode,"normal","one mildly short night must not force reduction/rest");
assert.equal(d(6.3,6.8).mode,"reduce","repeated short sleep should retain recovery protection");
assert.equal(d(5.7).mode,"reduce","very short sleep still requires caution");
const recentHigh=[{gap:1,type:"strength",sets:9,rpe:8,minutes:50}];
assert.equal(d(5.7,null,recentHigh).mode,"recover","severe sleep loss plus hard training stays guarded");
assert.equal(d(7.5,null,recentHigh,"poor").mode,"recover","high load plus poor readiness stays guarded");
const templates=new Function(segment("const planTemplates=","const coachLoads=")+";return planTemplates;")();
assert.equal(templates[4][1],"胸部专项训练");
const parse=row=>{const m=String(row).match(/(\d+)组\s*×\s*(?:每侧)?(\d+)[–-](\d+)(次|秒)/);return m?{sets:+m[1],min:+m[2],max:+m[3],unit:m[4]}:null};
const valid=v=>!!v&&Number.isInteger(+v.sets)&&+v.sets>=1&&+v.sets<=8;
const apply=(row,v)=>row.replace(/\d+组\s*×\s*(每侧)?\d+[–-]\d+(次|秒)/,(_,side)=>v.sets+"组 × "+(side||"")+v.min+"–"+v.max+v.unit);
const readinessCode=segment("function applyDailyReadinessToPlans(plans,idx,ds=localDate()){","function dailyTrainingNutritionAdvice(");
const makeReadiness=(mode,choice)=>new Function("dailyTrainingDecision","basicsForDate","completedExtraActivity","readTrainingVolumeJson","VOLUME_REFERENCE_KEY","parseExerciseVolume","exerciseVolumeId","validExerciseVolume","planTemplates","applyExerciseVolumeToRow",readinessCode+";return applyDailyReadinessToPlans;")(
 ()=>({mode,userChoice:choice,started:false,missed:false}),()=>({sleep:6.3}),()=>[],()=>({}),"volume",parse,(i,n)=>i+"|"+n,valid,templates,apply);
const fresh=()=>templates.map(p=>[p[0],p[1],p[2],[...p[3]]]);
const allowed=fresh();makeReadiness("recover","next-strength")(allowed,2,"2026-11-01");
assert.equal(allowed[2][1],"腿部 + 背部 B","explicit choice must not become forced rest");
assert.match(allowed[2][2],/恢复风险较高/,"high risk must remain visible");
const lower=fresh();makeReadiness("reduce","next-strength")(lower,2,"2026-11-01");
assert.equal(parse(lower[2][3].find(x=>x.startsWith("保加利亚分腿蹲｜"))).sets,2,"selected strength remains adaptively reduced when risk exists");
const store=new Map([["ckTrainingCursorIndex","1"],["ckTrainingCursorDate","2026-11-01"],["ckTrainPlanIndex-2026-10-31","1"]]);
const storage={
 getItem:k=>store.has(k)?store.get(k):null,
 setItem:(k,v)=>store.set(k,String(v)),
 removeItem:k=>store.delete(k)
};
let confirmCalls=0,renderCalls=0,mode="normal";
const ctx={localStorage:storage,localDate:()=>"2026-11-01",trainDone:false,exerciseDone:{},dayAdjustmentOpen:true,
 trainingIndex:()=>+storage.getItem("ckTrainingCursorIndex"),planKind:i=>[0,2,4].includes(i)?"strength":[1,5].includes(i)?"cardio":"rest",
 readDayAdjustment:()=>{const x=storage.getItem("ckDayAdjustment-2026-11-01");return x?JSON.parse(x):null},
 readMissedTraining:()=>null,storedRide:()=>null,safeNextStrengthDay:i=>i===1?2:4,integratedTrainingDecision:()=>({load:{highLoad:false}}),
 dailyTrainingDecision:()=>({mode}),recovery:{state:"ok",painArea:""},confirm:()=>{confirmCalls++;return false},
 dayAdjustmentKey:()=>"ckDayAdjustment-2026-11-01",saveDayAdjustment:()=>true,
 refreshAfterDayChange:()=>{renderCalls++},alert:msg=>{throw Error(msg)}
};
const adjust=segment("function adjustToday(kind){","function saveTodayWalk(");
vm.runInNewContext(adjust+';adjustToday("next-strength");',ctx);
assert.equal(storage.getItem("ckTrainingCursorIndex"),"2","select Day3 rather than repeat Day2");
assert.equal(storage.getItem("ckTrainPlanIndex-2026-11-01"),"2","save correct actual training date");
assert.equal(JSON.parse(storage.getItem("ckDayAdjustment-2026-11-01")).reason,"prefer-strength-instead-of-cardio");
assert.equal(storage.getItem("ckTrain-2026-11-01"),null,"choice is NOT training completion");
assert.equal(storage.getItem("ckRide-2026-11-01"),null,"cardio must never be fabricated");
assert.equal(confirmCalls,0,"one mildly short night should not demand forced rest confirmation");
assert.equal(renderCalls,1);
vm.runInNewContext(adjust+';adjustToday("original");',ctx);
assert.equal(storage.getItem("ckTrainingCursorIndex"),"1","revert scheduled training safely");
assert.equal(storage.getItem("ckDayAdjustment-2026-11-01"),null,"remove pending switch when reverting");
mode="recover";
vm.runInNewContext(adjust+';adjustToday("next-strength");',ctx);
assert.equal(storage.getItem("ckTrainingCursorIndex"),"1","reject high-risk switch if user declines");
assert.equal(confirmCalls,1,"high-risk choice must warn");
ctx.confirm=()=>{confirmCalls++;return true};
vm.runInNewContext(adjust+';adjustToday("next-strength");',ctx);
assert.equal(storage.getItem("ckTrainingCursorIndex"),"2","user may still choose training after warning");
storage.setItem("ckTrain-2026-11-01","1");
const cursorCtx={localStorage:storage,localDate:()=>"2026-11-02",trainingStartDate:"2026-10-27",
 dayDiff:()=>0,shiftDate:(date,amount)=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10)},
 shouldPassOptionalCardio:()=>false,readDayAdjustment:()=>null,meaningfulPartialWorkout:()=>false,hasExtraStrengthSession:()=>false};
const cursorCode=segment("function syncTrainingCursor(){","function strengthSessionDates()");
const advanced=vm.runInNewContext(cursorCode+";syncTrainingCursor();",cursorCtx);
assert.equal(advanced,3,"completed Day3 moves to Day4 rest, not backwards to missed Zone2");
assert.equal(storage.getItem("ckTrain-2026-10-31"),null,"past missed cardio remains uncompleted");
assert(!html.includes("localStorage.clear("),"historical records must be preserved");
assert(html.includes('button("next-strength","有氧较累 · 改练下一次力量")'),"visible choice must describe felt cardio fatigue");
console.log("PASS V98 flexible schedule: mild vs severe sleep, high load warning, Day2->Day3, no fake cardio, rest next, revert and historical records.");
