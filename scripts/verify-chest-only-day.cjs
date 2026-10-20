const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const extract=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,'missing '+start);return html.slice(a,b)};
const block=extract('const planTemplates=','const coachLoads=');
const plans=new Function(block+'return {planTemplates,LEGACY_V47_PLAN_TEMPLATES:undefined};')().planTemplates;
const chest=plans[4],rows=chest[3],names=rows.map(s=>s.split('｜')[0]);
assert.equal(chest[1],'胸部专项训练');
assert.equal(chest[2],'45–60分钟');
assert.deepEqual(names,['热身','杠铃卧推','上斜哑铃卧推','器械推胸','平板哑铃飞鸟']);
assert(!names.some(name=>/下拉|划船|硬拉|深蹲|Pallof|死虫|平板支撑|面拉/.test(name)));
assert.equal(rows.filter(row=>row.match(/推荐重量/)).reduce((total,row)=>total+Number(row.match(/(\d+)组/)[1]),0),10);
assert(/胸部专项/.test(extract('function planPartialMakeup(', 'function shouldPassOptionalCardio(')));
const src=extract('function planPartialMakeup(', 'function shouldPassOptionalCardio(');
const pending=[
 {date:'2026-10-16',name:'中立握高位下拉',muscle:'back',row:'中立握高位下拉｜3组 × 8–12次',sets:3,gap:1},
 {date:'2026-10-16',name:'杠铃罗马尼亚硬拉',muscle:'legs',row:'杠铃罗马尼亚硬拉｜2组 × 8–10次',sets:2,gap:1},
 {date:'2026-10-16',name:'死虫',muscle:'core',row:'死虫｜2组 × 每侧10次',sets:2,gap:1},
 {date:'2026-10-16',name:'平板哑铃飞鸟',muscle:'chest',row:'平板哑铃飞鸟｜2组 × 10–15次',sets:2,gap:1}
];
const before=rows.join('\n');
let scheduled=0;
const fn=new Function('localDate','partialPendingCandidates','dailyTrainingDecision','actualRecentMuscleLoad','assessPartialMakeup','localStorage','safeJsonParse','partialMakeupIgnored','readPartialWorkout',
 src+'return planPartialMakeup;')(
 ()=> '2026-10-20',()=>pending,()=>{scheduled++;return{mode:'normal',hasUnknownSleep:false,missed:false,userChoice:null,started:false}},()=>[],()=>({accepted:pending,held:[]}),
 {getItem:()=>null,setItem:()=>{throw new Error('Chest day must not append persisted makeup')},removeItem:()=>{}},
 ()=>null,()=>({}),()=>null);
const input=Array.from({length:7},(_,i)=>['训练日','normal','50分钟',i===4?[...rows]:[]]);
const result=fn(input,4,'2026-10-20');
assert.equal(scheduled,0,'Chest specialist must not spend resources deciding irrelevant makeup');
assert.deepEqual(result.accepted,[]);
assert.equal(result.held.length,pending.length);
assert(input[4][3].join('\n')===before,'Unfinished unrelated actions may not be silently appended to chest day');
assert(result.held.every(x=>x.why.includes('胸部专项')));
assert(html.includes('const chestRows=new Set(["热身","杠铃卧推","上斜哑铃卧推","器械推胸","平板哑铃飞鸟"])'));
assert(html.includes('if(idx===4&&!(frozen&&frozen.index===idx))'),'Preserve active frozen session evidence');
assert(html.includes('plans[idx][3]=[...frozen.rows]'),'Frozen in-progress workouts must remain intact');
const legacy=extract('const LEGACY_V47_PLAN_TEMPLATES=', 'const planTemplates=');
assert(legacy.includes('"胸部训练"'),'Legacy historical plan reference must survive');
assert(!/localStorage\.clear\(/.test(html));
assert(!html.includes('ckTrainingPlanMigrationWipe'));
console.log('PASS V96: Day5 chest-only 10 working sets, no back/leg/core, no partial makeup injection, completed/in-progress workouts & historical records preserved');
