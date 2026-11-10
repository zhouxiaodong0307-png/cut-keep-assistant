const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const css=html.split("<style>")[1]?.split("</style>")[0]||"";
assert(css,"main styles are present");
assert(/APP_BUILD="20261110-compact-retro-select-v108"/.test(html));
// V107 failed visibly on actual iPhone: even single-column input[type=date]
// could render a huge intrinsic localized field. V108 removes that native
// date input and keeps two bounded SELECTS in one compact row.
const retroHtml=html.slice(html.indexOf('<details id="retroTrainingDetails"'),html.indexOf('<div id="dayAdjustExtra"'));
assert(retroHtml.includes('<select id="retroTrainingDate"'),"history date is a short native dropdown");
assert(!retroHtml.includes('id="retroTrainingDate" type="date"'),"Safari native date input must not return");
assert(retroHtml.includes('id="retroTrainingIndex"'),"actual workout day is selectable");
assert(/\.retroTrainingFields\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.15fr\)[^}]*min-width:0[^}]*max-width:100%/.test(css),"two bounded columns on mobile");
assert(!/@media\(max-width:640px\)\{\.retroTrainingFields\{grid-template-columns:minmax\(0,1fr\)/.test(css),"V107 huge full-width date row removed");
assert(/\.retroTrainingFields select,\.retroTrainingFields input\{[^}]*box-sizing:border-box[^}]*width:100%[^}]*min-width:0[^}]*max-width:100%/.test(css),"inputs cannot exceed grid cell");
assert(/\.retroTrainingFields>label\{[^}]*min-width:0[^}]*max-width:100%[^}]*overflow:hidden/.test(css),"label clamps control width");
assert(retroHtml.includes('id="retroRecordedPlan" class="retroRecordedPlan" hidden'),"completed workouts use compact read-only label");
assert(/\.retroRecordedPlan\[hidden\],\.retroTrainingFields select\[hidden\]\{display:none!important\}/.test(css),"only one of readonly/editable plan displayed");
const ui=html.slice(html.indexOf("function updateRetroTrainingForm(dateChanged=false)"),html.indexOf("function renderRetroTrainingForm()"));
assert(ui.includes("index.hidden=!!evidence")&&ui.includes("recordedPlan.hidden=!evidence"),"completed workout display toggle");
const calendar=html.slice(html.indexOf("function renderRetroTrainingForm(){"),html.indexOf("function alignRetroTrainingToday(){"));
assert(calendar.includes("offset<=RETRO_TRAINING_DAYS"),"all 21 historical dates offered");
assert(calendar.includes('options.push('),"ISO date options constructed");
assert(calendar.includes("date.value=validRetroDate(previous,today)?previous:shiftDate(today,-1)"),"selected date is preserved");
assert(retroHtml.includes('onclick="auditRecordedTraining()"'),"recorded session audit remains");
console.log("PASS V108 compact retrospective UI: date dropdown instead of overflowing localized input, two clipped columns, 21-day ISO options and readonly completed plan.");
