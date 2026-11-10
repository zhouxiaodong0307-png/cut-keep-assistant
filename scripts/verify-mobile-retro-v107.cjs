const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const css=html.split("<style>")[1]?.split("</style>")[0]||"";
assert(css,"main styles are present");
assert(/APP_BUILD="20261110-retro-form-responsive-v107"/.test(html));
// iPhone-sized viewports must give the native localized date its own entire row.
// Older V106 two-column layouts allowed the date string's internal minimum size
// to overlap the adjacent training-day picker in Safari (Chinese locale).
assert(/\.retroTrainingFields\s*\{[^}]*grid-template-columns\s*:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s.test(css),"wide layout retains compact two columns");
assert(/@media\s*\(\s*max-width\s*:\s*640px\s*\)\s*\{\s*\.retroTrainingFields\s*\{\s*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/s.test(css),"on phones one field per row");
assert(/\.retroTrainingFields input\[type="date"\]\s*\{[^}]*width\s*:\s*100%[^}]*max-width\s*:\s*100%[^}]*min-inline-size\s*:\s*0/s.test(css),"date respects available width");
assert(/@media\s*\(max-width\s*:\s*640px\)\s*\{\s*\.retroTrainingFields input,\s*\.retroTrainingFields select\s*\{[^}]*height\s*:\s*44px[^}]*font-size\s*:\s*16px/s.test(css),"iPhone controls have 44px targets and prevent zoom");
assert(html.includes('id="retroTrainingDate" type="date"')&&html.includes('id="retroTrainingIndex"'),"keep native date and selectable workout type");
assert(html.includes('id="retroRecordedPlan" class="retroRecordedPlan" hidden'),"recorded workouts show noninteractive information");
assert(/\.retroRecordedPlan\[hidden\],\s*\.retroTrainingFields select\[hidden\]\s*\{display:none!important\}/.test(css),"only one of readonly/editable is visible");
const ui=html.slice(html.indexOf("function updateRetroTrainingForm(dateChanged=false)"),html.indexOf("function renderRetroTrainingForm()"));
assert(ui.includes("index.hidden=!!evidence"),"completed record removes unusable selector");
assert(ui.includes("recordedPlan.hidden=!evidence"),"readonly label toggles with recorded state");
assert(ui.includes("index.disabled=!!evidence"),"completed record remains immutable");
assert(html.includes('onclick="auditRecordedTraining()"'),"completed records still use independent audit");
console.log("PASS V107 responsive retro date + plan fields: phone stack, readable native inputs, readonly completed records, editable new records.");
