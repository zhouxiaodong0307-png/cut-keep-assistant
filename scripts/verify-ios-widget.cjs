const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'widgets/cut-keep-scriptable.js'),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function between(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 if(i<0||j<0)throw Error('Missing tested source '+a);
 return html.slice(i,j);
}
const snapshotCode=between('function createIosWidgetSnapshot(){','function iosWidgetStatus(');
const runSnapshot=new Function('localDate','trainingIndex','currentPlans','planKind','readActualWorkout','trainDone','exerciseDone','exerciseName','weights','readGoalWeight','meals','target','pt','summarizeMeals',
 snapshotCode+'return createIosWidgetSnapshot();');
const ds=()=> '2026-10-16';
const plan=[[0,'力量训练A','50分钟',['热身｜5分钟','器械推胸｜3组 × 12次','坐姿划船｜3组 × 12次']]];
const make=(extras={})=>runSnapshot(ds,()=>0,()=>plan,()=> 'strength',()=>extras.actual||null,false,
 extras.done||{'热身':true,'器械推胸':true},
 x=>x.split('｜')[0],
 extras.weights||[{date:'2026-10-15',weight:77.2},{date:'2026-10-12',weight:77.8}],
 ()=>extras.goal===undefined?70:extras.goal,
 extras.meals||[{kcal:650,protein:45}],
 2100,150,a=>({count:a.length,k:a.reduce((n,v)=>n+v.kcal,0),p:a.reduce((n,v)=>n+v.protein,0),social:0}));
const snap=make();
assert.equal(snap.app,'cut-keep-widget');
assert.equal(snap.training.done,2);
assert.equal(snap.training.total,3);
assert.equal(snap.weight.latest,77.2);
assert.equal(snap.weight.remaining,7.2);
assert.equal(snap.nutrition.kcal,650);
assert.equal(snap.nutrition.protein,45);
assert.ok(new Date(snap.syncedAt).valueOf()>0);
assert.equal(make({weights:[]}).weight.latest,null);
assert.equal(make({weights:[]}).weight.remaining,null);
assert.equal(make({goal:null}).weight.remaining,null);
assert.equal(make({meals:[]}).nutrition.kcal,null);
assert.equal(make({meals:[]}).nutrition.protein,null);
assert.equal(make({weights:[{date:'2026-10-17',weight:72}]}).weight.latest,null);
assert.equal(make({done:{}}).training.done,0);
const actualSession=make({actual:{exercises:[{name:'杠铃卧推',sets:3}]}});
assert.equal(actualSession.training.actual,true);
assert.equal(actualSession.training.done,null);
assert.equal(actualSession.training.total,null);
assert.equal(actualSession.training.title,'已记录自主力量训练');
assert(!html.includes('localStorage.clear('));
assert(html.includes('onclick="syncIosWidget()"'));
assert(html.includes('onclick="copyIosWidgetScript()"'));
assert(html.includes('scriptable:///run?scriptName='));
assert(!script.includes('new Request('));
assert(!script.includes('fetch('));
const operations=[];
function stack(){
 return {layoutHorizontally(){},layoutVertically(){},centerAlignContent(){},spacing:0,
  addText(t){operations.push(String(t));return {textColor:null,font:null,lineLimit:0,minimumScaleFactor:0};},
  addStack:stack,addSpacer(){}};
}
class ListWidget{
 constructor(){this.url=null;}
 setPadding(){}
 addStack(){return stack();}
 addSpacer(){}
 addText(t){operations.push(String(t));return {textColor:null,font:null,lineLimit:0,minimumScaleFactor:0};}
 async presentMedium(){}
 async presentSmall(){}
}
class Alert{
 constructor(){this.title='';this.message='';}
 addAction(){}
 async presentAlert(){operations.push(this.title);}
}
class Color{constructor(hex){this.hex=hex;}}
let clipboard=null, saved=null, currentWidget=null;
const mock={
 FileManager:{local:()=>({documentsDirectory:()=>'/widget-data',joinPath:(a,b)=>a+'/'+b,
 fileExists:()=>saved!==null,readString:()=>saved,writeString:(_p,v)=>{saved=v;}})},
 Pasteboard:{pasteString:()=>clipboard,copyString:v=>{clipboard=v;}},
 ListWidget,Alert,Color,Font:{systemFont:()=>({}),boldSystemFont:()=>({})},
 Script:{setWidget:w=>{currentWidget=w;},complete:()=>{}},
 config:{runsInWidget:false,widgetFamily:'medium'},
 args:{queryParameters:{mode:'sync'}},
};
const launcher=new AsyncFunction(...Object.keys(mock),script);
(async()=>{
 clipboard=JSON.stringify(snap);
 await launcher(...Object.values(mock));
 assert.equal(JSON.parse(saved).weight.remaining,7.2);
 assert.equal(clipboard,'');
 assert(currentWidget&&currentWidget.url==='https://cut-keep-assistant.onrender.com/');
 assert(operations.includes('同步成功'));
 operations.length=0;
 mock.config.runsInWidget=true;mock.config.widgetFamily='small';mock.args.queryParameters={};
 await launcher(...Object.values(mock));
 assert(operations.includes('7.2 kg'));
 assert(operations.some(x=>x.includes('训练 2/3')));
 operations.length=0;
 clipboard=JSON.stringify({...snap,syncedAt:'2000-01-01T00:00:00.000Z',weight:{latest:65,goal:70,remaining:-5}});
 mock.config.runsInWidget=false;mock.args.queryParameters={mode:'sync'};
 await launcher(...Object.values(mock));
 assert.equal(JSON.parse(saved).weight.latest,77.2,'stale clipboard must not overwrite newer data');
 assert(operations.includes('同步未完成'));
 clipboard='malicious non-JSON';
 await launcher(...Object.values(mock));
 assert.equal(JSON.parse(saved).weight.latest,77.2);
 operations.length=0;
 saved=null;mock.config.runsInWidget=true;mock.config.widgetFamily='medium';mock.args.queryParameters={};
 await launcher(...Object.values(mock));
 assert(operations.includes('请从网页同步'));
 // V86: URLScheme must target the actual Scriptable script by name, not just open the app.
 assert(html.includes('id="iosWidgetScriptName"'));
 const linkCode=between('function iosWidgetRunUrl(name){','function saveWeight(){');
 let input={value:'脂保肌小组件'},written=null,redirect="",status="",writes=0;
 const store=new Map([['ckWeights','historical unchanged']]);
 const locals={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
 const browser={clipboard:{writeText:async v=>{written=v;writes++;}}};
 const page={getElementById:k=>k==='iosWidgetScriptName'?input:null};
 const win={location:{set href(v){redirect=v;},get href(){return redirect;}}};
 const api=new Function('document','navigator','createIosWidgetSnapshot','iosWidgetStatus','window','localStorage',
  linkCode+'return {iosWidgetRunUrl,syncIosWidget}')(page,browser,()=>snap,v=>status=v,win,locals);
 assert.equal(api.iosWidgetRunUrl(' '),null);
 assert.equal(api.iosWidgetRunUrl('减脂保肌小组件'),
  'scriptable:///run?scriptName='+encodeURIComponent('减脂保肌小组件')+'&mode=sync');
 await api.syncIosWidget();
 assert.equal(JSON.parse(written).app,'cut-keep-widget');
 assert.equal(redirect,'scriptable:///run?scriptName='+encodeURIComponent('脂保肌小组件')+'&mode=sync');
 assert.equal(new URL(redirect).searchParams.get('scriptName'),'脂保肌小组件');
 assert.equal(new URL(redirect).searchParams.get('mode'),'sync');
 assert.equal(store.get('ckWidgetScriptName'),'脂保肌小组件');
 assert.equal(store.get('ckWeights'),'historical unchanged');
 assert(status.includes('等待 Scriptable 导入'));
 input.value='减脂保肌小组件';
 await api.syncIosWidget();
 assert.equal(new URL(redirect).searchParams.get('scriptName'),'减脂保肌小组件');
 assert.equal(writes,2);
 input.value='';
 redirect='';
 await api.syncIosWidget();
 assert.equal(redirect,'');
 assert.equal(writes,2,'Invalid Scriptable name should not touch clipboard');
 assert(status.includes('填写 Scriptable 中的完整脚本名称'));
 // Installed Scriptable V85 script receives mode=sync from queryParameters.
 assert(script.includes('args.queryParameters.mode === "sync"'));
 console.log('PASS: V86 configurable exact installed name, valid scriptable:///run?scriptName= URL, no false sync success, no personal-data query and no records changed');
 console.log('PASS: V85 Scriptable widget: actual records, missing data, weight goal, protein, clipboard import, secure stale/invalid guard, small/medium/no-sync rendering, no network and no history mutation');
})().catch(e=>{console.error(e);process.exitCode=1;});
