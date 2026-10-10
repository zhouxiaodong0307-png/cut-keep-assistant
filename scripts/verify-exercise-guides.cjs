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
 [],['杠铃卧推','上斜哑铃卧推','平板哑铃飞鸟','中立握高位下拉','杠铃罗马尼亚硬拉','Pallof Press 抗旋转'],[],[]
];
for(const [asset,min] of [['assets/anatomy-guides.webp',100000],['assets/anatomy-thumbnails.webp',10000]]){
 const f=path.join(root,asset);
 if(!fs.existsSync(f)||fs.statSync(f).size<min||!html.includes('./'+asset))throw Error('Embedded anatomical art missing: '+asset)
}
if(!html.includes('background-size:200% 700%')||!html.includes('background-size:700% 200%'))throw Error('Sprite positions changed');
const code=[
 sect('const planTemplates=','];'),sect('const LEGACY_V47_PLAN_TEMPLATES=','];'),sect('const coachLoads=','};'),
 sect('const exerciseGuides=','};'),sect('const GUIDE_ATLAS=','};'),
 'const stepGoalRange=()=>"6500–7500",coachWeight=()=>25,phaseWeek=()=>week,trainingIndex=()=>day;',
 'const localStorage={getItem:()=>null,setItem:()=>{}},exerciseDone={};let trainDone=false;',
 'const localDate=()=>"2026-10-08",shiftDate=()=>localDate(),adaptiveRule=()=>({});',
 'const weightTrendRule=()=>({extraMinutes:extra,suppressExtra:false}),recovery={state:poor?"poor":"ok"},recoveryRule=()=>({suppressExtra:false});',
 'const storedRide=()=>null,recentExtraLoad=()=>({minutes:0,maxRpe:0,heavy:false,substantial:false});',
 'const integratedTrainingDecision=()=>({reduceLower:false,load:{highLoad:false,moderate:false}}),rideAffectsLowerBody=()=>false;',
 'const applyCardioLoadPrescription=()=>{},completedCardioRecovery=()=>false;',
 sect('const VOLUME_HISTORY_KEY=','function weightTrendRule(').slice(0,-'function weightTrendRule('.length),
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
   'const cardioRecoveryKey=()=>"ckCardioRecovery-2026-10-08",cardioLoadPrescription=()=>null,completedCardioRecovery=()=>false;'+
   'const planKind=idx=>[0,2,4].includes(idx)?"strength":[1,5].includes(idx)?"cardio":"rest",trainingIndex=()=>DAY;'+
   'const document={getElementById:k=>({value:k==="rideMinutes"?"47":"4"})};'+
   'const alert=s=>notices.push(s),renderTraining=()=>{},refreshNutritionGuidance=()=>{},rpeOptionList=()=>"",rpeEffortLabel=()=>"";';
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
 if(!standard.includes('空杆20 kg')||!standard.includes('30 kg × 3–5次')||!standard.includes('45 kg × 3组正式训练'))throw Error('45 kg bench warmup changed');
 if(!deload.includes('40 kg × 2组正式训练'))throw Error('Deload bench set count changed');
 if(html.includes('localStorage.clear('))throw Error('Unsafe localStorage.clear');
 console.log('PASS: dedicated fly art, 45kg ramp warmup, deload warmup and localStorage guard');
}

// Per-user incline strength calibration: 20 kg / hand ×12 actual reps.
// Only the confirmed exercise may be rebaselined; old sessions are immutable.
{
 if(!html.includes('incline:{base:20,inc:2,unit:"每手 kg",round:1}'))throw Error('Incline base must use confirmed 20kg');
 if(!html.includes('上斜哑铃卧推｜3组 × 8–12次'))throw Error('Incline work set reps should allow observed 12 reps');
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
 if(!html.includes('function trainingReferenceEditorHtml(')||!html.includes('function saveTrainingReference(')||!html.includes('function saveReferenceLoad('))throw Error('Optional volume and load overrides missing');
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
  helperCode+'return {compoundWarmupHint,loadSourceLabel,saveReferenceLoad,toggleLoadEditor,trainingReferenceEditorHtml};');
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

/* Visual regression: V45 completed-card design is explicitly user-approved.
   A training-plan complaint must not silently redesign completed states or navigation. */
{
 for(const view of ['today','diet','training','progress']){
  if(!html.includes('id="view-'+view+'"'))throw Error('Missing application view '+view);
 }
 if(!html.includes('.exerciseRow.isDone{opacity:.58}')||!html.includes('text-decoration:line-through'))
  throw Error('The original muted/struck completed style has been changed');
 for(const removed of ['finishedCompact','feedbackCompact','exerciseFlowGuide','trainingFlowGuideHtml',
    'jumpToExerciseStep','openFeedbackEditor','continueTrainingFlow']){
  if(html.includes(removed))throw Error('Unrequested training UI survived: '+removed);
 }
 const rowSrc=sect('function exerciseHtml(a,i,interactive=false){','function completeAllExercises(){').slice(0,-'function completeAllExercises(){'.length);
 const row=new Function('exerciseDone','exerciseFeedback','openExerciseGuide','loadKeyForExercise','exerciseAffectedByPain','exerciseGuides',
  'guideSvg','loadReferenceEditorHtml','exerciseGuideHtml','compoundWarmupHint','coachLoads','recoveryRule','parseExerciseVolume','trainingReferenceEditorHtml',
  rowSrc+'return exerciseHtml;')(
  {'杠铃卧推':true},{'杠铃卧推':{level:'good',next:45,key:'bench'}},'',()=> 'bench',()=>false,
  {'杠铃卧推':{pose:'bench'}},()=>'',()=>'',()=>'',()=>'',{bench:{unit:'kg'}},()=>({text:''}),()=>({sets:3,min:6,max:8,unit:'次'}),()=>'' );
 const done=row('杠铃卧推｜正式组 2组 × 6–8次｜推荐重量：45 kg｜休2–3分钟',1,true);
 if(!done.includes('exerciseRow isDone')||!done.includes('已完成 ✓')||
   !done.includes('45 kg')||!done.includes('完成反馈')||!done.includes('合适')||
   !done.includes('effortBtn active')||done.includes('finishedCompact'))
  throw Error('Completed work set must retain original full V45 card and feedback');
 const active=new Function('exerciseDone','exerciseFeedback','openExerciseGuide','loadKeyForExercise','exerciseAffectedByPain','exerciseGuides',
  'guideSvg','loadReferenceEditorHtml','exerciseGuideHtml','compoundWarmupHint','coachLoads','recoveryRule','parseExerciseVolume','trainingReferenceEditorHtml',
  rowSrc+'return exerciseHtml;')(
  {},{},'',()=> 'bench',()=>false,{'杠铃卧推':{pose:'bench'}},()=>'',()=>'',()=>'',()=>'',{bench:{unit:'kg'}},()=>({text:''}),()=>({sets:3,min:6,max:8,unit:'次'}),()=>'' )
  ('杠铃卧推｜正式组 2组 × 6–8次｜推荐重量：45 kg｜休2–3分钟',1,true);
 if(active.includes('exerciseRow isDone')||!active.includes('>完成</button>')||
   active.includes('完成反馈'))throw Error('Unfinished training card changed');
 const listCode=sect('function completeAllExercises(){','function planKind(').slice(0,-'function planKind('.length);
 const list=new Function('exerciseDone','exerciseName','exerciseHtml',listCode+'return renderExerciseList;')(
  {'杠铃卧推':true},v=>v.split('｜')[0],v=>'<article>'+v+'</article>');
 const listMarkup=list(['热身｜5分钟','杠铃卧推｜45 kg'],true);
 if(!listMarkup.includes('完成进度 1 / 2')||!listMarkup.includes('一键完成')||
    listMarkup.includes('下一动作')||listMarkup.includes('exerciseFlowGuide'))
  throw Error('Training list changed beyond user-authorized scope');
 for(const fn of ['renderTraining','renderProgress','renderRecoveryBasics','renderWaterTracker','saveRecoveryBasics',
   'completeWaterServing','undoWaterServing','exportDataBackup','restoreDataBackup',
   'setExerciseFeedback','toggleExerciseDone','toggleExerciseGuide','saveTodayRide']){
  if(!html.includes('function '+fn+'('))throw Error('Core screen or training handler missing '+fn);
 }
 if(html.includes('localStorage.clear('))throw Error('Never clear user history');
 console.log('PASS: V45 completed UI restored, feedback retained, no unintended card redesign, four screens and training handlers.');
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

/* 4-year-experience cut-phase volume: audit 3 days, all 12 training weeks, recovery
   and preserve in-progress V47 users without migrating historical done flags. */
{
 const block=sect('const planTemplates=','];'),legacy=sect('const LEGACY_V47_PLAN_TEMPLATES=','];');
 const program=new Function(block.replace('const planTemplates=','const p=')+'return p;')();
 const old=new Function(legacy.replace('const LEGACY_V47_PLAN_TEMPLATES=','const p=')+'return p;')();
 const count=p=>p[3].filter(r=>!r.startsWith('热身')).reduce((sum,x)=>sum+(+x.match(/(\d+)组/)?.[1]||0),0);
 const strengthDays=[0,2,4],normal=strengthDays.map(i=>count(program[i])),historical=strengthDays.map(i=>count(old[i]));
 if(JSON.stringify(normal)!==JSON.stringify([16,16,15]))throw Error('Experienced strength days should be balanced at 16/16/15 nominal sets; got '+normal);
 if(JSON.stringify(historical)!==JSON.stringify([13,12,5]))throw Error('V47 safety reference corrupted');
 for(let i of strengthDays){
   const actions=program[i][3].filter(r=>/推荐重量|自重/.test(r));
   if(actions.length<6||actions.some(x=>/\b1组/.test(x)))throw Error('Normal week has a single-set or skeletal strength day '+i);
 }
 if(program[4][1]!=='全身力量 C（胸部主导）')throw Error('C must retain a chest-focus while training the full body');
 const initial=sect('const VOLUME_HISTORY_KEY=','function weightTrendRule(').slice(0,-'function weightTrendRule('.length);
 const make=fn=>new Function('recovery','phaseWeek','stepGoalRange','coachLoads','coachWeight','localDate','localStorage','exerciseDone','trainingIndex','integratedTrainingDecision','rideAffectsLowerBody',
   initial+'return resolveExercise;')({state:fn.state},()=>fn.week,()=> '6500–7500',
   {bench:{unit:'kg'}},()=>45,()=> '2026-10-10',{getItem:()=>null,setItem:()=>{}},{},()=>4,()=>({reduceLower:false}),()=>false);
 for(const week of [1,2,3,4,8,12])for(const state of ['ok','poor']){
   const resolve=make({state,week}),base=3,sets=+resolve('杠铃卧推｜3组 × 6–8次｜推荐重量：@bench',true).match(/(\d+)组/)[1],anticipated=week%4===0||state==='poor'?2:3;
   if(sets!==anticipated)throw Error('Deload/recovery volume mismatch week '+week+' '+state+' -> '+sets);
   const future=+resolve('杠铃卧推｜3组 × 6–8次｜推荐重量：@bench',false).match(/(\d+)组/)[1];
   if(future!==(week%4===0?2:3))throw Error('Today-only recovery erroneously lowered future plan');
 }
 const activeSrc=sect('function currentPlansBase(){','function adaptiveRule(').slice(0,-'function adaptiveRule('.length);
 const mk=(done,revision)=>{
   const kv=new Map([['ckTrain-2026-10-09','1']]);
   if(revision)kv.set('ckStrengthPlanRevision-2026-10-10',revision);
   const localStorage={getItem:k=>kv.has(k)?kv.get(k):null,setItem:(k,v)=>kv.set(k,String(v))};
   const fn=new Function('localStorage','localDate','trainDone','exerciseDone','trainingIndex','planTemplates','LEGACY_V47_PLAN_TEMPLATES','stepGoalRange','resolveExercise',
     activeSrc+'return currentPlansBase;')(
      localStorage,()=> '2026-10-10',done,done?{'热身':true}:{},()=>4,program,old,()=> '6500–7500',x=>x);
   return {p:fn(),kv};
 };
 const existing=mk(true),fresh=mk(false),forced=mk(false,'v47');
 if(count(existing.p[4])!==5||count(fresh.p[4])!==15||count(forced.p[4])!==5)throw Error('Existing training progress not frozen while new sessions upgrade');
 if(existing.kv.get('ckStrengthPlanRevision-2026-10-10')!=='v47'||fresh.kv.get('ckStrengthPlanRevision-2026-10-10')!=='v48')throw Error('Plan revision marker incorrect');
 if(existing.kv.get('ckTrain-2026-10-09')!=='1')throw Error('Historical training changed during volume upgrade');
 if(!html.includes('.exerciseRow.isDone{opacity:.58}')||html.includes('finishedCompact')||html.includes('trainingFlowGuideHtml'))throw Error('Authorized V47 layout must remain unchanged');
 console.log('PASS: 3 trained strength days 16/16/15 sets, full-body C, week4/8/12 deload, day-scoped recovery and in-progress old-session protection');
}

/* V49: optional sets/reps and outcome-aware prescription must persist, never
   misrepresent recommended reps as observed reps or alter prior sessions. */
{
 const helper=sect('const VOLUME_HISTORY_KEY=','function weightTrendRule(').slice(0,-'function weightTrendRule('.length);
 const make=(rows=[],manual={},completed=false,recoveryState='ok',week=1)=>{
  const memory=new Map([
    ['ckTrainingVolumeHistory',JSON.stringify(rows)],
    ['ckTrainingVolumeReferences',JSON.stringify(manual)],
    ['ckTrain-2026-10-09','1'],
    ['ckMeals-2026-10-09','[{"kcal":640}]']
  ]);
  const storage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),key:i=>[...memory.keys()][i],get length(){return memory.size}};
  const done=completed?{'杠铃卧推':true}:{};
  const spec='杠铃卧推｜3组 × 6–8次｜推荐重量：@bench｜休2–3分钟';
  const fakePlan=()=>[[],[],[],[],['C','Full','60 min',[spec]]];
  const harness=new Function('localStorage','localDate','exerciseDone','trainingIndex','phaseWeek','recovery','stepGoalRange','coachLoads','coachWeight','currentPlans','sessionLoads','validCoachWeight','workingWeight','integratedTrainingDecision','rideAffectsLowerBody',
    helper+'return {parseExerciseVolume,adaptiveVolumeReference,applyExerciseVolumeToRow,snapshotCompletedExerciseVolume,recordTrainingVolumeOutcome,undoTrainingVolumeOutcome,volumeTrainingHistory,resolveExercise,validExerciseVolume};');
  const api=harness(storage,()=> '2026-10-10',done,()=>4,()=>week,{state:recoveryState,painArea:''},
     ()=> '6500–7500',{bench:{unit:'kg'}},()=>45,fakePlan,{bench:45},v=>v!==null&&v!==undefined&&+v>0,()=>45,()=>({reduceLower:false}),()=>false);
  return {api,memory,done,spec};
 };
 let h=make();
 const v=h.api.parseExerciseVolume(h.spec);
 if(JSON.stringify(v)!==JSON.stringify({sets:3,min:6,max:8,unit:'次'}))throw Error('Cannot parse base working sets/reps');
 const side=h.api.parseExerciseVolume('Pallof Press 抗旋转｜2组 × 每侧10–12次｜推荐重量：@pallof');
 const seconds=h.api.parseExerciseVolume('平板支撑｜2组 × 30–45秒｜自重');
 if(side?.unit!=='次'||side.min!==10||seconds?.unit!=='秒'||seconds.max!==45)throw Error('Core/bilateral duration parse failed');
 if(h.api.parseExerciseVolume('热身｜5分钟')!==null)throw Error('Warmups must not be editable strength sets');
 if(!h.api.resolveExercise(h.spec,true,4).includes('3组 × 6–8次'))throw Error('Base volume changed without evidence');
 const last=[
  {id:'4|杠铃卧推',date:'2026-10-08',feedback:'hard',time:2},
  {id:'4|杠铃卧推',date:'2026-10-06',feedback:'hard',time:1}
 ];
 h=make(last);
 let r=h.api.resolveExercise(h.spec,true,4);
 if(!r.includes('3组 × 6–7次'))throw Error('Two hard completions should lower the next upper-rep boundary; '+r);
 h=make([{id:'4|杠铃卧推',date:'2026-10-09',feedback:'fail'}]);
 r=h.api.resolveExercise(h.spec,true,4);
 if(!r.includes('2组 × 6–7次'))throw Error('Failed effort must reduce next sets and rep ceiling: '+r);
 h=make([{id:'4|杠铃卧推',date:'2026-10-09',feedback:'light'}]);
 if(!h.api.resolveExercise(h.spec,true,4).includes('3组 × 6–8次'))throw Error('Light effort already increases weight, should not double-increase volume');
 h=make(last,{'4|杠铃卧推':{sets:4,min:8,max:10,unit:'次'}});
 if(!h.api.resolveExercise(h.spec,true,4).includes('4组 × 8–10次'))throw Error('Manual reference must win over hard feedback');
 h=make(last,{'4|杠铃卧推':{sets:4,min:8,max:10,unit:'次'}},false,'poor');
 if(!h.api.resolveExercise(h.spec,true,4).includes('3组 × 8–10次'))throw Error('Poor recovery should temporarily reduce one working set while retaining manual baseline');
 h=make([],{},false,'ok',4);
 if(!h.api.resolveExercise(h.spec,true,4).includes('2组 × 6–8次'))throw Error('Week 4/8/12 must deload the active plan');
 h=make([],{},false,'poor',4);
 if(!h.api.resolveExercise(h.spec,true,4).includes('2组 × 6–8次'))throw Error('Deload+poor recovery must not double-punish workout');
 h=make();
 h.api.snapshotCompletedExerciseVolume('杠铃卧推','杠铃卧推｜3组 × 6–8次',4);
 h.done['杠铃卧推']=true;
 h.memory.set('ckTrainingVolumeReferences',JSON.stringify({'4|杠铃卧推':{sets:5,min:10,max:12,unit:'次'}}));
 if(!h.api.resolveExercise(h.spec,true,4).includes('3组 × 6–8次'))throw Error('Completed action prescription retroactively modified');
 h.api.recordTrainingVolumeOutcome('杠铃卧推','good','bench',45);
 let outcomes=h.api.volumeTrainingHistory();
 if(outcomes.length!==1||outcomes[0].sets!==3||outcomes[0].min!==6||outcomes[0].max!==8||
    outcomes[0].weight!==45||outcomes[0].feedback!=='good'||outcomes[0].date!=='2026-10-10')
    throw Error('Cannot store actual plan/feedback history: '+JSON.stringify(outcomes));
 if('actualReps' in outcomes[0]||'actualSets' in outcomes[0])throw Error('Never invent performed reps or sets');
 h.api.recordTrainingVolumeOutcome('杠铃卧推','hard','bench',45);
 if(h.api.volumeTrainingHistory().length!==1||h.api.volumeTrainingHistory()[0].feedback!=='hard')throw Error('Repeated feedback should update, not duplicate same workout');
 h.api.undoTrainingVolumeOutcome('杠铃卧推',4);
 if(h.api.volumeTrainingHistory().length||h.memory.get('ckTrain-2026-10-09')!=='1'||
    h.memory.get('ckMeals-2026-10-09')!=='[{"kcal":640}]')throw Error('Undo removed old records');
 if(html.includes('localStorage.clear('))throw Error('Historical storage wipe is forbidden');
 console.log('PASS: live sets/reps adaptation, manual precedence, recovery and deload, immutable completed sessions, response log/undo');
}

/* No unrequested design change: ensure only expanded '调整参考' fields are added. */
{
 if(!html.includes('function trainingReferenceEditorHtml(')||!html.includes('function saveTrainingReference('))
  throw Error('Missing inline reference editor');
 if(!html.includes('volumeEdit-sets-')||!html.includes('volumeEdit-min-')||
    !html.includes('volumeEdit-max-')||!html.includes('volumeEdit-weight-'))
  throw Error('Reference editor must include sets/min-max-reps and optional weight');
 if(!html.includes('&&parseExerciseVolume(a)?trainingReferenceEditorHtml(key,name,a,i)'))
  throw Error('Existing training card entry not reused');
 if(!html.includes('.exerciseRow.isDone{opacity:.58}')||
    html.includes('finishedCompact')||html.includes('trainingFlowGuideHtml'))
  throw Error('V47 completed style must not be redesigned');
 console.log('PASS: inline optional group/rep/load editor, V47 completed-card appearance preserved.');
}

/* Editor persistence under old/new session state: user-entered references must not
   overwrite a completed workout, yet apply to the next same-day-type workout. */
{
 const helpers=sect('const VOLUME_HISTORY_KEY=','function weightTrendRule(').slice(0,-'function weightTrendRule('.length);
 const ui=sect('let openLoadEditorKey="";','function exerciseHtml(').slice(0,-'function exerciseHtml('.length);
 function env(completed=false,bodyweight=false){
  const id=bodyweight?'平板支撑':'杠铃卧推',row=bodyweight?'平板支撑｜2组 × 30–45秒｜自重':'杠铃卧推｜3组 × 6–8次｜推荐重量：45 kg';
  const map=new Map([['ckTrain-2026-10-09','1']]),notifications=[];
  const localStorage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))};
  const exerciseDone=completed?{[id]:true}:{},exerciseFeedback={};
  const inputs={
   'volumeEdit-sets-0':{value:bodyweight?'3':'4'},
   'volumeEdit-min-0':{value:bodyweight?'35':'8'},
   'volumeEdit-max-0':{value:bodyweight?'60':'12'},
   'volumeEdit-weight-0':{value:'52.5'}
  };
  const document={getElementById:k=>inputs[k],__inputs:inputs};
  const cp=()=>{const p=Array.from({length:7},()=>[]);p[4]=['C','full','60m',[row]];return p};
  const js=new Function('localStorage','localDate','exerciseDone','exerciseFeedback','trainingIndex','phaseWeek','recovery','coachLoads','coachWeight','currentPlans','sessionLoads','validCoachWeight','workingWeight','loadOverrides','loadKeyForExercise','roundTo','sessionLoadKey','renderTraining','document','alert','benchWarmupHint','stepGoalRange','exerciseName',
    helpers+ui+'return {saveTrainingReference,trainingReferenceEditorHtml,toggleLoadEditor,volumeTrainingHistory,getLoad:()=>({...loadOverrides}),getSession:()=>({...sessionLoads}),input:document.__inputs};');
  const instance=js(localStorage,()=> '2026-10-10',exerciseDone,exerciseFeedback,()=>4,()=>1,{state:'ok',painArea:''},
    {bench:{base:45,unit:'kg',round:2.5}},()=>45,cp,{bench:45},v=>v!==null&&v!==undefined&&Number(v)>0,()=>45,
    {},n=>n==='杠铃卧推'?'bench':null,(v,inc)=>Math.round(v/inc)*inc,'ckSessionLoads-2026-10-10',
    ()=>{},document,x=>notifications.push(x),()=>'warmup',()=> '6500–7500',v=>v.split('｜')[0]);
  return {instance,map,notifications,exerciseDone,row,id};
 }
 let a=env(false,false);
 a.instance.saveTrainingReference(0);
 let manual=JSON.parse(a.map.get('ckTrainingVolumeReferences')||'{}')['4|杠铃卧推'];
 if(!manual||manual.sets!==4||manual.min!==8||manual.max!==12||manual.unit!=='次'||
    a.instance.getLoad().bench!==52.5||a.instance.getSession().bench!==52.5)
  throw Error('Unfinished workout failed to save sets/reps and recommended weight together');
 if(a.map.get('ckTrain-2026-10-09')!=='1')throw Error('Saving reference erased old training');
 a=env(true,false);
 a.instance.saveTrainingReference(0);
 if(a.instance.getLoad().bench!==52.5||a.instance.getSession().bench!==45)
  throw Error('Completed workout actual session load must not be rewritten');
 a=env(false,true);
 a.instance.saveTrainingReference(0);
 manual=JSON.parse(a.map.get('ckTrainingVolumeReferences')||'{}')['4|平板支撑'];
 if(manual?.unit!=='秒'||manual?.sets!==3||manual?.min!==35||manual?.max!==60)
  throw Error('Bodyweight duration needs editable volume even without load');
 a.instance.input['volumeEdit-sets-0'].value='15';a.instance.saveTrainingReference(0);
 if(a.notifications.length!==1||JSON.parse(a.map.get('ckTrainingVolumeReferences'))['4|平板支撑'].sets!==3)
  throw Error('Invalid set reference was accepted');
 console.log('PASS: optional sets/reps and weight saves, bodyweight seconds, validations, current vs completed preservation.');
}

/* Same-day extra ride: actual entry only (no pre-plan, no departure time).
   Preserve historical planned records without counting them as performed. */
{
 const extraCode=sect('const EXTRA_ACTIVITY_KINDS=','function rideStorageKey(').slice(0,-'function rideStorageKey('.length);
 function mock(initialDay='2026-10-10',initialEntries=[]){
  let date=initialDay,trainDone=true,idx=4;
  const memory=new Map([
   ['ckTrain-2026-10-10','1'],['ckTrainingCursorIndex','4'],
   ['ckExerciseDone-2026-10-10','{"杠铃卧推":true}'],
   ['ckSteps-2026-10-10','7200'],['ckMeals-2026-10-10','[{"kcal":600}]'],
   ['ckRide-2026-10-10','{"minutes":60,"rpe":3}']
  ]);
  if(initialEntries.length)memory.set('ckExtraActivities-'+initialDay,JSON.stringify(initialEntries));
  const localStorage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),
   removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size}};
  const inputs={
   extraType:{value:'ride'},extraMinutes:{value:''},extraRpe:{value:''},
   extraActivityPanel:{innerHTML:''},extraActivityAdvice:{textContent:''},extraActivityNextHint:{textContent:''},
   extraActivityDetails:{open:false},'view-progress':{classList:{contains:()=>false}}
  };
  const document={getElementById:id=>inputs[id]||null};
  const shiftDate=(ds,d)=>{const z=new Date(ds+'T12:00:00');z.setDate(z.getDate()+d);return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0')};
  const safeJsonParse=(v,def)=>{try{return v?JSON.parse(v):def}catch(e){return def}};
  const alerts=[],recalc=[];
  const api=new Function('localStorage','localDate','shiftDate','safeJsonParse','recovery','sleepLoadGuard','weightTrendRule','planKind','trainingIndex','trainDone','document','alert','renderProgress','renderTraining','refreshNutritionGuidance',
     extraCode+'return {saveExtraActivity,editExtraActivity,removeExtraActivity,cancelExtraEdit,readExtraActivities,extraActivityAdvice,extraActivityPanelHtml,renderExtraActivity,recentExtraLoad,recentExtraStats,completedExtraActivity,extraActivityKey};')(
    localStorage,()=>date,shiftDate,safeJsonParse,{state:'ok',painArea:''},()=>({suppress:false}),()=>({suppressExtra:false}),
    i=>[0,2,4].includes(i)?'strength':[1,5].includes(i)?'cardio':'rest',()=>idx,trainDone,document,s=>alerts.push(s),
    ()=>recalc.push('progress'),()=>recalc.push('training'),()=>recalc.push('nutrition'));
  return {api,inputs,memory,alerts,recalc,changeDay:d=>{date=d},changeIndex:i=>{idx=i}};
 }
 let f=mock();
 if(!f.api.extraActivityAdvice('ride',35,3).includes('力量训练已经完成'))
   throw Error('Advice must recognize morning strength completion');
 const emptyHtml=f.api.extraActivityPanelHtml();
 if(!emptyHtml.includes('实际时长（分钟）')||!emptyHtml.includes('实际强度（RPE）')||
   !emptyHtml.includes('保存活动记录')||!emptyHtml.includes('选择实际强度')||
   emptyHtml.includes('出发时间')||emptyHtml.includes('加入临时计划')||
   emptyHtml.includes('更新计划')||emptyHtml.includes('markExtraActivityComplete(')||
   emptyHtml.includes('extraStartTime'))
   throw Error('Removed departure-time/pre-planning controls are still rendered');
 f.api.saveExtraActivity();
 if(f.alerts.length!==1||f.api.readExtraActivities().length)
   throw Error('Missing actual minutes were accepted');
 f.inputs.extraMinutes.value='35';f.api.saveExtraActivity();
 if(f.alerts.length!==2||f.api.readExtraActivities().length)
   throw Error('Missing actual RPE was accepted');
 f.inputs.extraRpe.value='3';f.api.saveExtraActivity();
 let rows=f.api.readExtraActivities();
 if(rows.length!==1||rows[0].status!=='completed'||rows[0].minutes!==35||rows[0].rpe!==3||
    Object.hasOwn(rows[0],'startTime'))
   throw Error('Direct actual-activity entry failed or stored removed departure time');
 if(f.recalc.join()!=='training,nutrition,progress')
   throw Error('Saving actual activity did not refresh linked training/nutrition/progress');
 if(f.memory.get('ckTrain-2026-10-10')!=='1'||f.memory.get('ckTrainingCursorIndex')!=='4'||
    f.memory.get('ckExerciseDone-2026-10-10')!=='{"杠铃卧推":true}'||
    f.memory.get('ckSteps-2026-10-10')!=='7200'||f.memory.get('ckMeals-2026-10-10')!=='[{"kcal":600}]'||
    f.memory.get('ckRide-2026-10-10')!=='{"minutes":60,"rpe":3}')
   throw Error('Recording completed extras changed main training/nutrition/steps');
 const id=rows[0].id;
 f.api.editExtraActivity(id);
 if(!f.inputs.extraActivityDetails.open)throw Error('Editing an actual ride did not open form');
 f.inputs.extraMinutes.value='48';f.inputs.extraRpe.value='4';f.api.saveExtraActivity();
 rows=f.api.readExtraActivities();
 if(rows.length!==1||rows[0].id!==id||rows[0].minutes!==48||rows[0].rpe!==4||
   f.api.recentExtraStats().count!==1||f.api.recentExtraStats().minutes!==48)
   throw Error('Editing an actual ride failed, duplicated or lost history');
 f.changeDay('2026-10-11');
 let load=f.api.recentExtraLoad();
 if(!load.substantial||load.heavy||load.minutes!==48)
   throw Error('Actual activity does not impact next-day load');
 f.changeDay('2026-10-10');f.api.removeExtraActivity(id);
 if(f.api.readExtraActivities().length!==1)throw Error('Deletion skipped confirmation');
 f.api.removeExtraActivity(id);
 if(f.api.readExtraActivities().length)throw Error('Confirmed removal failed');
 f.changeDay('2026-10-11');
 if(f.api.recentExtraLoad().substantial)throw Error('Deleted actual activity still affects load');
 f=mock();
 f.inputs.extraMinutes.value='82';f.inputs.extraRpe.value='7';f.api.saveExtraActivity();
 f.changeDay('2026-10-11');load=f.api.recentExtraLoad();
 if(!load.heavy||load.minutes!==82)throw Error('Heavy actual ride did not flag recovery');
 if(f.api.completedExtraActivity().length!==0||f.api.recentExtraStats().count!==1)
   throw Error('Next-day records and trailing 7-day activity summary mixed');
 f.changeDay('2026-10-10');f.inputs.extraMinutes.value='0';f.api.saveExtraActivity();
 if(f.alerts.length!==1)throw Error('Invalid duration not rejected');
 const prior={id:'legacy',type:'ride',minutes:65,rpe:4,startTime:'15:30',status:'planned',createdAt:'2026-10-09T15:30:00Z'};
 f=mock('2026-10-10',[prior]);
 if(f.api.completedExtraActivity().length||f.api.recentExtraStats().count||f.api.readExtraActivities().length!==1)
   throw Error('Prior uncompleted record lost or counted without user confirmation');
 const legacyPanel=f.api.extraActivityPanelHtml();
 if(!legacyPanel.includes('旧版未完成记录')||legacyPanel.includes('15:30')||legacyPanel.includes('出发时间')||
    legacyPanel.includes('加入临时计划'))
   throw Error('Legacy record should be recoverable without old planning controls');
 if(f.memory.get('ckExtraActivities-2026-10-10')!==JSON.stringify([prior]))
   throw Error('Past planned record silently deleted');
 f.api.editExtraActivity('legacy');
 f.inputs.extraMinutes.value='40';f.inputs.extraRpe.value='4';f.api.saveExtraActivity();
 if(f.api.completedExtraActivity().length!==1||f.api.readExtraActivities()[0].startTime!==undefined)
   throw Error('Legacy planned entry could not be converted to actual record');
 const planCode=func('currentPlans','function planAffectedByPain');
 const makePlan=new Function('currentPlansBase','trainingIndex','adaptiveRule','shiftDate','localDate','weightTrendRule','recoveryRule','recovery','trainDone','storedRide','recentExtraLoad','integratedTrainingDecision','applyCardioLoadPrescription',planCode+'return currentPlans;');
 const plans=()=>[['A','S','50',[]],['B','Zone 2 骑车','45',['热身｜5分钟','主体｜35–40分钟 Zone 2']],[],[],[],['F','Zone 2 骑车','55',['热身｜5分钟','主体｜45分钟 Zone 2']],[]];
 const d=(load,idx=1,done=false)=>makePlan(plans,()=>idx,()=>({}),()=> '2026-10-09',()=> '2026-10-10',()=>({extraMinutes:0,suppressExtra:false}),()=>({suppressExtra:false}),{state:'ok'},done,()=>null,()=>load,()=>({load:{highLoad:load.heavy,moderate:load.substantial}}),(...args)=>{if(![1,5].includes(args[1])||args[3])return;const item=args[0][args[1]];if(load.heavy){item[3][1]='主体｜15–25分钟轻松恢复';}else if(load.substantial){item[3][1]='主体｜20–30分钟轻松骑';}})()[idx][3][1];
 if(!d({heavy:true,substantial:true}).includes('15–25分钟')||
    !d({heavy:false,substantial:true}).includes('20–30分钟')||
    !d({heavy:false,substantial:false}).includes('35–40分钟')||
    !d({heavy:true,substantial:true},1,true).includes('35–40分钟'))
   throw Error('Recorded actual rides should affect only upcoming unfinished Zone 2');
 if(html.includes('localStorage.clear(')||html.includes('finishedCompact')||html.includes('trainingFlowGuideHtml'))
   throw Error('Historical data or V47 UI regression');
 console.log('PASS: completed-only extra activities; fields/time/plan removed; historical planned entry preserved; editing, undo, subsequent training linked.');
}

/* V51: integrated real, not merely recorded, training-load decisions. */
{
 const signalJs=sect('/* V51 recent-two-calendar-days training-load signal.','function rideStorageKey(').slice(0,-'function rideStorageKey('.length);
 const newCase=(entries={},main={},rideRecords={},state='ok')=>{
   const kv=new Map([['ckTrain-2026-10-08','1'],['ckSteps-2026-10-09','7100'],['ckMeals-2026-10-09','[{"kcal":620}]']]);
   for(const [date,idx] of Object.entries(main)){kv.set('ckTrain-'+date,'1');kv.set('ckTrainPlanIndex-'+date,String(idx))}
   const localStorage={getItem:k=>kv.has(k)?kv.get(k):null,setItem:(k,v)=>kv.set(k,String(v)),removeItem:k=>kv.delete(k)};
   const shift=(date,d)=>{const t=new Date(date+'T12:00:00');t.setDate(t.getDate()+d);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
   const api=new Function('localStorage','localDate','shiftDate','trainingIndexForDate','storedRide','completedExtraActivity','readExtraActivities','sleepLoadGuard','recovery',
      signalJs+'return {integratedTrainingLoad,integratedTrainingDecision,nextTrainingLoadAdvice,rideAffectsLowerBody};')(
      localStorage,()=> '2026-10-10',shift,date=>main[date]??0,
      date=>rideRecords[date]||null,date=>(entries[date]||[]).filter(v=>v.status==='completed'),
      date=>entries[date]||[],()=>({suppress:false}),{state});
   return {api,kv,entries,shift};
 };
 const plan={id:'a',type:'ride',minutes:90,rpe:7,status:'planned'};
 let x=newCase({'2026-10-09':[plan]});
 let result=x.api.integratedTrainingLoad();
 if(result.highLoad||result.moderate||result.completedExtras||x.api.integratedTrainingDecision().holdStrength)
    throw Error('Planned-only ride incorrectly changed the workout');
 const mild={...plan,status:'completed',minutes:45,rpe:3};
 x=newCase({'2026-10-09':[mild]});
 result=x.api.integratedTrainingLoad();
 if(!result.moderate||result.highLoad||result.totalRideMinutes!==45||
    !x.api.nextTrainingLoadAdvice(1,'2026-10-10').includes('20–30分钟')||
    x.api.integratedTrainingDecision().holdStrength)
    throw Error('Completed social ride should shorten Zone2, not penalize strength');
 x=newCase({'2026-10-09':[{...mild,minutes:90,rpe:6}]});
 result=x.api.integratedTrainingLoad();
 if(!result.highLoad||!x.api.integratedTrainingDecision().holdStrength||
    !x.api.nextTrainingLoadAdvice(1,'2026-10-10').includes('15–25分钟')||
    !x.api.nextTrainingLoadAdvice(2,'2026-10-10').includes('下肢相关动作建议少一组'))
    throw Error('Long hard ride did not change next cardio/strength plan');
 x=newCase({'2026-10-09':[{...mild,minutes:45,rpe:4}]},{'2026-10-09':0});
 if(!x.api.integratedTrainingLoad().highLoad||x.api.integratedTrainingLoad().strengthCount!==1)
    throw Error('Strength + completed social ride same day must count as combined fatigue');
 x=newCase({}, {'2026-10-09':1},{'2026-10-09':{minutes:55,rpe:3}});
 if(!x.api.integratedTrainingLoad().moderate||x.api.integratedTrainingLoad().totalRideMinutes!==55)
    throw Error('Prescribed actual Zone2 ride must also affect upcoming plan');
 x=newCase({'2026-10-09':[{...mild,minutes:55,rpe:4}], '2026-10-10':[{...mild,id:'b',minutes:50,rpe:3}]});
 if(!x.api.integratedTrainingLoad().highLoad||x.api.integratedTrainingLoad().rideDays!==2)
    throw Error('Two consecutive rides need cumulative-load guard');
 x.entries['2026-10-09']=[];
 x.entries['2026-10-10']=[];
 if(x.api.integratedTrainingLoad().highLoad||x.api.integratedTrainingLoad().moderate)
    throw Error('Deleting finished extras must immediately restore ordinary workload');
 if(x.kv.get('ckTrain-2026-10-08')!=='1'||x.kv.get('ckSteps-2026-10-09')!=='7100'||
    x.kv.get('ckMeals-2026-10-09')!=='[{"kcal":620}]')
    throw Error('Integrated load mutated main training, nutrition or step history');
 const volumeCode=sect('function adaptiveVolumeReference(row,dayIndex,isToday=true){','function applyExerciseVolumeToRow(').slice(0,-'function applyExerciseVolumeToRow('.length);
 const parse=row=>{const m=row.match(/(\d+)组 × (\d+)–(\d+)次/);return m?{sets:+m[1],min:+m[2],max:+m[3],unit:'次'}:null};
 const vol=(done,poor,week)=>new Function('parseExerciseVolume','exerciseVolumeId','volumeSnapshots','exerciseDone','readTrainingVolumeJson','VOLUME_REFERENCE_KEY','lastVolumeResponses','phaseWeek','recovery','integratedTrainingDecision','rideAffectsLowerBody','validExerciseVolume',
   volumeCode+'return adaptiveVolumeReference;')(
   parse,(day,name)=>day+'|'+name,done?{'2|杠铃罗马尼亚硬拉':{sets:3,min:8,max:10,unit:'次'}}:{},
   done?{'杠铃罗马尼亚硬拉':true}:{},()=>({}),'ckTrainingVolumeReferences',()=>[],()=>week,{state:poor?'poor':'ok'},
   ()=>({reduceLower:true}),n=>/硬拉|深蹲|腿弯举|分腿蹲/.test(n),v=>v&&v.sets>=1&&v.min>=1&&v.max>=v.min);
 const lower='杠铃罗马尼亚硬拉｜3组 × 8–10次',upper='杠铃卧推｜3组 × 6–8次';
 if(vol(false,false,1)(lower,2).sets!==2||vol(false,false,1)(upper,2).sets!==3||
    vol(true,false,1)(lower,2).sets!==3||vol(false,true,1)(lower,2).sets!==2||
    vol(false,false,4)(lower,2).sets!==2||vol(false,false,1)(lower,2,false).sets!==3)
    throw Error('Selective lower-body workload guard broke completed sets, other muscles, deload or future plans');
 if(!html.includes('function refreshLinkedTrainingGuidance(){')||
    !html.includes('refreshNutritionGuidance();\n renderProgress();')||
    !html.includes('weightInput.value="";render()}'))
    throw Error('Activity and weight recording must refresh interlinked training, nutrition and progress immediately');
 if(!html.includes('function saveExtraActivity()')||!html.includes('refreshLinkedTrainingGuidance();'))
    throw Error('Extra activity save/delete does not recompute related plans');
 if(html.includes('localStorage.clear(')||html.includes('finishedCompact'))
    throw Error('V47 UI/data compatibility violation');
 console.log('PASS: real planned-vs-done and prescribed-vs-extra load; near-term Zone2/strength adjustments; history, UI and reactive refresh');
}

/* V52: consistent complete RPE choices across planned Zone2 and spontaneous activity.
   Fixes missing descriptions at RPE 5/6 and oversimplified 1–4/7–10 labels.
   Numeric values and previously recorded activities remain unchanged. */
{
 const defs=sect('const RPE_LABELS=','function extraActivityPanelHtml(').slice(0,-'function extraActivityPanelHtml('.length);
 const {rpeOptionList,rpeEffortLabel}=new Function(defs+'return {rpeOptionList,rpeEffortLabel};')();
 const seen=[];
 for(let i=1;i<=10;i++){
  const label=rpeEffortLabel(i),choices=rpeOptionList(i);
  if(!label||label==='强度未知'||!choices.includes('<option value="'+i+'" selected>'+i+' · '+label+'</option>')||
     (choices.match(/<option value=/g)||[]).length!==10)
    throw Error('Incomplete RPE scale or missing selection at '+i);
  seen.push(label);
 }
 if(!seen[4].includes('中等')||!seen[5].includes('中等')||!seen[9].includes('极限')||
    new Set(seen).size<9||rpeEffortLabel(0)!=='强度未知'||rpeEffortLabel(11)!=='强度未知')
    throw Error('Middle and high RPE intensities are unclassified/ambiguous');
 const rideUI=func('cardioDayHtml','function saveTodayRide(');
 const card=new Function('storedRide','recovery','trainDone','rpeOptionList','rpeEffortLabel','completedCardioRecovery','cardioLoadPrescription',
   rideUI+'return cardioDayHtml;');
 const ridePlan=['热身｜5分钟','主体｜40分钟 Zone 2','放松｜5分钟'];
 const initial=card(()=>null,{state:'ok'},false,rpeOptionList,rpeEffortLabel,()=>false,()=>null)(ridePlan);
 const completed=card(()=>({minutes:45,rpe:6}),{state:'ok'},true,rpeOptionList,rpeEffortLabel,()=>false,()=>null)(ridePlan);
 if(!initial.includes('5 · 中等')||!initial.includes('6 · 中等偏高')||
    !initial.includes('value="3" selected')||!completed.includes('value="6" selected')||
    !completed.includes('RPE 6（中等偏高）'))
    throw Error('Scheduled Zone 2 select/status not using common intensity labels');
 const extraUI=func('extraActivityPanelHtml','function refreshExtraActivityAdvice(');
 const extra=new Function('readExtraActivities','extraEditingId','extraDeletingId','EXTRA_ACTIVITY_KINDS',
   'planKind','trainingIndex','extraActivityAdvice','rpeOptionList','rpeEffortLabel',
   extraUI+'return extraActivityPanelHtml;');
 const entries=[{id:'a',type:'ride',minutes:55,rpe:5,status:'completed'}];
 const kinds={ride:'骑车',walk:'步行',other:'其他活动'};
 const sample=extra(()=>entries,'a','',kinds,()=> 'strength',()=>4,()=> '适合低强度',rpeOptionList,rpeEffortLabel)();
 if(!sample.includes('value="5" selected')||!sample.includes('5 · 中等')||
    !sample.includes('6 · 中等偏高')||!sample.includes('RPE 5（中等）')||
    (sample.match(/<option value="/g)||[]).length<13)
    throw Error('Spontaneous activity selection/log not using common RPE 1–10 scale');
 if(!html.includes('function saveExtraActivity()')||!html.includes('function saveTodayRide()')||
    !html.includes('status:"completed",createdAt:')||!html.includes('JSON.stringify({minutes,rpe,planIndex:idx'))
    throw Error('Numeric persistence for actual workouts was unexpectedly changed');
 if(!html.includes('.exerciseRow.isDone{opacity:.58}')||
    html.includes('finishedCompact')||html.includes('localStorage.clear('))
    throw Error('Legacy completed-action UI or local history compatibility broken');
 console.log('PASS: full 1–10 RPE scale, missing 5/6 fixed, Zone2 and ad-hoc options/status unified, records numeric and V47 UI unchanged');
}
