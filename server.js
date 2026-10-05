import express from "express";
const app=express();
app.use(express.json({limit:"15mb"}));
app.get("/health",(req,res)=>res.json({ok:true,version:"1.2.0"}));
app.post("/api/analyze-food",async(req,res)=>{
 try{
  const {image}=req.body||{};
  if(!image||!image.startsWith("data:image/")) return res.status(400).json({error:"缺少图片"});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"AI 服务尚未配置"});
  const prompt="分析这张食物照片、外卖截图或营养标签。估算实际会吃到的食物与份量。只返回JSON对象，不要markdown：{\"food\":\"简短中文名称\",\"portion\":\"份量说明\",\"kcal\":整数,\"protein\":数字,\"carbs\":数字,\"fat\":数字,\"confidence\":\"高/中/低\",\"note\":\"误差来源或需要用户确认的地方\"}。看不清时宁可标低置信度，不要假装精确。";
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-6-luna",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}]})});
  const raw=await r.json();
  if(!r.ok) return res.status(502).json({error:"AI 分析失败",detail:raw?.error?.message||"unknown"});
  const text=(raw.output_text||raw.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text||"").trim().replace(/^```json\s*|\s*```$/g,"");
  const data=JSON.parse(text);
  res.json(data);
 }catch(e){res.status(500).json({error:"分析失败",detail:e.message})}
});
app.listen(process.env.PORT||10000,"0.0.0.0");