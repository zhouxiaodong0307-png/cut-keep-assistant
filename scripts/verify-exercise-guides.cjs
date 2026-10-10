// Training/illustration binding regression, pure read-only check.
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function sect(a,b){const s=html.indexOf(a),e=html.indexOf(b,s+a.length);if(s<0||e<0)throw Error('Missing '+a);return html.slice(s,e+b.length)}
function func(a,b){return sect('function '+a+'(',b).slice(0,-b.length)}
const images={
 '杠铃深蹲':['squat',0,0],'器械推胸':['chestpress',1,0],'坐姿划船':['row',1,1],
 '杠铃罗马尼亚硬拉':['rdl',2,0],'死虫':['deadbug',4,1],'平板支撑':['plank',5,0],
 '保加利亚分腿蹲':['split',0,1],'中立握高位下拉':['pulldown',3,0],
 '俯卧腿弯举':['legcurl',2,1],'绳索面拉':['facepull',3,1],
 'Pallof Press 抗旋转':['pallof',4,0],'杠铃卧推':['bench',5,1],
 '上斜哑铃卧推':['incline',6,0],'平板哑铃飞鸟':['fly',6,1]
};
const expectedDays=[
 ['杠铃深蹲','器械推胸','坐姿划船','杠铃罗马尼亚硬拉','死虫','平板支撑'],
 [],['保加利亚分腿蹲','中立握高位下拉','坐姿划船','俯卧腿弯举','绳索面拉','Pallof Press 抗旋转'],
 [],['杠铃卧推','上斜哑铃卧推','平板哑铃飞鸟'],[],[]
];
for(const [asset,min] of [['assets/anatomy-guides.webp',100000],['assets/anatomy-thumbnails.webp',10000]]){
 const f=path.join(root,asset);
 if(!fs.existsSync(f)||fs.statSync(f).size<min||!html.includes('./'+asset))throw Error('Embedded anatomical art missing: '+asset)
}
if(!html.includes('background-size:200% 700%')||!html.includes('background-size:700% 200%'))throw Error('Sprite positions changed');
const code=[
 sect('const planTemplates=','];'),sect('const coachLoads=','};'),
 sect('const exerciseGuides=','};'),sect('const GUIDE_ATLAS=','};'),
 'const stepGoalRange=()=>"6500–7500",coachWeight=()=>25,phaseWeek=()=>week,trainingIndex=()=>day;',
 'const localDate=()=>"2026-10-08",shiftDate=()=>localDate(),adaptiveRule=()=>({});',
 'const weightTrendRule=()=>({extraMinutes:extra,suppressExtra:false}),recovery={state:poor?"poor":"ok"},recoveryRule=()=>({suppressExtra:false});',
 func('resolveExercise','function weightTrendRule'),
 func('currentPlansBase','function adaptiveRule'),
 func('currentPlans','function planAffectedByPain'),
 func('guideSvg','function toggleExerciseGuide'),
 'return {planTemplates,plans:currentPlans(),exerciseGuides,GUIDE_ATLAS,guideSvg};'
].join('\n');
const evaluate=new Function('week','day','poor','extra',code);
const first=evaluate(1,0,false,0),errors=[];let cases=0,mappings=0,cycling=0;
if(first.planTemplates.length!==7)errors.push('7-day training cycle changed');
if(Object.keys(first.exerciseGuides).sort().join()!==Object.keys(images).sort().join())errors.push('14 exercise guides inventory changed');
if(new Set(Object.values(images).map(v=>v.slice(1).join(','))).size!==14)errors.push('Duplicate image panels');
for(let week=1;week<=12;week++)for(let day=0;day<7;day++)for(const poor of [false,true])for(const extra of [0,10]){
 cases++;const {plans,exerciseGuides,GUIDE_ATLAS,guideSvg}=evaluate(week,day,poor,extra);
 const rows=plans[day][3],actual=rows.map(r=>r.split('｜')[0]).filter(n=>images[n]);
 if(JSON.stringify(actual)!==JSON.stringify(expectedDays[day]))errors.push('Week '+week+' day '+(day+1)+' exercise list mismatch: '+actual);
 if(day===1||day===5){cycling++;if(!plans[day][1].includes('骑车')||!rows.some(r=>r.includes('Zone 2'))||actual.length)errors.push('Cycling incorrectly mapped on week '+week+' day '+(day+1))}
 if((day===3||day===6)&&actual.length)errors.push('Rest has strength images');
 for(const name of actual){mappings++;const g=exerciseGuides[name],expected=images[name];
  if(!g||g.pose!==expected[0]||JSON.stringify(GUIDE_ATLAS[g.pose])!==JSON.stringify(expected.slice(1)))
   errors.push('Wrong anatomical image week '+week+' day '+(day+1)+': '+name);
  if(!guideSvg(name,true).includes('background-position:')||!guideSvg(name,false).includes('background-position:'))errors.push('Missing thumbnail or enlarged art '+name);
 }
 if(week%4===0&&day===0&&rows[1].includes('3组'))errors.push('Deload missing on week '+week);
}
if(errors.length){console.error(errors.slice(0,30).join('\n'));process.exitCode=1}
else console.log('PASS: '+cases+' scenarios, '+mappings+' image mappings, 14 unique strength actions, '+cycling+' cycling variants; artwork unchanged.');


// Release safety checks: historic water, sleep arithmetic and cycling vs recovery.
{
 const releaseHelpers=func('validWater','function updateBasicsSummary(');
 const check=new Function(releaseHelpers+';return {waterCountFor,calculateSleepHours};')();
 for(const [value,want] of [
  [{water:2.7,waterCount:null},6],[{water:1.8},4],
  [{water:1.35,waterCount:3},3],[{water:0,waterCount:0},0],
  [{water:1.8,waterCount:""},4]
 ]) if(check.waterCountFor(value)!==want)throw Error('Wrong legacy water amount: '+JSON.stringify(value));
 if(check.calculateSleepHours('23:30','07:00')!==7.5||
    check.calculateSleepHours('22:45','06:15')!==7.5||
    check.calculateSleepHours('24:00','08:00')!==null)throw Error('Sleep time arithmetic changed');
 const rideJs=func('rideStorageKey','function exerciseName(');
 function mockRide(day){
  const memo=new Map(),notices=[];
  const harness='const localStorage={getItem:k=>memo.has(k)?memo.get(k):null,setItem:(k,v)=>memo.set(k,String(v)),removeItem:k=>memo.delete(k)};'+
   'const localDate=()=>"2026-10-08",trainKey="ckTrain-2026-10-08";'+
   'const safeJsonParse=(v,f)=>{try{return v?JSON.parse(v):f}catch(e){return f}};'+
   'let trainDone=false,recovery={state:"ok"};'+
   'const planKind=idx=>[0,2,4].includes(idx)?"strength":[1,5].includes(idx)?"cardio":"rest",trainingIndex=()=>DAY;'+
   'const document={getElementById:k=>({value:k==="rideMinutes"?"47":"4"})};'+
   'const alert=s=>notices.push(s),renderTraining=()=>{},refreshNutritionGuidance=()=>{};';
  return new Function('memo','notices','DAY',harness+rideJs+'return {saveTodayRide,undoTodayRide,storedRide,restDayHtml,cardioDayHtml,getDone:()=>trainDone};')(memo,notices,day);
 }
 for(let day=0;day<7;day++){
  const p=mockRide(day);
  p.saveTodayRide();
  if(day===1||day===5){
   const r=p.storedRide();
   if(!p.getDone()||r?.minutes!==47||r?.rpe!==4)throw Error('Ride save failed on day '+(day+1));
   p.undoTodayRide();if(p.getDone()||p.storedRide())throw Error('Ride undo failed on day '+(day+1));
  }else if(p.getDone()||p.storedRide())throw Error('Non-ride day incorrectly marked: '+(day+1));
  if((day===3||day===6)&&!p.restDayHtml(["优先恢复"]).includes("无需打卡"))
   throw Error('Recovery day requires unwanted checklist');
 }
 console.log('PASS: legacy hydration, overnight sleep and all 7 cycling/recovery/strength day routes.');
}

/* Dedicated dumbbell-fly image + warmup regression: critical because the fly
   is intentionally not a panel of the older anatomy sprite. */
{
 const flyArt=path.join(root,'assets/flat-fly-320-30.webp');
 if(!fs.existsSync(flyArt)||fs.statSync(flyArt).size<4000||!html.includes('./assets/flat-fly-320-30.webp'))throw Error('Dedicated flat fly art missing');
 const guideCode=sect('function guideSvg(name,compact=false){','function toggleExerciseGuide(').slice(0,-'function toggleExerciseGuide('.length);
 const flyGuide=new Function('exerciseGuides','GUIDE_ATLAS',guideCode+';return guideSvg;')(
  {'平板哑铃飞鸟':{pose:'fly'}},{fly:[6,1]});
 const thumb=flyGuide('平板哑铃飞鸟',true),large=flyGuide('平板哑铃飞鸟',false);
 if(!thumb.includes('flyThumb')||!large.includes('flyGuideScene')||!thumb.includes('background-position:')||!large.includes('background-position:'))throw Error('Flat fly must have separate compact and expanded art');
 const benchCode=sect('function benchWarmupHint(){','function exerciseHtml(').slice(0,-'function exerciseHtml('.length);
 const hint=new Function('coachWeight','phaseWeek',benchCode+'return benchWarmupHint();');
 const standard=hint(()=>45,()=>1),deload=hint(()=>40,()=>4);
 if(!standard.includes('空杆20 kg')||!standard.includes('30 kg × 3–5次')||!standard.includes('45 kg × 2组正式训练'))throw Error('45 kg bench warmup changed');
 if(!deload.includes('40 kg × 1组正式训练'))throw Error('Deload bench set count changed');
 if(html.includes('localStorage.clear('))throw Error('Unsafe localStorage.clear');
 console.log('PASS: dedicated fly art, 45kg ramp warmup, deload warmup and localStorage guard');
}

// Per-user incline strength calibration: 20 kg / hand ×12 actual reps.
// Only the confirmed exercise may be rebaselined; old sessions are immutable.
{
 if(!html.includes('incline:{base:20,inc:2,unit:"每手 kg",round:1}'))throw Error('Incline base must use confirmed 20kg');
 if(!html.includes('上斜哑铃卧推｜2组 × 8–12次'))throw Error('Incline work set reps should allow observed 12 reps');
 const body=sect('function calibrateInclineWorkingLoad(){','calibrateInclineWorkingLoad();');
 const make=(overrides={},session={},done=false,feedback=false)=>{
  const store=new Map([
   ['ckLoadOverrides',JSON.stringify(overrides)],
   ['ckSessionLoads-2026-10-10',JSON.stringify(session)],
   ['ckTrain-2026-10-09','1'],['ckSessionLoads-2026-10-09',JSON.stringify({incline:12,bench:45})]
  ]);
  const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size}};
  const bodyFn=new Function('localStorage','loadOverrides','sessionLoads','exerciseDone','exerciseFeedback','sessionLoadKey',
    body+'return calibrateInclineWorkingLoad;');
  const a={...overrides},b={...session},run=bodyFn(storage,a,b,done?{'上斜哑铃卧推':true}:{},feedback?{'上斜哑铃卧推':{level:'good',next:12,key:'incline'}}:{},'ckSessionLoads-2026-10-10');
  return {store,a,b,run};
 };
 let p=make({incline:12,bench:45},{incline:12,bench:45});
 if(p.a.incline!==20||p.b.incline!==20||p.a.bench!==45||p.b.bench!==45)throw Error('Legacy 12kg should become 20kg without changing bench');
 if(p.store.get('ckSessionLoads-2026-10-09')!==JSON.stringify({incline:12,bench:45})||p.store.get('ckTrain-2026-10-09')!=='1')throw Error('Historic loads/train completion altered');
 p.a.incline=18;p.run();if(p.a.incline!==18)throw Error('One-time calibration overwrote subsequent user choice');
 p=make({incline:24,bench:45},{incline:24});if(p.a.incline!==24||p.b.incline!==24)throw Error('Higher existing manual/feedback load lowered');
 p=make({incline:12},{incline:12},true,false);if(p.a.incline!==20||p.b.incline!==12)throw Error('Completed today load should not be rewritten');
 p=make({incline:12},{incline:12},false,true);if(p.b.incline!==12||p.a.incline!==20)throw Error('Today feedback snapshot should be preserved');
 p=make({bench:45},{bench:45});if(p.a.incline!==20||p.b.incline!==undefined)throw Error('Do not invent a missing session snapshot');
 if(html.includes('localStorage.clear('))throw Error('Unsafe storage clear');
 console.log('PASS: incline 20kg×12 calibration; preserve old sessions, current completion, feedback and user loads');
}

/* Category-wide regression for user-calibrated vs uncalibrated exercise loads. */
{
 const n=[...html.matchAll(/^ \w+:\{base:[^\n]+/gm)].map(m=>m[0].split(':')[0].trim());
 if(n.length!==13||new Set(n).size!==13)throw Error('Expected 13 independent load slots');
 if(!html.includes('通用参考起点 · 尚未校准'))throw Error('Unknown loads must not look personalized');
 if(!html.includes('function loadReferenceEditorHtml(')||!html.includes('function saveReferenceLoad('))throw Error('Optional override missing');
 if(!html.includes('function compoundWarmupHint('))throw Error('Compound warmup mapping missing');
 if(!html.includes('<option value="ankle">踝部疼痛</option>')||!html.includes('ankle:["深蹲","保加利亚"]'))throw Error('Ankle pain must affect relevant exercises');
 if(!html.includes('Number(loadOverrides[fb.key])!==Number(fb.next)'))throw Error('Recovery replay must respect manual reference');
 const loadCode=sect('function validCoachWeight(v){','function loadKeyForExercise(').slice(0,-'function loadKeyForExercise('.length);
 const load=new Function('coachLoads','sessionLoads','loadOverrides','recovery','phaseWeek','roundTo',
  loadCode+'return {validCoachWeight,workingWeight,coachWeight};');
 const c={bench:{base:45,round:2.5},incline:{base:20,round:1}};
 const r=load(c,{bench:0,incline:0},{bench:0,incline:24},{state:'ok'},()=>1,(v,x)=>Math.round(v/x)*x);
 if(r.validCoachWeight(null)||r.validCoachWeight(0)||r.validCoachWeight('')||
   r.workingWeight('bench')!==45||r.workingWeight('incline')!==24||
   r.coachWeight('bench')!==45||r.coachWeight('incline')!==24)
   throw Error('Invalid data or user load precedence');
 const helperCode=sect('let openLoadEditorKey="";','function exerciseHtml(').slice(0,-'function exerciseHtml('.length);
 const memory=new Map([['ckTrain-2026-10-09','1']]);
 const localStorage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v))};
 const override={bench:45},today={};
 const editor=new Function('localStorage','coachLoads','loadOverrides','sessionLoads','phaseWeek','coachWeight','roundTo','benchWarmupHint',
  'exerciseDone','exerciseFeedback','sessionLoadKey','renderTraining','document','alert','workingWeight',
  helperCode+'return {compoundWarmupHint,loadSourceLabel,saveReferenceLoad,toggleLoadEditor,loadReferenceEditorHtml};');
 const plan={bench:{base:45,round:2.5,unit:'kg'},squatA:{base:40,round:2.5,unit:'kg'},split:{base:8,round:1,unit:'每手 kg'}};
 const ui=editor(localStorage,plan,override,today,()=>1,k=>k==='bench'?45:k==='squatA'?60:8,
  (v,n)=>Math.round(v/n)*n,()=>'',{}, {},'ckSessionLoads-2026-10-10',()=>{},
  {getElementById:()=>({value:'60'})},()=>{},k=>override[k]||plan[k].base);
 if(!ui.compoundWarmupHint('热身｜杠铃深蹲递增热身').includes('60 kg × 3组')||
    !ui.compoundWarmupHint('热身｜保加利亚分腿蹲递增热身').includes('徒手每侧'))throw Error('Squat/split warmup not linked to suggested load');
 if(!ui.loadSourceLabel('squatA').includes('未校准')||!ui.loadSourceLabel('bench').includes('调整'))throw Error('Load source status incorrect');
 ui.saveReferenceLoad('squatA','杠铃深蹲');
 if(override.squatA!==60||today.squatA!==60||memory.get('ckTrain-2026-10-09')!=='1')throw Error('Editing a reference must not damage history');
 if(html.includes('localStorage.clear('))throw Error('Unsafe clear');
 console.log('PASS: 13 load slots; uncalibrated labels; overrides; squat/split/bench ramp; ankle-specific guard; history preserved');
}
