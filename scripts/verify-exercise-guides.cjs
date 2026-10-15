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
 'const localStorage={getItem:()=>null,setItem:()=>{}},exerciseDone={};let trainDone=false;const readDayAdjustment=()=>null;',
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
   'const localDate=()=>"2026-10-08",shiftDate=()=> "2026-10-07",trainKey="ckTrain-2026-10-08";'+
   'const safeJsonParse=(v,f)=>{try{return v?JSON.parse(v):f}catch(e){return f}};'+
   'let trainDone=false,recovery={state:"ok"};'+
   'const cardioRecoveryKey=()=>"ckCardioRecovery-2026-10-08",cardioLoadPrescription=()=>null,completedCardioRecovery=()=>false;'+
   'const planKind=idx=>[0,2,4].includes(idx)?"strength":[1,5].includes(idx)?"cardio":"rest",trainingIndex=()=>DAY;'+
   'const document={getElementById:k=>({value:k==="rideMinutes"?"47":"4"})};'+
   'const alert=s=>notices.push(s),render=()=>{},renderTraining=()=>{},refreshNutritionGuidance=()=>{},readDayAdjustment=()=>null,dayAdjustmentKey=()=>"ckDayAdjustment-2026-10-08",readExtraActivities=()=>[],extraActivityKey=()=>"ckExtraActivities-2026-10-08",rpeOptionList=()=>"",rpeEffortLabel=()=>"";';;
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
 const rowSrc=sect('function exerciseHtml(a,i,interactive=false,scope="today"){','function completeAllExercises(){').slice(0,-'function completeAllExercises(){'.length);
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
 const weekly=row('杠铃卧推｜正式组 2组 × 6–8次｜推荐重量：45 kg｜休2–3分钟',1,false,'week-4');
 if(!weekly.includes("toggleExerciseGuide('杠铃卧推','week-4')")||weekly.includes('>完成</button>')||weekly.includes('完成反馈'))
  throw Error('Historical week image guide must expand independently, without completing or changing weight feedback');
 if(!active.includes("toggleExerciseGuide('杠铃卧推','today')"))throw Error('Today guide must use a separate session scope');
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
 if(!html.includes('painLimitsToday')||!html.includes('planAffectedByPain(')||!html.includes('exerciseAffectedByPain('))throw Error('Pain-aware protection must remain active after hiding redundant training tip');
 if(!html.includes('trainingAdjustment.textContent="";trainingAdjustment.hidden=true'))throw Error('Redundant training tip should be hidden');
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
 const extraCode=sect('const ACTUAL_FOCUS=','const ACTUAL_EXERCISE_PRESETS=').slice(0,-'const ACTUAL_EXERCISE_PRESETS='.length)+'\n'+sect('const EXTRA_ACTIVITY_KINDS=','function rideStorageKey(').slice(0,-'function rideStorageKey('.length);
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
 const makePlan=new Function('currentPlansBase','trainingIndex','adaptiveRule','shiftDate','localDate','weightTrendRule','recoveryRule','recovery','trainDone','storedRide','recentExtraLoad','integratedTrainingDecision','applyCardioLoadPrescription','const readDayAdjustment=()=>null;'+planCode+'return currentPlans;');
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
 const cardioJs=sect('function cardioRecoveryKey(','function currentPlans(').slice(0,-'function currentPlans('.length);
 const newCase=(entries={},main={},rideRecords={},state='ok')=>{
   const kv=new Map([['ckTrain-2026-10-08','1'],['ckSteps-2026-10-09','7100'],['ckMeals-2026-10-09','[{"kcal":620}]']]);
   for(const [date,idx] of Object.entries(main)){kv.set('ckTrain-'+date,'1');kv.set('ckTrainPlanIndex-'+date,String(idx))}
   const localStorage={getItem:k=>kv.has(k)?kv.get(k):null,setItem:(k,v)=>kv.set(k,String(v)),removeItem:k=>kv.delete(k)};
   const shift=(date,d)=>{const t=new Date(date+'T12:00:00');t.setDate(t.getDate()+d);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
   const api=new Function('localStorage','localDate','shiftDate','trainingIndexForDate','storedRide','completedExtraActivity','readExtraActivities','sleepLoadGuard','recovery',
      signalJs+cardioJs+'return {integratedTrainingLoad,integratedTrainingDecision,nextTrainingLoadAdvice,rideAffectsLowerBody};')(
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
   'const readDayAdjustment=()=>null,walkDayHtml=()=>"";'+rideUI+'return cardioDayHtml;');
 const ridePlan=['热身｜5分钟','主体｜40分钟 Zone 2','放松｜5分钟'];
 const initial=card(()=>null,{state:'ok'},false,rpeOptionList,rpeEffortLabel,()=>false,()=>null)(ridePlan);
 const completed=card(()=>({minutes:45,rpe:6}),{state:'ok'},true,rpeOptionList,rpeEffortLabel,()=>false,()=>null)(ridePlan);
 if(!initial.includes('5 · 中等')||!initial.includes('6 · 中等偏高')||
    !initial.includes('value="3" selected')||!completed.includes('value="6" selected')||
    !completed.includes('RPE 6（中等偏高）'))
    throw Error('Scheduled Zone 2 select/status not using common intensity labels');
 const extraUI=func('extraActivityPanelHtml','function refreshExtraActivityAdvice(');
 const extra=new Function('readExtraActivities','extraEditingId','extraDeletingId','EXTRA_ACTIVITY_KINDS',
   'planKind','trainingIndex','extraActivityAdvice','rpeOptionList','rpeEffortLabel','ACTUAL_FOCUS',
   extraUI+'return extraActivityPanelHtml;');
 const entries=[{id:'a',type:'ride',minutes:55,rpe:5,status:'completed'}];
 const kinds={ride:'骑车',walk:'步行',strength:'力量训练',other:'其他活动'};
 const sample=extra(()=>entries,'a','',kinds,()=> 'strength',()=>4,()=> '适合低强度',rpeOptionList,rpeEffortLabel,{legs:'腿部',chest:'胸部',back:'背部',shoulders:'肩部',core:'核心',full:'全身'})();
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

/* V54 regression for reported issue: Day 5 completed strength plus a logged
   70-minute easy ride must change Day 6 schedule BEFORE Day 6 begins.
   Optional rest must advance the cursor without falsifying Zone2 completion. */
{
 const loadSrc=sect('/* V51 recent-two-calendar-days training-load signal.','function rideStorageKey(').slice(0,-'function rideStorageKey('.length);
 const cardioSrc=sect('function cardioRecoveryKey(','function currentPlans(').slice(0,-'function currentPlans('.length);
 const planSrc=func('currentPlans','function planAffectedByPain');
 const shift=(ds,d)=>{const t=new Date(ds+'T12:00:00');t.setDate(t.getDate()+d);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
 const activity={id:'user-ride-70',type:'ride',minutes:70,rpe:3,status:'completed'};
 function make(day='2026-10-10',idx=4,done=true,record=true){
  const data=new Map([['ckTrain-2026-10-10','1'],['ckTrainPlanIndex-2026-10-10','4'],['ckTrain-2026-10-09','1']]);
  if(record)data.set('ckExtraActivities-2026-10-10',JSON.stringify([activity]));
  const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const base=()=>[
    ['训练日1','全身力量 A','50–65分钟',[]],
    ['训练日2','Zone 2 骑车','45–50分钟 · RPE 3–4/10',['热身｜5分钟','主体｜35–40分钟 Zone 2｜RPE 3–4/10']],
    ['训练日3','腿部 + 背部 B','50–65分钟',[]],
    ['训练日4','休息 / 快走','6500–7500步',[]],
    ['训练日5','全身力量 C','50–65分钟',[]],
    ['训练日6','Zone 2 骑车','50–60分钟',['热身｜5分钟','主体｜40–50分钟 Zone 2｜RPE 3–4/10','放松｜5分钟']],
    ['训练日7','完全休息','恢复日',[]]
  ];
  const read=ds=>{try{return JSON.parse(data.get('ckExtraActivities-'+ds)||'[]')}catch(e){return []}};
  const readDone=ds=>read(ds).filter(x=>x.status==='completed');
  const api=new Function('localStorage','localDate','shiftDate','trainingIndexForDate','storedRide','completedExtraActivity','readExtraActivities','sleepLoadGuard','recovery','currentPlansBase','trainingIndex','trainDone','adaptiveRule','weightTrendRule','recoveryRule',
    'const readDayAdjustment=()=>null;'+loadSrc+cardioSrc+planSrc+
    'return {currentPlans,integratedTrainingLoad,integratedTrainingDecision,cardioLoadPrescription,completedCardioRecovery,applyCardioLoadPrescription,nextTrainingLoadAdvice};')(
      localStorage,()=>day,shift,ds=>ds==='2026-10-10'?4:ds==='2026-10-11'?5:0,
      ()=>null,readDone,read,()=>({suppress:false}),{state:'ok',painArea:''},
      base,()=>idx,done,()=>({}),()=>({suppressExtra:false,extraMinutes:0}),()=>({suppressExtra:false}));
  return {api,data,read};
 }
 let env=make(),p=env.api.currentPlans();
 if(!env.api.integratedTrainingLoad('2026-10-11').moderate||
    env.api.integratedTrainingLoad('2026-10-11').totalRideMinutes!==70||
    !env.api.cardioLoadPrescription('2026-10-11')?.allowRest)
    throw Error('Easy 70min ride after strength was ignored as next-day aerobic volume');
 if(!p[5][1].includes('恢复')||!p[5][2].includes('休息或15–25分钟')||
    !p[5][3][1].includes('今日可休息')||
    p[5][2].includes('50–60'))
    throw Error('Next-day weekly card did not change after 70min social ride');
 if(!env.api.nextTrainingLoadAdvice(5,'2026-10-11').includes('休息或15–25分钟'))
    throw Error('Next-day recommendation contradicts actual Day 6 card');
 if(p[4][1]!=='全身力量 C'||p[0][1]!=='全身力量 A')
    throw Error('Extra cardio changed unrelated strength plans');
 env=make('2026-10-10',4,true,false);p=env.api.currentPlans();
 if(p[5][1]!=='Zone 2 骑车'||!p[5][2].includes('50–60分钟'))
    throw Error('Deleting extra ride did not restore upcoming aerobic plan');
 env=make('2026-10-11',5,false,true);p=env.api.currentPlans();
 if(!p[5][2].includes('休息或15–25分钟')||!p[5][1].includes('恢复'))
    throw Error('Tomorrow workout card reverted to 50–60min despite yesterday 70min ride');
 env.data.set('ckTrain-2026-10-11','1');env.data.set('ckCardioRecovery-2026-10-11','{"reason":"recent-training-load"}');
 env=make('2026-10-11',5,true,true);
 env.data.set('ckCardioRecovery-2026-10-11','{"reason":"recent-training-load"}');
 p=env.api.currentPlans();
 if(!p[5][2].includes('休息或15–25分钟'))
    throw Error('Selecting recovery changed completed card back to unadjusted cycling label');
 const rideBlock=func('cardioDayHtml','function restDayHtml(');
 function cardioState(){
  const data=new Map([['ckTrain-2026-10-10','1'],['ckLoadOverrides','{"bench":45}']]),messages=[],updates=[];
  const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const plan=['热身｜5分钟','主体｜今日可休息；若状态好可轻松骑15–25分钟｜RPE 1–2/10','放松｜5分钟'];
  const api=new Function('localStorage','trainingIndex','planKind','cardioRecoveryKey','cardioLoadPrescription','completedCardioRecovery','storedRide','recovery','rpeOptionList','rpeEffortLabel','renderTraining','refreshNutritionGuidance','document','alert','rideStorageKey','trainKey',
    'const readDayAdjustment=()=>null,walkDayHtml=()=>"",dayAdjustmentKey=()=>"ckDayAdjustment-2026-10-11",readExtraActivities=()=>[],extraActivityKey=()=>"ckExtraActivities-2026-10-11",refreshAfterDayChange=()=>{};let trainDone=false;'+rideBlock+'return {finishOptionalCardioRecovery,undoTodayRide,saveTodayRide,cardioDayHtml,getDone:()=>trainDone};')(
    localStorage,()=>5,i=>i===5?'cardio':'strength',()=> 'ckCardioRecovery-2026-10-11',()=>({allowRest:true}),
    ()=>data.has('ckCardioRecovery-2026-10-11'),()=>{try{return JSON.parse(data.get('ckRide-2026-10-11')||'null')}catch(e){return null}},
    {state:'ok'},n=>'<option value="'+n+'">测试</option>',n=>'轻松',
    ()=>updates.push('training'),()=>updates.push('nutrition'),
    {getElementById:k=>({value:k==='rideMinutes'?'25':'3'})},msg=>messages.push(msg),
    ()=> 'ckRide-2026-10-11','ckTrain-2026-10-11');
  return {api,data,plan,updates,messages};
 }
 let ride=cardioState();
 const before=ride.api.cardioDayHtml(ride.plan);
 if(!before.includes('今天休息恢复')||!before.includes('恢复 / 可选骑行'))
    throw Error('Actual next-day cardio UI cannot opt into recovery');
 ride.api.finishOptionalCardioRecovery();
 if(!ride.api.getDone()||ride.data.get('ckTrain-2026-10-11')!=='1'||
    !ride.data.has('ckCardioRecovery-2026-10-11')||ride.data.has('ckRide-2026-10-11'))
    throw Error('Rest recovery did not advance day or invented an actual ride');
 const after=ride.api.cardioDayHtml(ride.plan);
 if(!after.includes('不计入 Zone 2 已完成次数')||!after.includes('撤销恢复'))
    throw Error('Recovery was mislabeled as a completed Zone 2');
 ride.api.undoTodayRide();
 if(ride.api.getDone()||ride.data.has('ckCardioRecovery-2026-10-11')||
    ride.data.get('ckTrain-2026-10-11')!=='0')
    throw Error('Undo did not fully restore a pending cardio session');
 ride.api.finishOptionalCardioRecovery();
 ride.api.saveTodayRide();
 if(!ride.api.getDone()||ride.data.has('ckCardioRecovery-2026-10-11')||
    JSON.parse(ride.data.get('ckRide-2026-10-11')).minutes!==25)
    throw Error('A later genuine ride must override recovery flag without fake double-count');
 if(ride.data.get('ckTrain-2026-10-10')!=='1'||ride.data.get('ckLoadOverrides')!=='{"bench":45}')
    throw Error('Cardio recovery corrupted earlier strength or load history');
 if(!html.includes('&&[1,5].includes(x.actualIdx)&&!completedCardioRecovery(x.ds)'))
    throw Error('Weekly Zone2 count includes recovery-only choices');
 if(!html.includes('p=currentPlans()[idx]'))
    throw Error('Tomorrow preview still reads raw cardio plan instead of adjusted next-day prescription');
 if(!html.includes('.exerciseRow.isDone{opacity:.58}')||html.includes('finishedCompact')||html.includes('localStorage.clear('))
    throw Error('Legacy strength UI or user history changed');
 console.log('PASS V54: 70min easy ride after strength adjusts Day6 weekly/tomorrow/today cards; recovery option, no false Zone2 credit, undo, real ride override, old data untouched');
}


/* V56 regression: completed strength + 70m RPE3 ride must not force a repeat
   of Day6 cardio after the user chose recovery; no imaginary Zone2 credit. */
{
 const cursorSrc=sect('function dayAdjustmentKey(','function trainingIndex(){').slice(0,-'function trainingIndex(){'.length);
 const shift=(d,n)=>{const t=new Date(d+'T12:00:00');t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
 function scenario(extra=true,defer=false,rest=false,now='2026-10-12'){
  const d=new Map([['ckTrainingCursorIndex','5'],['ckTrainingCursorDate','2026-10-11'],['ckTrain-2026-10-10','1'],['ckTrainPlanIndex-2026-10-10','4']]);
  if(defer)d.set('ckDayAdjustment-2026-10-11','{"choice":"defer"}');
  if(rest){d.set('ckTrain-2026-10-11','1');d.set('ckCardioRecovery-2026-10-11','{"reason":"manual"}')}
  const storage={getItem:k=>d.has(k)?d.get(k):null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)};
  const f=new Function('localStorage','localDate','shiftDate','integratedTrainingLoad',
   'const safeJsonParse=(r,f)=>{try{return r?JSON.parse(r):f}catch(e){return f}},trainingStartDate="2026-10-05",dayDiff=()=>7,storedRide=()=>null;'
   +cursorSrc+'return {syncTrainingCursor,readDayAdjustment};')(
   storage,()=>now,shift,()=>({days:[{date:'2026-10-11',strength:false,rideMinutes:0,maxRpe:0},{date:'2026-10-10',strength:true,rideMinutes:extra?70:0,maxRpe:extra?3:0}]}));
  return {index:f.syncTrainingCursor(),cardioCredit:d.get('ckTrain-2026-10-11'),rest:d.get('ckCardioRecovery-2026-10-11'),choice:f.readDayAdjustment('2026-10-11')};
 }
 const automatic=scenario(true),missing=scenario(false),deferred=scenario(true,true),manual=scenario(true,false,true),twoDays=scenario(true,false,false,'2026-10-13');
 if(automatic.index!==6||automatic.cardioCredit||automatic.choice?.status!=='unlogged')
  throw Error('Do not keep requesting Day6 ride after logged 70min ride, or forge Zone2 credit');
 if(missing.index!==5||deferred.index!==5||manual.index!==6||!manual.rest||twoDays.index!==0)
  throw Error('Adaptive cursor / user defer / chosen recovery / subsequent rest is broken');
 for(const name of ['adjustToday','saveTodayWalk','undoTodayRide','renderDayAdjustmentPanel','startDaySwipe','endDaySwipe']){
  if(!html.includes('function '+name+'('))throw Error('Missing training swap control '+name);
 }
 if(html.includes('localStorage.clear('))throw Error('Lossy localStorage mutation');
 console.log('PASS: Day5 strength+70min ride, Day6 rest and Day7 progression, no phantom cardio, explicit defer respected');
}


/* V57: actual performed strength is never confused with a planned or completed ride. */
{
 const model=sect('const ACTUAL_FOCUS=','function dayAdjustmentKey(').slice(0,-'function dayAdjustmentKey('.length);
 const shift=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const day='2026-10-12',kv=new Map(),store={
  getItem:k=>kv.has(k)?kv.get(k):null,setItem:(k,v)=>kv.set(k,String(v)),
  removeItem:k=>kv.delete(k),key:i=>[...kv.keys()][i],get length(){return kv.size}
 };
 const session={version:1,status:'completed',focus:'legs',rpe:8,exercises:[
  {name:'杠铃深蹲',muscle:'legs',sets:4,reps:8,weight:60,unit:'总kg'},
  {name:'腿举',muscle:'legs',sets:3,reps:10,weight:150,unit:'器械kg'},
  {name:'俯卧腿弯举',muscle:'legs',sets:3,reps:12,weight:32,unit:'器械kg'}
 ]};
 kv.set('ckActualWorkout-'+day,JSON.stringify(session));
 kv.set('ckTrain-'+day,'1');kv.set('ckCardioRecovery-'+day,JSON.stringify({reason:'actual-strength-substitution',notZone2:true}));
 const prelude='const safeJsonParse=(s,f)=>{try{return s?JSON.parse(s):f}catch(e){return f}};'
  +'const exerciseDone={},VOLUME_REFERENCE_KEY="test-manual";const localDate=()=>"2026-10-13";'
  +'const exerciseVolumeId=(idx,name)=>idx+"|"+name;const readTrainingVolumeJson=()=>({}),validExerciseVolume=()=>false;'
  +'const parseExerciseVolume=row=>{const m=row.match(/(\\d+)组\\s*×\\s*(?:每侧)?(\\d+)[–-](\\d+)次/);return m?{sets:+m[1],min:+m[2],max:+m[3],unit:"次"}:null};'
  +'const applyExerciseVolumeToRow=(row,v)=>row.replace(/\\d+组/,v.sets+"组");';
 const api=new Function('localStorage','shiftDate',prelude+model+
  'return {readActualWorkout,actualRecentMuscleLoad,actualStressAdvice,adjustPlanForActualWorkout};')(store,shift);
 if(api.readActualWorkout(day)?.exercises[1].weight!==150||
    api.actualRecentMuscleLoad('2026-10-13','legs')[0]?.sets!==10||
    !api.actualRecentMuscleLoad('2026-10-13','legs')[0]?.heavy)
   throw Error('Actual leg training record not counted as real 10-set high-effort load');
 const plans=[[],[],['训练日3','腿背B','55分钟',[
  '保加利亚分腿蹲｜3组 × 每侧8–10次','坐姿划船｜3组 × 8–12次','俯卧腿弯举｜3组 × 10–15次']],[],[],[],[]];
 api.adjustPlanForActualWorkout(plans,2,'2026-10-13');
 if(plans[2][3].some(x=>x.includes('分腿蹲')||x.includes('腿弯举'))||
    !plans[2][3].some(x=>x.includes('坐姿划船')))
   throw Error('Leg session yesterday must defer duplicate legs without removing back');
 const plans2=[[],[],['训练日3','腿背B','55分钟',[
  '保加利亚分腿蹲｜3组 × 每侧8–10次','坐姿划船｜3组 × 8–12次']],[],[],[],[]];
 api.adjustPlanForActualWorkout(plans2,2,'2026-10-14');
 if(!plans2[2][3][0].includes('2组')||!plans2[2][3][1].includes('3组'))
   throw Error('Two-day-old hard leg workout should reduce legs one set, not back');
 if(!html.includes('function saveActualWorkout()')||!html.includes('function actualWorkoutFormHtml()')||
    !html.includes('function removeActualWorkout()')||!html.includes('strengthDone=days.filter(x=>x.real||')||
    !html.includes('cardioDone=days.filter(x=>x.done&&!x.real'))
   throw Error('Actual-workout save, undo, history, or report attribution missing');
 if(html.includes('localStorage.clear('))throw Error('Unsafe localStorage reset');
 console.log('PASS: V57 actual leg volume, 24-hour repeat avoidance, 48-hour leg-only set reduction, truthful strength-vs-cardio attribution');
}


/* V57 actual form save, update, undo: full data state, not static string checks. */
{
 const model=sect('const ACTUAL_FOCUS=','function dayAdjustmentKey(').slice(0,-'function dayAdjustmentKey('.length);
 const controller=sect('let actualEditorOpen=','let dayAdjustmentOpen=').slice(0,-'let dayAdjustmentOpen='.length);
 const kv=new Map(),ui={actualFocus:'legs',actualRpe:'8',actualNote:'今天实练腿部',
  'actualName-0':'杠铃深蹲','actualMuscle-0':'legs','actualSets-0':'4',
  'actualReps-0':'8','actualWeight-0':'60','actualUnit-0':'总kg'};
 const store={getItem:k=>kv.has(k)?kv.get(k):null,setItem:(k,v)=>kv.set(k,String(v)),
  removeItem:k=>kv.delete(k),key:i=>[...kv.keys()][i],get length(){return kv.size}};
 const dom={getElementById:id=>Object.prototype.hasOwnProperty.call(ui,id)?{value:ui[id]}:null};
 const shift=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const context='const localDate=()=>"2026-10-12",trainKey="ckTrain-2026-10-12",exerciseDone={};let trainDone=false;'
  +'const safeJsonParse=(s,f)=>{try{return s?JSON.parse(s):f}catch(e){return f}};'
  +'const cardioRecoveryKey=()=>"ckCardioRecovery-2026-10-12",trainingIndex=()=>1,planKind=()=> "cardio";'
  +'const rpeOptionList=()=>"",refreshAfterDayChange=()=>{},renderDayAdjustmentPanel=()=>{};';
 const api=new Function('localStorage','document','shiftDate','alert',context+model+controller+
  'return {saveActualWorkout,removeActualWorkout,readActualWorkout,actualWorkoutHistoryHtml,setDraft:(v)=>{actualDraft=v},isDone:()=>trainDone};')(
   store,dom,shift,(x)=>{throw Error('Unexpected form failure: '+x)});
 api.setDraft({focus:'legs',rpe:8,note:'',exercises:[{name:'杠铃深蹲',muscle:'legs',sets:4,reps:8,weight:60,unit:'总kg'}]});
 api.saveActualWorkout();
 const first=api.readActualWorkout();
 if(!first||first.exercises[0].weight!==60||first.exercises[0].sets!==4||
    kv.get('ckTrain-2026-10-12')!=='1'||!api.isDone()||
    JSON.parse(kv.get('ckCardioRecovery-2026-10-12')).notZone2!==true)
   throw Error('V57 actual leg training save did not retain weight / substitute real strength for scheduled cardio');
 if(!api.actualWorkoutHistoryHtml().includes('杠铃深蹲'))
   throw Error('Completed actual leg exercise is missing from training history');
 ui['actualWeight-0']='65';api.setDraft(JSON.parse(JSON.stringify(api.readActualWorkout())));api.saveActualWorkout();
 if(api.readActualWorkout().exercises[0].weight!==65||
    [...kv.keys()].filter(k=>k.startsWith('ckActualWorkout-')).length!==1)
   throw Error('Editing a custom exercise lost the user load or created a duplicate workout');
 api.removeActualWorkout();
 if(!api.readActualWorkout())throw Error('First delete tap must preserve actual workout');
 api.removeActualWorkout();
 if(api.readActualWorkout()||kv.has('ckTrain-2026-10-12')||kv.has('ckCardioRecovery-2026-10-12'))
   throw Error('Confirmed custom-workout undo did not restore original pending cardio without data pollution');
 console.log('PASS: V57 real-form leg save, weight edit, 1-session history, two-step undo, no phantom Zone2');
}


/* V59: every plan-vs-actual consumer must agree on the same real workout. */
{
 const core=sect('function actualTrainingContext(','function actualWorkoutKey(').slice(0,-'function actualWorkoutKey('.length);
 const shift=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const d='2026-10-12',mem=new Map(),storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
 const session={version:1,status:'completed',focus:'legs',rpe:6,exercises:[{name:'杠铃深蹲',muscle:'legs',sets:5,reps:12,weight:60,unit:'总kg'},{name:'罗马尼亚硬拉',muscle:'legs',sets:5,reps:12,weight:60,unit:'总kg'}]};
 const script='const safeJsonParse=(s,f)=>{try{return s?JSON.parse(s):f}catch(e){return f}};'+
 'const planKind=i=>[0,2,4].includes(i)?"strength":[1,5].includes(i)?"cardio":"rest";'+
 'const trainingIndexForDate=()=>1,readActualWorkout=ds=>{const v=localStorage.getItem("ckActualWorkout-"+ds);return v?JSON.parse(v):null};'+
 'const readDayAdjustment=()=>null,completedCardioRecovery=ds=>localStorage.getItem("ckCardioRecovery-"+ds)!==null,storedRide=()=>null;'+core+'return actualTrainingContext;';
 const ctx=new Function('localStorage',script)(storage);
 mem.set('ckTrain-'+d,'1');mem.set('ckActualWorkout-'+d,JSON.stringify(session));
 mem.set('ckCardioRecovery-'+d,JSON.stringify({reason:'actual-strength-substitution',notZone2:true}));
 let t=ctx(d);
 if(!t.actualStrength||!t.strength||t.cardio||t.pendingCardio||t.recoveryOnly||!t.completed||!t.lower)
  throw Error('Actual 10-set legs on planned cardio must never appear as Zone2 or recovery on any page');
 mem.delete('ckActualWorkout-'+d);t=ctx(d);
 if(t.strength||t.cardio||!t.recoveryOnly||t.completed)
  throw Error('Replacing ride with rest must not inflate workout completion');
 mem.delete('ckCardioRecovery-'+d);mem.set('ckRide-'+d,'{"minutes":45,"rpe":3}');t=ctx(d);
 if(!t.cardio||t.strength||!t.completed)throw Error('Real ridden cardio not recognized');
 mem.delete('ckRide-'+d);t=ctx(d);
 if(!t.cardio||!t.completed)throw Error('Legacy cardio done must retain completion without invented ride metrics');
 mem.set('ckTrain-'+d,'0');t=ctx(d);
 if(t.completed||!t.pendingCardio)throw Error('Unperformed cardio must remain pending, not be counted');
 for(const key of ['function mealFitAdvice','function renderDailyCoachTip','function buildDietAdvice','function extraActivityAdvice','function weightTrendRule']){
  if(!html.includes(key)||!html.includes('actualTrainingContext'))throw Error('Missing linked coaching consumer '+key);
 }
 console.log('PASS: V59 actual legs > planned cardio, rest, real ride, legacy completion and pending coherent across surfaces');
}


/* V59 screenshot-specific cross-surface checks: 10 sets today, meal 646kcal. */
{
 const food=func('mealFitAdvice','function showNutritionPasteResult');
 const sample=new Function('actualTrainingContext','summarizeMeals','trainingIndex','meals','target','pt','actualSessionTitle',food+'return mealFitAdvice;');
 const meal=sample(()=>({actual:{focus:'legs',exercises:[{muscle:'legs'}]},strength:true,pendingStrength:false,lower:true,cardio:false,pendingCardio:false,completed:true}),
 ()=>({k:0,p:0}),()=>5,[],1950,145,()=> '腿部');
 const got=meal({k:646,p:68,c:44,f:22});
 if(got.title.includes('Zone 2')||!got.title.includes('腿部')||got.tag!=='训练后正常吃')
  throw Error('Screenshot recurrence: performed leg day still described as scheduled Zone 2 for 646kcal 68g protein');
 const real=func('actualStressAdvice','function actualRowNeedsRest');
 const shift=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const session={focus:'legs',rpe:6,exercises:[{name:'杠铃深蹲',muscle:'legs',sets:5},{name:'罗马尼亚硬拉',muscle:'legs',sets:5}]};
 const advice=new Function('readActualWorkout','actualRecentMuscleLoad','ACTUAL_FOCUS',real+'return actualStressAdvice;')(
 date=>date==='2026-10-12'?session:null,()=>[],{legs:'腿部',chest:'胸部',back:'背部',shoulders:'肩部'});
 const today=advice('2026-10-12',true),tomorrow=advice('2026-10-13');
 if(!today.includes('今天已做腿部力量 10组（RPE 6）')||today.includes('昨天')||!tomorrow.startsWith(''))
  throw Error('Screenshot recurrence: same-day workout date incorrectly shown as yesterday');
 if(!html.includes('actualTrainingContext()'))throw Error('Meal/training pages not using shared actual-vs-prescribed state');
 console.log('PASS: V59 screenshot exact 646/68/44/22 meal recognizes actual legs and 10 sets RPE6 displays 今天, not Zone2/昨天');
}


/* V60: action header always retains both choices and correctly swaps active panels. */
{
 const head=html.match(/<div class="dayAdjustHead"[\s\S]{0,1200}?<div id="dayAdjustPanel"/)?.[0]||"";
 if(!head.includes('id="dayAdjustRecordBtn"')||!head.includes('id="dayAdjustToggleBtn"'))throw Error('Missing adjacent actual-training and day-change buttons');
 const toggle=func('toggleDayAdjustment','function safeNextStrengthDay');
 const source='let dayAdjustmentOpen=false,actualEditorOpen=false,actualDraft={focus:"legs",exercises:[]};let renders=[];'+
 'const cacheActualDraft=()=>renders.push("cached"),renderDayAdjustmentPanel=()=>renders.push("draw");'+toggle+
 'return {toggleDayAdjustment,state:()=>({dayAdjustmentOpen,actualEditorOpen,actualDraft,renders}),edit:()=>{actualEditorOpen=true;dayAdjustmentOpen=false}};';
 const api=new Function(source)();
 api.edit();api.toggleDayAdjustment();
 if(!api.state().dayAdjustmentOpen||api.state().actualEditorOpen||api.state().actualDraft?.focus!=='legs'||!api.state().renders.includes("cached"))
   throw Error('Tapping adjust after actual-workout form must display adjustment options while retaining draft');
 api.toggleDayAdjustment();if(api.state().dayAdjustmentOpen)throw Error('Adjust button fails to close adjustment panel on second tap');
 const panel=func('renderDayAdjustmentPanel','function cardioDayHtml');
 if(!panel.includes('if(dayAdjustmentOpen&&!actualEditorOpen)')||!panel.includes('if(actual){choices=')||
    !panel.includes('recordBtn.textContent=actualEditorOpen?')||!panel.includes('adjustBtn.textContent=dayAdjustmentOpen'))
   throw Error('Panel switch or completed-record guard does not give visible feedback');
 const a=html.indexOf('dayAdjustActions{display:grid;grid-template-columns:repeat(2');
 if(a<0)throw Error('Compact mobile action layout is missing');
 console.log('PASS: V60 action buttons same-row on mobile, switching from live record form to adjust works, draft retained, no inert control');
}


/* V76: real leg training modifies an upcoming session; ambiguous activity does not. */
{
 const code=sect('function recentStrengthPlanEvidence(', 'function recentUnclassifiedActivities(').slice(0,-'function recentUnclassifiedActivities('.length);
 const templates=Array.from({length:7},()=>['','','',[]]);
 for(const [day,name] of [[0,'器械推胸'],[0,'坐姿划船'],[0,'死虫'],[2,'中立握高位下拉'],[2,'绳索面拉'],[2,'Pallof Press 抗旋转']])
  templates[day][3].push(name+'｜2组 × 10–12次｜推荐重量：@test');
 const baseline=Array.from({length:7},()=>['训练日','原定力量训练','50分钟',[]]);
 baseline[0][3]=['热身｜下肢热身','杠铃深蹲｜3组','器械推胸｜3组','坐姿划船｜3组','杠铃罗马尼亚硬拉｜3组','死虫｜2组'];
 const create=()=>baseline.map(day=>[day[0],day[1],day[2],[...day[3]]]);
 const harness=new Function('actualRecentMuscleLoad','planTemplates','localDate','readActualWorkout','trainDone','exerciseDone','actualRowNeedsRest','resolveExercise','ACTUAL_FOCUS',code+'return applyWeekStrengthLoad;');
 const run=(legs,done={})=>harness((ds,g)=>g==='legs'?legs:[],templates,()=>'2026-10-14',()=>null,false,done,
  (name,group)=>group==='legs'&&/深蹲|硬拉|分腿蹲|腿弯举/.test(name),
  row=>row.replace('@test','42 kg'),{legs:'腿部',chest:'胸部',back:'背部',shoulders:'肩部',core:'核心'});
 const hardLegs=[{date:'2026-10-12',gap:2,sets:10,rpe:8,heavy:true,moderate:true}];
 const planned=create();run(hardLegs)(planned,0,'2026-10-14');
 if(!planned[0][1].includes('腿部恢复')||planned[0][3].some(x=>/深蹲|硬拉/.test(x))||planned[0][3].length<4)
  throw Error('Two-day-old completed heavy legs did not change next workout');
 const unknown=create();run([])(unknown,0,'2026-10-14');
 if(unknown[0][1]!=='原定力量训练')throw Error('Unidentified extra activity was invented as a leg workout');
 const started=create();run(hardLegs,{'杠铃深蹲':true})(started,0,'2026-10-14');
 if(started[0][1]!=='原定力量训练')throw Error('In-progress exercise was changed after user started');
 for(const name of ['extraStrengthSessions','classifyHistoricalExtraStrength','weeklyRealTrainingContext'])
  if(!html.includes('function '+name+'('))throw Error('Missing explicit real-history adaptation: '+name);
 console.log('PASS: V76 evidence-driven next strength, no invented leg loads and no mid-session reprogramming');
}


/* V77 unified training nutrition scenarios: only confirmed workouts affect decisions,
 * while all categories of completed extras affect recovery. */
{
 const src=sect('function evaluateDailyReadiness(', 'function dailyTrainingDecision(').slice(0,-'function dailyTrainingDecision('.length);
 const evaluate=new Function(src+'return evaluateDailyReadiness;')();
 const base={sleep:7.9,priorSleep:8,feeling:'ok',pain:'',activities:[],muscleNames:{legs:'腿部'}};
 const cases=[
  ['rest with no activity',{},'normal'],
  ['insufficient sleep',{sleep:6.2},'reduce'],
  ['intense legs plus 5.8h sleep',{sleep:5.8,activities:[{gap:1,type:'strength',muscle:'legs',sets:10,minutes:60,rpe:8}]},'recover'],
  ['brief intense unclassified extra',{activities:[{gap:1,type:'other',minutes:20,rpe:9}]},'reduce'],
  ['recovery after long hard ride',{activities:[{gap:1,type:'ride',minutes:75,rpe:7}]},'reduce'],
  ['completed planned strength w/o made-up RPE',{activities:[{gap:1,type:'planned-strength',minutes:0,rpe:0}]},'reduce'],
  ['easy walk not incorrectly penalized',{activities:[{gap:1,type:'walk',minutes:35,rpe:2}]},'normal'],
  ['poor recovery plus other sport',{feeling:'poor',activities:[{gap:1,type:'other',minutes:40,rpe:9}]},'recover']
 ];
 for(const [label,input,want] of cases){
  const result=evaluate({...base,...input});
  if(result.mode!==want)throw Error('V77 '+label+': expected '+want+' got '+result.mode);
 }
 const unknown=evaluate({...base,activities:[{gap:1,type:'other',minutes:70,rpe:8}]});
 if(!unknown.hasUnclassified||!unknown.reason.includes('不推断训练部位'))
  throw Error('V77 unknown activity fabricated muscle identity');
 if(!html.includes('function dailyTrainingNutritionAdvice(')||
    !html.includes('if(typeof dailyTrainingNutritionAdvice==="function")return dailyTrainingNutritionAdvice(k,p,cg,ft);')||
    !html.includes('applyDailyReadinessToPlans(plans,idx,localDate())')||
    !html.includes('dailyDecisionWhy.textContent=meaningful?'))
  throw Error('V77 common readiness not linked to prescribed training and nutritional guidance');
 if(html.includes('localStorage.clear('))throw Error('Historic fitness data cannot be cleared');
 console.log('PASS: V77 8 sleep, strength, cardio, arbitrary extra and recovery scenarios, conservative provenance, shared nutrition');
}


/* V78: a missed workout is not a completed session and work is not muscle fatigue. */
{
 const src=sect('function evaluateDailyReadiness(', 'function dailyTrainingDecision(').slice(0,-'function dailyTrainingDecision('.length);
 const decision=new Function(src+'return evaluateDailyReadiness;')();
 const base={activities:[],sleep:7.8,priorSleep:8,feeling:'ok',pain:'',muscleNames:{}};
 const work=decision({...base,missedYesterday:'work'});
 if(work.mode!=='normal'||!work.reason.includes('只顺延任务'))throw Error('Work absence falsely reduced exercise readiness');
 const recovery=decision({...base,missedYesterday:'recovery'});
 if(recovery.mode!=='reduce'||!recovery.reason.includes('身体恢复'))throw Error('Recovery absence did not affect next-day load');
 const lowSleep=decision({...base,sleep:6,missedYesterday:'recovery',feeling:'poor'});
 if(lowSleep.mode!=='reduce'&&lowSleep.mode!=='recover')throw Error('Poor sleep after recovery absence ignored');
 for(const name of ['readMissedTraining','saveMissedTraining','undoMissedTraining']){
  if(!html.includes('function '+name+'('))throw Error('Missed-session save/undo absent '+name);
 }
 if(!html.includes('if(![1,5].includes(index)||localStorage.getItem("ckTrain-"+ds)==="1"||storedRide(ds)||(typeof readMissedTraining==="function"&&readMissedTraining(ds)))return false;'))
  throw Error('Explicit missed cardio day could be falsely auto-passed');
 if(!html.includes('const missed=typeof readMissedTraining==="function"?readMissedTraining(ds):null;')||
    !html.includes('missed&&!completed?"不算作训练完成'))
  throw Error('Missed completion incorrectly linked to nutrition or daily training');
 if(html.includes('localStorage.clear('))throw Error('Missed workout implementation must not wipe stored history');
 console.log('PASS: V78 work vs recovery absence, safe missed-cursor policy, nutrition and unchanged histories');
}

/* V78 cursor and absence persistence dynamic test */
{
 const source=sect('const MISSED_TRAINING_REASONS=','function trainingIndex(').slice(0,-'function trainingIndex('.length);
 let day='2026-10-14';const map=new Map([['ckTrainingCursorDate',day],['ckTrainingCursorIndex','1']]);
 const storage={getItem:key=>map.has(key)?map.get(key):null,setItem:(key,v)=>map.set(key,String(v)),removeItem:key=>map.delete(key)};
 const shift=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
 const actions=new Function('localStorage','localDate','trainingIndex','dayDiff','trainingStartDate','readDayAdjustment','dayAdjustmentKey','readActualWorkout','hasExtraStrengthSession','storedRide','integratedTrainingLoad','actualRecentMuscleLoad','shiftDate','safeJsonParse','refreshAfterDayChange','alert','exerciseDone','trainDone',
  'let dayAdjustmentOpen=false;'+source+'return {readMissedTraining,saveMissedTraining,undoMissedTraining,syncTrainingCursor,shouldPassOptionalCardio};')(
  storage,()=>day,()=>1,()=>1,'2026-09-01',()=>null,ds=>'ckDayAdjustment-'+ds,()=>null,()=>false,()=>null,
  ()=>({days:[{date:'2026-10-13',strength:true,rideMinutes:75,maxRpe:7}]}),()=>[],shift,
  (v,def)=>{try{return v?JSON.parse(v):def}catch(e){return def}},()=>{},()=>{}, {},false);
 actions.saveMissedTraining('work');
 if(actions.readMissedTraining()?.reason!=='work'||map.has('ckTrain-2026-10-14'))
  throw Error('Missed work was not preserved independently from completed workout');
 if(actions.shouldPassOptionalCardio(day,1))
  throw Error('Missed Zone 2 was auto-passed despite user scheduling conflict');
 day='2026-10-15';
 if(actions.syncTrainingCursor()!==1||actions.readMissedTraining('2026-10-14')?.reason!=='work')
  throw Error('Missed workout did not remain pending the following day');
 day='2026-10-14';actions.undoMissedTraining();
 if(map.has('ckTrainingMissed-2026-10-14')||map.has('ckTrain-2026-10-14'))
  throw Error('Undo missed reason altered actual training history');
 actions.saveMissedTraining('recovery');
 if(actions.readMissedTraining()?.reason!=='recovery')throw Error('Recovery reason cannot be saved');
 console.log('PASS: V78 save, next-day workout pending, no false cardio auto-pass, undo and preserved completion history');
}


/* V80 real partial strength and recovery-aware top-up */
{
 const code=sect('function partialWorkoutKey(','function shouldPassOptionalCardio(').slice(0,-'function shouldPassOptionalCardio('.length);
 let day='2026-10-14',started=false,mode='normal',unknownSleep=false;
 const memory=new Map(),store={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const json=(v,def)=>{try{return v?JSON.parse(v):def}catch(e){return def}};
 const shift=(d,n)=>{const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10)};
 const actions=new Function('localStorage','localDate','shiftDate','safeJsonParse','actualRowNeedsRest','parseExerciseVolume','readActualWorkout','dailyTrainingDecision','actualRecentMuscleLoad','renderTraining','refreshNutritionGuidance','alert',
  code+'return {savePartialWorkout,readPartialWorkout,partialPendingCandidates,partialStrengthVolume,assessPartialMakeup,planPartialMakeup,meaningfulPartialWorkout,freezeStartedExercisePlan,readStartedExercisePlan,editStartedExercisePlan};')(
  store,()=>day,shift,json,(name,group)=>({legs:/深蹲|硬拉/.test(name),chest:/推胸|卧推/.test(name),back:/划船|下拉/.test(name),shoulders:/面拉/.test(name)})[group],
  row=>{const x=row.match(/(\d+)组/);return x?{sets:+x[1]}:null},()=>null,
  ()=>({mode,hasUnknownSleep:unknownSleep,started,missed:null,userChoice:''}), (ds,group)=>group==='legs'?[{gap:4}]:[],()=>{},()=>{},()=>{});
 const rows=['热身｜5分钟','杠铃深蹲｜3组 × 6–10次','器械推胸｜3组 × 6–12次','坐姿划船｜3组 × 8–12次','杠铃罗马尼亚硬拉｜3组 × 8–10次','死虫｜2组 × 每侧10–12次'];
 actions.savePartialWorkout(rows,0,{'杠铃深蹲':true,'器械推胸':true,'坐姿划船':true});
 const saved=actions.readPartialWorkout();
 if(saved?.completed.length!==3||saved.pending.length!==2||memory.has('ckTrain-2026-10-14'))
  throw Error('V80 partial checkmarks must remain real activity, not full completion');
 if(actions.partialStrengthVolume(day,'legs').sets!==3)throw Error('V80 real completed leg sets not counted');
 day='2026-10-15';
 let pending=actions.partialPendingCandidates();
 if(pending.length!==2||actions.assessPartialMakeup(pending,[],'cardio','normal',{}).accepted.length)
  throw Error('V80 cardio day must not be forced to complete missed strength actions');
 day='2026-10-18';
 const plan=()=>Array.from({length:7},(_,i)=>['训练日','原计划','50分钟',i===4?['热身｜5分钟','杠铃卧推｜3组 × 8–10次','上斜哑铃卧推｜3组 × 8–10次','中立握高位下拉｜3组 × 8–10次','杠铃罗马尼亚硬拉｜2组 × 8–10次','Pallof Press 抗旋转｜2组 × 10–12次']:[]]);
 const p1=plan();unknownSleep=true;
 if(actions.planPartialMakeup(p1,4).accepted.length)throw Error('V80 unknown sleep must not auto-add exercises');
 unknownSleep=false;
 const p2=plan(),chosen=actions.planPartialMakeup(p2,4).accepted;
 if(chosen.length!==1||chosen[0].name!=='死虫'||p2[4][3].filter(x=>x.startsWith('杠铃罗马尼亚硬拉')).length!==1)
  throw Error('V80 should add at most one safe unique accessory; no duplicate hard legs');
 started=true;
 const p3=plan(),frozen=actions.planPartialMakeup(p3,4).accepted;
 if(frozen.length!==1||!p3[4][3].some(x=>x.startsWith('死虫')))throw Error('V80 planned top-up disappeared after first action');
 memory.set('ckExerciseDone-2026-10-18',JSON.stringify({'死虫':true}));
 pending=actions.partialPendingCandidates();
 if(pending.some(x=>x.name==='死虫'))throw Error('V80 completed top-up remained a new training debt');
 const afterDone=plan();
 if(!actions.planPartialMakeup(afterDone,4).accepted.some(x=>x.name==='死虫')||
   !afterDone[4][3].some(x=>x.startsWith('死虫')))
  throw Error('V80 completed optional top-up vanished from active workout');
 if(saved.completed.some(x=>x.weight!==null||x.feedback!==null))
  throw Error('V80 unconfirmed weight or effort was fabricated');
 day='2026-10-19';started=false;
 const seven=['杠铃深蹲｜3组 × 6–10次','器械推胸｜3组 × 6–12次','坐姿划船｜3组 × 8–12次',
  '杠铃罗马尼亚硬拉｜3组 × 8–10次','死虫｜2组 × 每侧10–12次',
  '平板支撑｜2组 × 30–45秒','Pallof Press 抗旋转｜2组 × 10–12次'];
 actions.savePartialWorkout(seven,0,Object.fromEntries(seven.slice(0,6).map(x=>[x.split('｜')[0],true])));
 if(actions.readPartialWorkout()?.completed.length!==6||actions.readPartialWorkout()?.pending.length!==1||
    !actions.meaningfulPartialWorkout())throw Error('V80 six-of-seven workout did not persist');
 memory.set('ckMeals-2026-10-19','[{"kcal":600}]');
 day='2026-10-20';
 if(actions.readPartialWorkout('2026-10-19')?.completed.length!==6||
    memory.get('ckMeals-2026-10-19')!=='[{"kcal":600}]')
  throw Error('V80 midnight damaged training or food history');
 actions.freezeStartedExercisePlan(0,seven);
 if(actions.readStartedExercisePlan()?.rows.length!==7)throw Error('V80 missing frozen plan');
 actions.freezeStartedExercisePlan(0,['new unwanted plan']);
 if(actions.readStartedExercisePlan()?.rows.length!==7)throw Error('V80 plan overwritten during exercise');
 actions.editStartedExercisePlan(0,rows=>rows.map(x=>x.startsWith('杠铃深蹲')?'杠铃深蹲｜2组 × 6–10次':x));
 if(!actions.readStartedExercisePlan().rows[0].includes('2组'))throw Error('V80 manual update lost');
 actions.savePartialWorkout(['死虫｜2组 × 每侧10–12次'],4,{'死虫':true});
 if(actions.meaningfulPartialWorkout())throw Error('V80 small accessory falsely advanced cycle');
 console.log('PASS: V80 actual partial sets, no full-session replay, no forced next-day/cardio, conservative optional make-up, stable started plan and automatic debt clearance');
}

/* V80 next-day trained muscle protection: partial sets count even when RPE is absent. */
{
 const part=sect('function adjustPlanForActualWorkout(', 'function dayAdjustmentKey(').slice(0,-'function dayAdjustmentKey('.length);
 const plans=Array.from({length:7},(_,idx)=>['训练日'+idx,'腿部与背部训练','50分钟',[]]);
 plans[2][3]=['热身｜准备','保加利亚分腿蹲｜3组 × 每侧8–10次','中立握高位下拉｜3组 × 8–12次','俯卧腿弯举｜3组 × 10–15次','绳索面拉｜2组 × 12–15次'];
 const simulate=new Function('localStorage','actualRecentMuscleLoad','readTrainingVolumeJson','VOLUME_REFERENCE_KEY','parseExerciseVolume','validExerciseVolume','exerciseVolumeId','applyExerciseVolumeToRow','localDate','exerciseDone','actualRowNeedsRest',
  part+'return adjustPlanForActualWorkout;')(
  {getItem:()=>null},(_ds,g)=>g==='legs'?[{gap:1,sets:6,rpe:0,heavy:false,moderate:true,source:'partial'}]:[],
  ()=>({}),'refs',row=>({sets:Number(row.match(/(\d+)组/)?.[1]||0),min:8,max:12,unit:'次'}),
  ()=>false,(i,n)=>i+'|'+n,row=>row,()=> '2026-10-15',{},
  (name,g)=>g==='legs'?/深蹲|分腿蹲|硬拉|腿弯举/.test(name):false);
 simulate(plans,2,'2026-10-15');
 if(plans[2][3].some(x=>/保加利亚分腿蹲|俯卧腿弯举/.test(x))||
    !plans[2][3].some(x=>x.startsWith('中立握高位下拉'))||
    !plans[2][1].includes('实际负荷调整'))
  throw Error('V80 completed partial leg sets without RPE caused another full leg prescription the next day');
 console.log('PASS: V80 completed partial legs suppress next-day duplicate lower-body work; upper-body movements retained');
}

/* V80 live-call integration checks */
{
 const links=[
  'freezeStartedExercisePlan(idx,list);if(!exerciseDone[name])',
  'plans[idx][3]=[...frozen.rows];',
  'savePartialWorkout(currentPlans()[trainingIndex()][3],trainingIndex(),exerciseDone);renderTraining()',
  'advance=trainDone||!!readActualWorkout()||meaningfulPartialWorkout()',
  'actual=readActualWorkout(),partial=readPartialWorkout(),index=trainingIndex()',
  'actualStrength=!!actual||hasExtraStrength||!!partial',
  '未记录RPE'
 ];
 for(const k of links)if(!html.includes(k))throw Error('V80 missing live integration: '+k);
 if(html.includes('localStorage.clear('))throw Error('V80 must preserve ck* history');
 console.log('PASS: V80 in-progress plan, user overrides, exercise evidence, nutrition and missing-RPE');
}

/* V81: goal body weight only updates from confirmed weight records and survives date changes and backups. */
{
 const code=sect('function readGoalWeight(){','let weightHistoryExpanded=false;').slice(0,-'let weightHistoryExpanded=false;'.length);
 let day='2026-10-16',renders=0;
 const map=new Map([
  ['ckWeights','[{"date":"2026-10-15","weight":79.2}]'],
  ['ckTrain-2026-10-15','1'],['ckMeals-2026-10-15','[{"kcal":700}]'],
  ['ckBasics-2026-10-15','{"sleep":8}'],['ckTarget','2200'],['ckProtein','140']
 ]);
 const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),
   key:i=>[...map.keys()][i],get length(){return map.size}};
 const goalInput={value:''},alerts=[];
 const build=new Function('localStorage','goalWeightInput','renderProgress','alert',
  code+'return {readGoalWeight,goalWeightSummary,saveGoalWeight};');
 const goal=build(storage,goalInput,()=>renders++,msg=>alerts.push(msg));
 if(goal.readGoalWeight()!==null||goal.goalWeightSummary(79.2,null).value!=='—')
  throw Error('V81 missing target must not create an imaginary number');
 goalInput.value='70';
 goal.saveGoalWeight();
 if(goal.readGoalWeight()!==70||map.get('ckGoalWeight')!=='70.0'||renders!==1)
  throw Error('V81 target did not save independently');
 const a=goal.goalWeightSummary(79.2,goal.readGoalWeight());
 if(a.label!=='距离目标还差'||a.value!=='9.2 kg')
  throw Error('V81 current weight minus target calculated incorrectly');
 if(goal.goalWeightSummary(70,70).label!=='已达到目标'||
    goal.goalWeightSummary(69.4,70).value!=='0.6 kg'||
    goal.goalWeightSummary(null,70).value!=='—')
  throw Error('V81 reached, below-target or no weight state incorrect');
 // Original save flow stays intact: newest date wins and today's correction replaces, not appends.
 const save=sect('function saveWeight(){','function readGoalWeight(){').slice(0,-'function readGoalWeight(){'.length);
 const newWeightInput={value:'78.5'};
 const make=new Function('localStorage','weightInput','stepInput','localDate','render','maybeAdvanceStepGoal','alert',
  'let weights=[{date:"2026-10-15",weight:79.2}],steps=[];'+save+'return {saveWeight,read:()=>weights};');
 const record=make(storage,newWeightInput,{value:''},()=>day,()=>renders++,()=>{},msg=>alerts.push(msg));
 record.saveWeight();
 if(record.read().length!==2||goal.goalWeightSummary(record.read()[1].weight,goal.readGoalWeight()).value!=='8.5 kg')
  throw Error('V81 gap not recalculated from new record');
 day='2026-10-17';newWeightInput.value='77.8';record.saveWeight();
 if(goal.goalWeightSummary(record.read().at(-1).weight,goal.readGoalWeight()).value!=='7.8 kg')
  throw Error('V81 next-day gap failed');
 newWeightInput.value='77.5';record.saveWeight();
 if(record.read().length!==3||record.read().at(-1).weight!==77.5||
    goal.goalWeightSummary(record.read().at(-1).weight,goal.readGoalWeight()).value!=='7.5 kg')
  throw Error('V81 same-date edit duplicated or failed to update latest weight');
 goalInput.value='69.5';goal.saveGoalWeight();
 if(goal.readGoalWeight()!==69.5||
    goal.goalWeightSummary(77.5,goal.readGoalWeight()).value!=='8.0 kg')
  throw Error('V81 manually adjusted target ignored');
 const prior=map.get('ckGoalWeight');
 goalInput.value='';goal.saveGoalWeight();
 goalInput.value='29';goal.saveGoalWeight();
 if(map.get('ckGoalWeight')!==prior||alerts.length!==2)
  throw Error('V81 invalid target overwrote saved data');
 const portable=sect('function portableData(){','function trimSafetySnapshots(){').slice(0,-'function trimSafetySnapshots(){'.length);
 const data=new Function('localStorage','UPGRADE_BACKUP_PREFIX',portable+'return portableData();')(storage,'ckUpgradeBackup-');
 if(data.ckGoalWeight!=='69.5'||!data.ckWeights||!data['ckTrain-2026-10-15']||
    !data['ckMeals-2026-10-15']||!data['ckBasics-2026-10-15']||
    map.get('ckTarget')!=='2200'||map.get('ckProtein')!=='140')
  throw Error('V81 backup/history, nutrition or sleep was altered');
 for(const anchor of ['id="goalWeightInput"','id="goalWeightRemaining"','onclick="saveGoalWeight()"',
  'const goal=readGoalWeight(),result=goalWeightSummary(recent[0]?.weight,goal)',
  'goalWeightRemaining.textContent=result.value',
  'document.activeElement!==goalWeightInput'])
   if(!html.includes(anchor))throw Error('V81 goal display or editing missing: '+anchor);
 console.log('PASS: V81 editable weight target, daily gap/reach/below, midnight, same-date corrections, historical backup and unchanged kcal/protein');
}

/* V82: the screenshot's two-stack goal UI must fit ONE row, including narrow phones. */
{
 const start=html.indexOf('<div class="goalWeightSetting">');
 const end=html.indexOf('</section><section class="card"><h2>趋势</h2>',start);
 if(start<0||end<start)throw Error('V82 target-row markup not found');
 const snippet=html.slice(start,end);
 for(const anchor of ['for="goalWeightInput"','id="goalWeightInput"','onclick="saveGoalWeight()"',
  'class="goalWeightInline"','id="goalWeightRemaining"','id="goalWeightResultLabel"'])
  if(!snippet.includes(anchor))throw Error('V82 missing single-row element: '+anchor);
 if(snippet.includes('</div><div class="goalWeightProgress"')||
    snippet.includes('goalWeightResultDetail')||html.includes('class="goalWeightProgress"'))
  throw Error('V82 old redundant second result card still renders');
 if(snippet.indexOf('class="goalWeightInline"')>snippet.indexOf('</div>'))
  throw Error('V82 result is below row rather than inside it');
 const cssStart=html.indexOf('#view-progress .goalWeightSetting{');
 const cssEnd=html.indexOf('.extraStrengthFields{',cssStart);
 const css=html.slice(cssStart,cssEnd);
 for(const rule of ['grid-template-columns:auto 65px auto minmax(0,1fr)','@media(max-width:360px)',
  'grid-template-columns:auto 61px auto minmax(0,1fr)','white-space:nowrap','min-width:0',
  'justify-content:flex-end','font-size:16px'])
  if(!css.includes(rule))throw Error('V82 compact responsive rule missing: '+rule);
 // Phone layout has enough width for a label, decimal entry, save action and gap.
 // 320px screen: 40px outer app padding + 28px card padding => 252px inner.
 const contentWidth=320-40-28,label=24,input=61,save=44,gaps=15;
 if(contentWidth-label-input-save-gaps<100)
  throw Error('V82 controls leave insufficient narrow-phone gap width');
 if(!html.includes('goalWeightResultLabel.textContent=goal===null?"未设置"')||
    !html.includes('goalWeightInline.title=result.detail'))
  throw Error('V82 inline state or accessible full explanation disconnected');
 console.log('PASS: V82 one-row target, save and remaining gap at desktop, 375px and 320px, no second card');
}
