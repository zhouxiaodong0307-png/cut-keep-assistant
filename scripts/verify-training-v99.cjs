const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
function sect(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,"missing "+a);return html.slice(i,j)}
assert.match(html,/APP_BUILD="20261106-progressive-cycle-99"/);
assert(!html.includes("localStorage.clear("),"never erase historical records");
const mkDates=n=>Array.from({length:n},(_,i)=>{
 const d=new Date("2026-07-01T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)
});
let before=35,total=35,today="2026-10-01",dates=mkDates(72);
const addDate=(base,n)=>{const d=new Date(base+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const stage=new Function("completedStrengthSessionsBeforeToday","completedStrengthSessions","strengthSessionDates","localDate","shiftDate","trainingStartDate",
 sect("const STRENGTH_SESSIONS_PER_STAGE=36;","function roundTo(")+"return {trainingCycleState,phaseWeek,phaseComplete,trainingWeekWindow};")(
 ()=>before,()=>total,()=>dates,()=>today,addDate,"2026-07-01");
assert.deepEqual([stage.trainingCycleState().cycle,stage.phaseWeek(),stage.phaseComplete()],[1,12,false]);
before=35;total=36;assert.equal(stage.phaseComplete(),true,"show milestone after 36th real session");
before=36;total=36;assert.deepEqual([stage.trainingCycleState().cycle,stage.phaseWeek(),stage.phaseComplete()],[2,1,false],"stage 2 must start automatically and clear permanent deload");
const w=stage.trainingWeekWindow(1,true,2);assert.equal(w.start,addDate(dates[35],1),"stage 2 starts after stage 1 final session");
before=71;total=72;assert.deepEqual([stage.trainingCycleState().cycle,stage.phaseWeek(),stage.phaseComplete()],[2,12,true]);
before=72;total=72;assert.deepEqual([stage.trainingCycleState().cycle,stage.phaseWeek(),stage.phaseComplete()],[3,1,false]);
const template=new Function(sect("const planTemplates=","const coachLoads=")+";return planTemplates;")();
const names=template[0][3].map(x=>x.split("｜")[0]);
assert(!names.includes("杠铃罗马尼亚硬拉"),"future Day1 must honor no RDL preference");
assert(names.includes("俯卧腿弯举"),"future Day1 still needs posterior leg stimulus");
assert.equal(template[4][3].filter(x=>/卧推|飞鸟|推胸/.test(x)).length,4,"chest day still chest-only");
const parse=row=>{const m=String(row||"").match(/(\d+)组\s*×\s*(?:每侧)?(\d+)[–-](\d+)(次|秒)/);return m?{sets:+m[1],min:+m[2],max:+m[3],unit:m[4]}:null};
const volumeStub={getItem:k=>null,setItem:()=>{}};
const mkVolume=(oldRows={},extras={},actual={})=>{
 const mem=new Map(Object.entries(oldRows));
 const get=(k)=>mem.has(k)?mem.get(k):null;
 const v={getItem:get,setItem:(k,val)=>mem.set(k,String(val))};
 const extracted=sect("const MUSCLE_VOLUME_BUCKETS=","function archiveWeeklyReports(){");
 const fn=new Function("planTemplates","readTrainingVolumeJson","VOLUME_REFERENCE_KEY","exerciseVolumeId","parseExerciseVolume","validExerciseVolume","localDate","shiftDate","readActualWorkout","partialWorkoutKey","completedExtraActivity","trainingIndexForDate","localStorage","STRENGTH_SESSIONS_PER_STAGE","strengthSessionDates","volumeTrainingHistory","weights","trainingCycleState","phaseComplete","document",extracted+";return {trainingStimulusCounts,completedTrainingCycleReview,trainingProgressionSummary,renderTrainingAdaptation};");
 const read=(key,def)=>{try{return JSON.parse(v.getItem(key)||"null")||def}catch(e){return def}};
 const history=extras.history||[];
 return fn(template,read,"ckTrainingVolumeReferences",(idx,name)=>idx+"|"+name,parse,
   x=>x&&Number.isInteger(+x.sets)&&+x.sets>0&&+x.sets<=8,
   ()=>"2026-11-06",addDate,ds=>actual[ds]||null,ds=>"ckPartialWorkout-"+ds,
   ds=>extras[ds]||[],ds=>0,v,36,()=>dates.slice(0,36),()=>history,extras.weights||[],
   ()=>({cycle:2,week:1,inCycle:0,finishedCycles:1}),()=>false,{getElementById:()=>null});
};
let plan=mkVolume();
const planned=plan.trainingStimulusCounts();
assert.equal(planned.planned.chest,13);
assert.equal(planned.planned.back,9);
assert.equal(planned.planned.quads,6);
assert.equal(planned.planned.hams,6);
assert.equal(planned.planned.upperChest,3);
assert.equal(planned.planned.lateral,0);
assert.equal(planned.entries,0,"no actual entries cannot mean zero completed sets");
const actual={["2026-11-06"]:{exercises:[
 {name:"上斜哑铃卧推",muscle:"chest",sets:3},
 {name:"坐姿划船",muscle:"back",sets:4},
 {name:"杠铃深蹲",muscle:"legs",sets:3}
]}};
const partial={"ckPartialWorkout-2026-11-05":JSON.stringify({index:0,completed:[
 {name:"俯卧腿弯举",sets:3,muscle:"legs",row:"俯卧腿弯举｜3组 × 10–15次"},
 {name:"器械推胸",sets:2,muscle:"chest",row:"器械推胸｜2组 × 8–12次"}
]})};
const real=mkVolume(partial,{"2026-11-04":[{type:"strength",muscle:"legs",sets:5}]},actual).trainingStimulusCounts();
assert.equal(real.confirmed.chest,5);
assert.equal(real.confirmed.upperChest,3);
assert.equal(real.confirmed.back,4);
assert.equal(real.confirmed.backThickness,4);
assert.equal(real.confirmed.quads,3);
assert.equal(real.confirmed.hams,3);
assert.equal(real.unclassifiedLegSets,5,"generic legs must not be misattributed to quads/hams");
const trainingHistory=[
 {date:dates[0],id:"4|杠铃卧推",weight:45,lastReps:6},
 {date:dates[30],id:"4|杠铃卧推",weight:50,lastReps:8},
 {date:dates[1],id:"0|坐姿划船",weight:35,lastReps:8},
 {date:dates[34],id:"0|坐姿划船",weight:35,lastReps:12}
];
const rev=mkVolume({}, {history:trainingHistory,weights:[
 {date:dates[0],weight:79},{date:dates[1],weight:78.9},
 {date:dates[34],weight:77.5},{date:dates[35],weight:77.3}
]});
const report=rev.completedTrainingCycleReview(1);
assert(report&&report.completed===36&&report.improved===1&&report.stable===1);
assert(Math.abs(report.bodyDelta+1.5)<=0.1,"stage bodyweight trend remains descriptive");
const progress=rev.trainingProgressionSummary();
assert(progress.some(x=>x.kind==="increase")&&progress.some(x=>x.kind==="reps"),"progression counts both weight and reps");
const progression=new Function("loadKeyForExercise","coachLoads","sessionLoads","workingWeight","localStorage","phaseWeek","recoveryRule","roundTo","currentPlans","trainingIndex","parseExerciseVolume",
 sect("function feedbackNextWeight(","function rollbackExerciseFeedback(")+";return feedbackNextWeight;")(
 ()=>"bench",{bench:{base:45,inc:2.5,round:2.5}}, {bench:45},()=>45,volumeStub,()=>1,
 ()=>({suppressProgress:false}),(n,s)=>Math.round(n/s)*s,
 ()=>{const p=Array.from({length:7},()=>["","","",[]]);p[4][3]=["杠铃卧推｜3组 × 6–8次"];return p},()=>4,parse);
assert.equal(progression("杠铃卧推","good",8),47.5,"at rep ceiling with reserve earns small load step");
assert.equal(progression("杠铃卧推","good",7),45,"below rep ceiling stays at load");
assert.equal(progression("杠铃卧推","hard",8),45,"high exertion does not force a load increase");
assert.equal(progression("杠铃卧推","light"),47.5,"legacy subjective feedback remains supported");
const archiveCode=sect("function archiveWeeklyReports(){","function renderWeeklyReport(){");
let reportStore=[{week:1,focus:"旧阶段真实记录"}],saved="";
const archive=new Function("trainingCycleState","weeklyReportData","weeklyReports","localStorage",archiveCode+";archiveWeeklyReports();return weeklyReports;")(
 ()=>({cycle:2,week:1}), (week,partial,cycle)=>({cycle,week,focus:"阶段"+cycle+"周"+week}),
 reportStore,{setItem:(k,v)=>{if(k==="ckWeeklyReports")saved=v}});
assert.equal(archive.length,12);
assert.equal(archive.filter(x=>x.cycle===1).length,12);
assert.equal(JSON.parse(saved).length,12,"archive persists without deleting old records");
assert(html.includes('id="muscleVolumeDashboard"')&&html.includes('id="trainingStageAssessment"')&&html.includes('id="cycleMilestoneBanner"'));
console.log("PASS V99: stage1->2->3 rollover, accurate week history, 36-session evaluation, partial and real muscle groups, optional last-set double progression and legacy data preservation.");
