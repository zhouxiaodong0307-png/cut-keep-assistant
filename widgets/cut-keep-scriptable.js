// 减脂保肌小组件 · V85
// 需要 Scriptable（iPhone / iPad）。仅在设备本地保存和显示网页中主动同步的数据。
// 脚本名称必须设为「减脂保肌小组件」。
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), "cut_keep_widget_v1.json");
const appURL = "https://cut-keep-assistant.onrender.com/";
const isSync = args.queryParameters && args.queryParameters.mode === "sync";
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
    await notice("同步未完成", String(e.message || e) + "\n请先在减脂保肌助手中点击「同步小组件」，然后再运行此脚本。");
  }
}
const stale = !!data && (data.date !== dateLocal(new Date()) || Date.now()-Date.parse(data.syncedAt) > 36*3600000);
const family = config.widgetFamily || "medium";
const small = family === "small";
const widget = new ListWidget();
widget.backgroundColor=white;
widget.setPadding(small?13:17,small?13:18,small?13:17,small?13:18);
widget.url=appURL;
widget.refreshAfterDate=new Date(Date.now()+45*60*1000);
function line(parent,t,size,bold=false,color=textColor) {
 const a=parent.addText(String(t));
 a.font=bold?Font.boldSystemFont(size):Font.systemFont(size);
 a.textColor=color;
 a.lineLimit=1;
 a.minimumScaleFactor=.72;
 return a;
}
function cell(parent,label,value,accent=false) {
 const b=parent.addStack(); b.layoutVertically(); b.spacing=4;
 line(b,label,small?10:11,false,mutedColor);
 line(b,value,small?16:20,true,accent?new Color("#315f88"):textColor);
 return b;
}
function dash(v,suffix="") { return v === null || v === undefined ? "—" : String(v)+suffix; }
function fmt(v,unit) { return isNum(v)?v.toFixed(1)+" "+unit:"—"; }
const top=widget.addStack();top.layoutHorizontally();top.centerAlignContent();
line(top,"减脂保肌",small?12:14,true);
top.addSpacer();
line(top,!data?"未同步":stale?"待更新":"已同步",10,false,stale?new Color("#b77936"):mutedColor);
widget.addSpacer(small?13:17);
if (!data) {
  line(widget,"请从网页同步",small?13:18,true);
  widget.addSpacer(5);
  line(widget,"进度 → 数据安全 → iOS 小组件",10,false,mutedColor);
  widget.addSpacer();
} else if (small) {
  line(widget,"距离目标体重",11,false,mutedColor);
  widget.addSpacer(5);
  const status = data.weight.remaining === null ? "—" :
    data.weight.remaining > 0 ? fmt(data.weight.remaining,"kg") :
    data.weight.remaining < 0 ? "低于 "+fmt(Math.abs(data.weight.remaining),"kg") : "已达标";
  line(widget,status,21,true);
  widget.addSpacer();
  const progress = data.training.actual ? "已记录自主训练" : data.training.kind === "strength" ?
    (data.training.done === null || data.training.total === null ? "训练 —" : "训练 "+data.training.done+"/"+data.training.total) :
    data.training.kind === "cardio" ? "有氧安排" : "恢复日";
  line(widget,progress,11,false,mutedColor);
} else {
  const main=widget.addStack();main.layoutHorizontally();main.spacing=12;
  const left=main.addStack();left.layoutVertically();left.spacing=5;
  line(left,"今日训练",11,false,mutedColor);
  const trainValue=data.training.kind==="strength"
    ? (data.training.actual?"已记录自主训练":data.training.done===null||data.training.total===null?"尚无完成记录":data.training.done+" / "+data.training.total+" 动作")
    : data.training.kind==="cardio"?"有氧训练日":"恢复日";
  line(left,trainValue,19,true);
  line(left,data.training.title.slice(0,30)||"—",10,false,mutedColor);
  main.addSpacer();
  const right=main.addStack();right.layoutVertically();right.spacing=5;
  line(right,"体重距目标",11,false,mutedColor);
  const diff=data.weight.remaining;
  const gap=diff===null?"—":diff>0?fmt(diff,"kg"):diff<0?"低于 "+fmt(Math.abs(diff),"kg"):"已达标";
  line(right,gap,19,true);
  line(right,"最近 "+fmt(data.weight.latest,"kg")+" · 目标 "+fmt(data.weight.goal,"kg"),10,false,mutedColor);
  widget.addSpacer(13);
  const bottom=widget.addStack();bottom.layoutHorizontally();bottom.spacing=12;
  const a=bottom.addStack();a.layoutVertically();a.spacing=4;
  line(a,"已摄入 / 今日目标",10,false,mutedColor);
  line(a,dash(data.nutrition.kcal)+" / "+dash(data.nutrition.kcalGoal)+" kcal",15,true);
  bottom.addSpacer();
  const b=bottom.addStack();b.layoutVertically();b.spacing=4;
  line(b,"蛋白质",10,false,mutedColor);
  line(b,data.nutrition.protein===null?"未确认":dash(data.nutrition.protein)+" / "+dash(data.nutrition.proteinGoal)+" g",15,true);
}
widget.addSpacer(6);
line(widget,data?"更新于 "+new Date(data.syncedAt).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})+(stale?" · 请再次同步":""):"点击小组件打开应用",9,false,mutedColor);
Script.setWidget(widget);
if (!config.runsInWidget && !isSync) {
 if (small) await widget.presentSmall(); else await widget.presentMedium();
}
Script.complete();
