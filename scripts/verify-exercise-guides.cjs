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
