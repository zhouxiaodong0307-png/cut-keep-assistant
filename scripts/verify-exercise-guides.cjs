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
  'exerciseDone','exerciseFeedback','sessionLoadKey','renderTraining','document','alert','workingWeight','validCoachWeight',
  helperCode+'return {compoundWarmupHint,loadSourceLabel,saveReferenceLoad,toggleLoadEditor,loadReferenceEditorHtml};');
 const plan={bench:{base:45,round:2.5,unit:'kg'},squatA:{base:40,round:2.5,unit:'kg'},split:{base:8,round:1,unit:'每手 kg'}};
 const ui=editor(localStorage,plan,override,today,()=>1,k=>k==='bench'?45:k==='squatA'?60:8,
  (v,n)=>Math.round(v/n)*n,()=>'',{}, {},'ckSessionLoads-2026-10-10',()=>{},
  {getElementById:()=>({value:'60'})},()=>{},k=>override[k]||plan[k].base,r.validCoachWeight);
 if(!ui.compoundWarmupHint('热身｜杠铃深蹲递增热身').includes('60 kg × 3组')||
    !ui.compoundWarmupHint('热身｜保加利亚分腿蹲递增热身').includes('徒手每侧'))throw Error('Squat/split warmup not linked to suggested load');
 if(!ui.loadSourceLabel('squatA').includes('未校准')||!ui.loadSourceLabel('bench').includes('调整'))throw Error('Load source status incorrect');
 ui.saveReferenceLoad('squatA','杠铃深蹲');
 if(JSON.parse(memory.get('ckLoadOverrides')||'{}').squatA!==60||JSON.parse(memory.get('ckSessionLoads-2026-10-10')||'{}').squatA!==60||memory.get('ckTrain-2026-10-09')!=='1')throw Error('Editing a reference must not damage history');
 if(html.includes('localStorage.clear('))throw Error('Unsafe clear');
 console.log('PASS: 13 load slots; uncalibrated labels; overrides; squat/split/bench ramp; ankle-specific guard; history preserved');
}

/* End-to-end training execution: one user-visible bug must test every adjacent step.
   Runs 7-day training route, 12-week anatomy mappings (above), plus actual completion,
   feedback, next-action focus, all-done, hydration/food/progress anchors and undo. */
{
 const requiredPages=['today','diet','training','progress'];
 for(const page of requiredPages){
   if(!html.includes('id="view-'+page+'"'))throw Error('Missing main screen '+page);
 }
 for(const fn of ['renderTraining','renderProgress','renderRecoveryBasics','renderWaterTracker','saveRecoveryBasics','completeWaterServing','undoWaterServing','exportDataBackup','restoreDataBackup','setExerciseFeedback','toggleExerciseDone','toggleExerciseGuide','saveTodayRide'])
  if(!html.includes('function '+fn+'('))throw Error('App regression: '+fn);
 const flowCode=sect('function exerciseName(a){','function benchWarmupHint(){').slice(0,-'function benchWarmupHint(){'.length);
 const feedbackCode=sect('function setExerciseFeedback(name,level){','function recalcFeedbackForRecovery(){').slice(0,-'function recalcFeedbackForRecovery(){'.length);
 const completeCode=sect('function completeAllExercises(){','function renderExerciseList(').slice(0,-'function renderExerciseList('.length);
 function instance(){
   const stores=new Map([['ckTrain-2026-10-09','1'],['ckSteps-2026-10-09','6500'],['ckMeals-2026-10-09','[]']]);
   const scrolled=[],rendered=[];
   const source=
    'const localStorage={getItem:k=>stores.has(k)?stores.get(k):null,setItem:(k,v)=>stores.set(k,String(v)),removeItem:k=>stores.delete(k)};'+
    'const names=["热身","杠铃卧推","平板哑铃飞鸟"];'+
    'const plan=()=>[["训练日1","胸部",null,names.map(n=>n+"｜工作组")],["训练日2","Zone 2",null,[]],["训练日3","腿背",null,[]],["训练日4","恢复",null,[]],["训练日5","胸部",null,[]],["训练日6","Zone 2",null,[]],["训练日7","休息",null,[]]];'+
    'const currentPlans=()=>plan(),trainingIndex=()=>0,planKind=()=> "strength";'+
    'const loadKeyForExercise=n=>n==="杠铃卧推"?"bench":n==="平板哑铃飞鸟"?"fly":null;'+
    'const window={todayPlanDetails:{}},todayPlanDetails=window.todayPlanDetails;'+
    'const requestAnimationFrame=fn=>fn();'+
    'const document={getElementById:id=>({scrollIntoView:()=>scrolled.push(id)})};'+
    'let exerciseDone={},exerciseFeedback={},trainDone=false,openExerciseGuide="杠铃卧推",openLoadEditorKey="bench",loadOverrides={},sessionLoads={};'+
    'const exerciseDoneKey="ckExerciseDone-2026-10-10",exerciseFeedbackKey="ckExerciseFeedback-2026-10-10",trainKey="ckTrain-2026-10-10";'+
    'const sessionLoadKey="ckSessionLoads-2026-10-10",coachLoads={bench:{unit:"kg"},fly:{unit:"每手 kg"}};'+
    'const renderTraining=()=>rendered.push("training"),refreshNutritionGuidance=()=>{};'+
    'const rollbackExerciseFeedback=()=>{},feedbackNextWeight=()=>45;'+
    'const validCoachWeight=v=>v!==null&&v!==undefined&&Number(v)>0,workingWeight=()=>45;'+
    flowCode+feedbackCode+completeCode+
    'return {toggleExerciseDone,setExerciseFeedback,completeAllExercises,trainingFlowGuideHtml,scroll:scrolled,stores,getDone:()=>({...exerciseDone}),getFb:()=>({...exerciseFeedback}),getTrainDone:()=>trainDone,rendered};';
   return new Function('stores','scrolled','rendered',source)(stores,scrolled,rendered);
 }
 let f=instance();
 f.toggleExerciseDone('热身');
 if(f.scroll.at(-1)!=='exercise-step-1')throw Error('Warmup completion must lead to next action');
 f.toggleExerciseDone('杠铃卧推');
 if(f.scroll.at(-1)!=='feedback-step-1')throw Error('Weighted completion must focus feedback, not bury it under illustrations');
 f.setExerciseFeedback('杠铃卧推','good');
 if(f.scroll.at(-1)!=='exercise-step-2'||!f.getFb()['杠铃卧推'])throw Error('Feedback must lead to next action');
 f.toggleExerciseDone('平板哑铃飞鸟');
 if(f.scroll.at(-1)!=='feedback-step-2')throw Error('Last working action must focus feedback');
 f.setExerciseFeedback('平板哑铃飞鸟','hard');
 if(!f.getTrainDone()||f.scroll.at(-1)!=='exercise-flow-guide'||f.stores.get('ckTrain-2026-10-10')!=='1')throw Error('Completed session must be saved and show next-day note');
 if(f.stores.get('ckTrain-2026-10-09')!=='1'||f.stores.get('ckMeals-2026-10-09')!=='[]')throw Error('Past history was modified');
 f.toggleExerciseDone('平板哑铃飞鸟');
 if(f.getTrainDone()||f.getFb()['平板哑铃飞鸟'])throw Error('Undo must correctly remove completion and related feedback');
 f=instance();f.completeAllExercises();
 if(!f.getTrainDone()||f.scroll.at(-1)!=='feedback-step-1')throw Error('Bulk completion must surface missing weight feedback');
 if(!html.includes('finishedCompact')||!html.includes('toggleFeedbackEditor(')||!html.includes('nextExerciseStep('))throw Error('Compact done cards or next-action UI missing');
 if(!html.includes('onclick="toggleFeedbackEditor(&quot;'))throw Error('Feedback editor HTML-attribute quoting unsafe');
 if(html.includes('localStorage.clear('))throw Error('Data clearing forbidden');
 console.log('PASS: all four screens, action -> feedback -> next action, completed session, bulk completion, undo and legacy-data preservation.');
}

/* Cross-module invariant: manual load edits win over undo/recovery replay; pain status cannot claim full progression. */
{
 if(!html.includes('painLimitsToday?"部分暂停":"允许"'))throw Error('Pain-aware top-level progression label missing');
 if(!html.includes('疼痛相关动作暂不自动加重，其他无痛动作按计划执行'))throw Error('Pain status must explain per-exercise restriction');
 const extracted=sect('function rollbackExerciseFeedback(name){','function setExerciseFeedback(name,level){').slice(0,-'function setExerciseFeedback(name,level){'.length);
 const make=(next,prev,current)=>{
  const state={incline:current},logs=[],fb={'上斜哑铃卧推':{key:'incline',next,prev}},session={incline:20};
  const fn=new Function('exerciseFeedback','loadOverrides','sessionLoads','coachLoads','localStorage','validCoachWeight',
    extracted+'return rollbackExerciseFeedback;');
  fn(fb,state,session,{incline:{base:20}},{setItem:(k,v)=>logs.push([k,v])},
    x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(+x)&&+x>0)('上斜哑铃卧推');
  return {current:state.incline,logs};
 };
 let r=make(22,20,26);
 if(r.current!==26||r.logs.length)throw Error('Undo overwrote more recent manual weight');
 r=make(22,20,22);
 if(r.current!==20||r.logs.length!==1)throw Error('Undo did not restore the true previous weight');
 if(html.includes('localStorage.clear('))throw Error('Historical data should never be cleared');
 console.log('PASS: manual load priority through undo; pain status matches per-exercise restrictions');
}

/* Wider full-app smoke coverage after execution-flow changes: actual mutation guards on
   diet, weight, steps and portable backup (without touching a user's live device data). */
{
 const saveFns=sect('function saveWeight(){','function renderProgress(){').slice(0,-'function renderProgress(){'.length);
 const makeSave=new Function('localStorage','weightInput','stepInput','localDate','renderProgress','render','maybeAdvanceStepGoal','alert',
  'let weights=[{date:"2026-10-09",weight:79}],steps=[{date:"2026-10-09",steps:6500}];'+
  saveFns+'return {saveWeight,saveSteps,read:()=>({weights,steps})};');
 const store=new Map([['ckWeights','[{"date":"2026-10-09","weight":79}]'],
  ['ckSteps','[{"date":"2026-10-09","steps":6500}]'],['ckTrain-2026-10-09','1']]);
 const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),
  key:i=>[...store.keys()][i],get length(){return store.size}};
 const values=makeSave(storage,{value:'78.5'},{value:'7500'},()=> '2026-10-10',()=>{},()=>{},()=>{},()=>{});
 values.saveWeight();values.saveSteps();
 if(values.read().weights.length!==2||values.read().steps.length!==2||
    values.read().weights[1].weight!==78.5||values.read().steps[1].steps!==7500||
    store.get('ckTrain-2026-10-09')!=='1')throw Error('Progress update lost prior record/strength completion');
 const manual=sect('function saveManualMeal(){','const exerciseGuides=').slice(0,-'const exerciseGuides='.length);
 const mealInput={value:'一份午餐'},kcalInput={value:'620'},proInput={value:'40'},carbInput={value:'60'},fatInput={value:'20'},foodText={value:''},ui={style:{}};
 const makeManual=new Function('localStorage','mmName','mmKcal','mmProtein','mmCarbs','mmFat','foodText','manualMeal','result',
 'window','alert','render','normalizeFoodName','key',
 'let meals=[],customFoods=[],pending=null;'+manual+'return {saveManualMeal,read:()=>({meals,customFoods})};');
 const meal=makeManual(storage,mealInput,kcalInput,proInput,carbInput,fatInput,foodText,ui,ui,{},()=>{},()=>{},v=>v,'ckMeals-2026-10-10');
 meal.saveManualMeal();
 if(meal.read().meals[0]?.kcal!==620||meal.read().meals[0]?.protein!==40||
   JSON.parse(store.get('ckMeals-2026-10-10')||'[]')[0]?.carbs!==60||
   store.get('ckTrain-2026-10-09')!=='1')throw Error('Manual meal saving broke nutrition or past training');
 const portable=sect('function portableData(){','function trimSafetySnapshots(){').slice(0,-'function trimSafetySnapshots(){'.length);
 store.set('ckAppBuild','old-build');store.set('ckUpgradeBackup-before','safe-snapshot');
 const exportable=new Function('localStorage','UPGRADE_BACKUP_PREFIX',portable+'return portableData();')(storage,'ckUpgradeBackup-');
 if(!exportable['ckMeals-2026-10-10']||!exportable['ckWeights']||!exportable['ckSteps']||
   exportable.ckAppBuild||exportable['ckUpgradeBackup-before'])throw Error('Backup does not preserve live data or leaks snapshots');
 if(html.includes('localStorage.clear('))throw Error('Unsafe historic data deletion');
 console.log('PASS: diet persistence, weight/step progress, backup round-trip content, old records and all four screens');
}
