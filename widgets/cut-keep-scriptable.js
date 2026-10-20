// 健身助手 · V95 云端优先读取
// 需要 Scriptable（iPhone / iPad）。仅在设备本地保存和显示网页中主动同步的数据。
// 保留手机中已有的 Scriptable 脚本名称；网页“同步小组件”的名称与其一致即可。
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), "cut_keep_widget_v1.json");
const cloudPath = fm.joinPath(fm.documentsDirectory(), "cut_keep_widget_cloud_v1.json");
const supabaseURL = "https://ampixosqbgqbsckmrhog.supabase.co";
const publishableKey = "sb_publishable_IlVC6d5G7aZUaXxNr9wqNQ_RKmlkA5U";
const appURL = "https://cut-keep-assistant.onrender.com/";
// 普通网页链接无法保证在 iOS 启动已安装的主屏幕网页应用。
// 可选：在 Scriptable 小组件的 Parameter 输入「快捷指令:健身助手」。
// 用户需先自行创建同名快捷指令；若系统不能选中主屏网页应用，则保留默认网页模式。
function widgetLaunchUrl(parameter){
 const raw=String(parameter||"").trim();
 const m=raw.match(/^(?:快捷指令|shortcut)\s*[:：]\s*(.{1,70})$/i);
 return m?("shortcuts://run-shortcut?name="+encodeURIComponent(m[1].trim())):appURL;
}
const isSync = args.queryParameters && args.queryParameters.mode === "sync";
const isPair = args.queryParameters && args.queryParameters.mode === "pair";
const textColor = new Color("#1c1c1e");
const mutedColor = new Color("#83838b");
const pale = new Color("#f6f6f9");
const white = new Color("#ffffff");
function dateLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function isNum(x) { return typeof x === "number" && Number.isFinite(x); }
function validSnapshot(v) {
  return v && v.app === "cut-keep-widget" && v.version === 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date||"") &&
    typeof v.syncedAt === "string" && !Number.isNaN(Date.parse(v.syncedAt)) &&
    v.weight && v.training && v.nutrition &&
    (v.weight.latest === null || isNum(v.weight.latest)) &&
    (v.weight.goal === null || isNum(v.weight.goal)) &&
    (v.weight.remaining === null || isNum(v.weight.remaining)) &&
    ["strength","cardio","rest"].includes(v.training.kind) &&
    typeof v.training.title === "string" && v.training.title.length < 90 &&
    (v.training.done === null || Number.isInteger(v.training.done)) &&
    (v.training.total === null || Number.isInteger(v.training.total)) &&
    (v.nutrition.kcal === null || isNum(v.nutrition.kcal)) &&
    (v.nutrition.kcalGoal === null || isNum(v.nutrition.kcalGoal)) &&
    (v.nutrition.protein === null || isNum(v.nutrition.protein)) &&
    (v.nutrition.proteinGoal === null || isNum(v.nutrition.proteinGoal));
}
async function notice(title, message) {
  if (config.runsInWidget) return;
  const a = new Alert();
  a.title=title; a.message=message; a.addAction("确定");
  await a.presentAlert();
}
let data = null;
if (fm.fileExists(path)) {
  try { const x=JSON.parse(fm.readString(path)); if(validSnapshot(x))data=x; } catch (_) {}
}
if (isSync) {
  try {
    const raw = Pasteboard.pasteString();
    if (!raw || raw.length > 12000) throw Error("剪贴板没有有效的同步数据");
    const incoming = JSON.parse(raw);
    if (!validSnapshot(incoming)) throw Error("数据来源不正确或格式无效");
    // 防止旧页面/旧剪贴板将较新的同步结果覆盖。
    if (data && Date.parse(incoming.syncedAt) < Date.parse(data.syncedAt))
      throw Error("这是更旧的数据，未覆盖桌面小组件");
    fm.writeString(path, JSON.stringify(incoming));
    data = incoming;
    Pasteboard.copyString(""); // 同步完成后不将健康摘要长时间留在剪贴板
    await notice("同步成功", "已保存当前真实记录。iOS 会在系统允许的时间刷新小组件；如需立即查看，可在 Scriptable 中预览。");
  } catch (e) {
    await notice("同步未完成", String(e.message || e) + "\n请回到健身助手检查当前记录，然后重试。");
  }
}
/* V94: token is a read-only, revocable random capability (NOT the user's
   Supabase password or full Auth JWT), stored only in Scriptable local files.
   Scriptable accesses a tiny, server-validated summary, never the ck* archive. */
let cloudToken=null,cloudOk=false,cloudError="";
try{
 if(fm.fileExists(cloudPath)){
  const saved=JSON.parse(fm.readString(cloudPath));
  if(saved&&/^[0-9a-f]{64}$/.test(saved.token))cloudToken=saved.token;
 }
}catch(_){}
if(isPair){
 try{
  const token=String(Pasteboard.pasteString()||"").trim();
  if(!/^[0-9a-f]{64}$/.test(token))throw Error("剪贴板没有有效配对码。请从健身助手点击「连接自动更新」。");
  // Test the credential BEFORE replacing any existing working device pairing.
  async function verifyToken(t){
   const req=new Request(supabaseURL+"/rest/v1/rpc/fitness_widget_read");
   req.method="POST";
   req.headers={"apikey":publishableKey,"Content-Type":"application/json"};
   req.body=JSON.stringify({p_token:t});
   req.timeoutInterval=15;
   const body=await req.loadJSON();
   if(req.response && req.response.statusCode>=400)throw Error("云端拒绝此配对码");
   const summary=Array.isArray(body)?body[0]?.widget_summary:null;
   if(!validSnapshot(summary))throw Error("云端尚未同步小组件摘要，请先保持健身助手联网并检查云同步状态");
   return summary;
  }
  const fresh=await verifyToken(token);
  fm.writeString(cloudPath,JSON.stringify({token,pairedAt:new Date().toISOString()}));
  cloudToken=token;data=fresh;cloudOk=true;fm.writeString(path,JSON.stringify(fresh));
  Pasteboard.copyString("");
  await notice("自动更新已开启","小组件已连接健身助手云端。之后 iOS 会在系统允许的时间自动读取最新数据，无需每天手动同步。");
 }catch(e){
  cloudError=String(e.message||e);
  await notice("配对未完成",cloudError+"\n原来的小组件数据和授权保持不变。");
 }
}
if(cloudToken&&!cloudOk){
 try{
  const request=new Request(supabaseURL+"/rest/v1/rpc/fitness_widget_read");
  request.method="POST";request.headers={"apikey":publishableKey,"Content-Type":"application/json"};
  request.body=JSON.stringify({p_token:cloudToken});
  request.timeoutInterval=15;
  const response=await request.loadJSON();
  if(request.response&&request.response.statusCode>=400)throw Error("云端授权已失效，需重新连接");
  const fresh=Array.isArray(response)?response[0]?.widget_summary:null;
  if(!validSnapshot(fresh))throw Error("云端返回摘要无效");
  // Server read is authoritative. A prior MANUAL snapshot may have a newer
  // client-generated syncedAt but contain older weight/kcal data; never let it
  // block the authenticated read-only cloud summary.
  data=fresh;
  fm.writeString(path,JSON.stringify(fresh));
  cloudOk=true;
 }catch(e){cloudError=String(e.message||e)} // Offline: retain last verified local snapshot.
}
const stale = !!data && (data.date !== dateLocal(new Date()) || Date.now()-Date.parse(data.syncedAt) > 36*3600000);
// V88 · 不插入弹性纵向留白；主指标区域使用弹性横向间隔撑满卡片。
const family = config.widgetFamily || "medium";
const small = family === "small";
const widget = new ListWidget();
widget.backgroundColor = white;
widget.url = widgetLaunchUrl(args.widgetParameter);
widget.refreshAfterDate = new Date(Date.now()+20*60*1000); // iOS may delay this request; not guaranteed realtime
widget.setPadding(small?13:16,small?13:17,small?12:15,small?13:17);
function line(parent,value,size,bold=false,color=textColor){
 const item=parent.addText(String(value));
 item.font=bold?Font.boldSystemFont(size):Font.systemFont(size);
 item.textColor=color;
 item.lineLimit=1;
 item.minimumScaleFactor=.77;
 return item;
}
function fmt(v,unit){return isNum(v)?Number(v).toFixed(1)+(unit?" "+unit:""):"—";}
function num(v){return isNum(v)?String(Math.round(v)):"—";}
function gapLabel(){
 if(!data||data.weight.remaining===null)return "距目标";
 return data.weight.remaining<0?"低于目标":data.weight.remaining===0?"目标体重":"距目标";
}
function gapText(){
 if(!data||data.weight.remaining===null)return "—";
 return data.weight.remaining===0?"已达标":fmt(Math.abs(data.weight.remaining),"kg");
}
function trainingText(){
 if(!data)return "—";
 const t=data.training;
 if(t.kind==="strength"){
  if(t.actual)return "已记录";
  return t.done===null||t.total===null?"—":t.done+"/"+t.total;
 }
 return t.kind==="cardio"?"有氧日":"恢复日";
}
function latestInfo(){
 if(!data)return "尚无体重记录";
 return "当前 "+fmt(data.weight.latest,"kg")+" · 目标 "+fmt(data.weight.goal,"kg");
}
function recordedKcal(){
 if(!data||data.nutrition.kcal===null)return "未记录";
 return num(data.nutrition.kcal)+" / "+num(data.nutrition.kcalGoal)+" kcal";
}
function recordedProtein(){
 if(!data||data.nutrition.protein===null)return "未确认";
 return num(data.nutrition.protein)+" / "+num(data.nutrition.proteinGoal)+" g";
}
function dateText(d){
 return new Date(d).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
const head=widget.addStack();head.layoutHorizontally();head.centerAlignContent();
line(head,"健身助手",small?13:15,true);
head.addSpacer();
const statusText=cloudToken?(cloudOk?(stale?"云端待更新":"云端已更新"):cloudError?"读取失败":stale?"待更新":"自动更新"):!data?"未同步":stale?"待更新":"已同步";
line(head,statusText,small?9:10,false,stale||!!cloudError?new Color("#977042"):mutedColor);
widget.addSpacer(small?11:12);
if(!data){
 const empty=widget.addStack();empty.layoutVertically();empty.spacing=7;
 empty.backgroundColor=pale;empty.cornerRadius=13;
 empty.setPadding(13,12,13,12);
 line(empty,"还没有同步数据",small?13:16,true);
 line(empty,"打开网页 → 进度 → 同步小组件",small?10:12,false,mutedColor);
 widget.addSpacer(12);
 line(widget,"点击小组件打开应用",small?9:10,false,mutedColor);
}else{
 // 主信息全部放到同一灰底模块，减少重复标签和浪费的垂直空间。
 const panel=widget.addStack();panel.layoutHorizontally();
 panel.backgroundColor=pale;panel.cornerRadius=small?13:15;
 panel.setPadding(small?11:14,small?10:15,small?10:13,small?10:15);
 const left=panel.addStack();left.layoutVertically();left.spacing=small?5:6;
 line(left,gapLabel(),small?10:11,false,mutedColor);
 line(left,gapText(),small?19:25,true);
 if(!small)line(left,latestInfo(),10,false,mutedColor);
 panel.addSpacer(); // flexible HORIZONTAL spacing stretches the shared KPI surface to the widget width
 const right=panel.addStack();right.layoutVertically();right.spacing=small?5:6;
 line(right,small?"今日训练":"训练进度",small?10:11,false,mutedColor);
 line(right,trainingText(),small?19:24,true);
 if(!small)line(right,data.training.title.slice(0,18)||"—",10,false,mutedColor);
 widget.addSpacer(small?10:12);
 if(small){
  const kcal=widget.addStack();kcal.layoutHorizontally();kcal.centerAlignContent();
  line(kcal,"热量",10,false,mutedColor);
  kcal.addSpacer();
  line(kcal,recordedKcal(),11,true);
 }else{
  const nutrition=widget.addStack();nutrition.layoutHorizontally();nutrition.centerAlignContent();
  const kcal=nutrition.addStack();kcal.layoutVertically();kcal.spacing=4;
  line(kcal,"热量 · kcal",10,false,mutedColor);
  line(kcal,recordedKcal(),14,true);
  nutrition.addSpacer(15);
  const protein=nutrition.addStack();protein.layoutVertically();protein.spacing=4;
  line(protein,"蛋白质",10,false,mutedColor);
  line(protein,recordedProtein(),14,true);
 }
 widget.addSpacer(small?8:10);
 // 时间与数据状态明确，但不放单独的宽大底部卡片。
 line(widget,(stale?"待更新 · ":cloudToken?"云端 ": "更新 ")+dateText(data.syncedAt),small?9:10,false,mutedColor);
}
Script.setWidget(widget);
if(!config.runsInWidget&&!isSync){
 if(small)await widget.presentSmall();
 else await widget.presentMedium();
}
Script.complete();
