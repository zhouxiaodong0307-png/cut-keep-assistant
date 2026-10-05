import express from "express";
import multer from "multer";
import sharp from "sharp";
import convert from "heic-convert";

const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});

app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","https://cut-keep-assistant.onrender.com");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({limit:"15mb"}));

app.get("/health",(req,res)=>res.json({ok:true,version:"1.3.0"}));

async function normalizeImage(file){
  if(!file?.buffer) throw new Error("未收到图片文件");
  let input=file.buffer;
  try{
    return await sharp(input,{failOn:"none"})
      .rotate()
      .resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true})
      .jpeg({quality:86})
      .toBuffer();
  }catch(firstErr){
    const name=(file.originalname||"").toLowerCase();
    const type=(file.mimetype||"").toLowerCase();
    const maybeHeic=type.includes("heic")||type.includes("heif")||name.endsWith(".heic")||name.endsWith(".heif");
    if(!maybeHeic) throw firstErr;
    const jpeg=await convert({buffer:input,format:"JPEG",quality:0.86});
    return await sharp(jpeg)
      .rotate()
      .resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true})
      .jpeg({quality:86})
      .toBuffer();
  }
}

app.post("/api/analyze-food",upload.single("image"),async(req,res)=>{
  try{
    if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"AI 服务尚未配置"});
    const jpg=await normalizeImage(req.file);
    const image="data:image/jpeg;base64,"+jpg.toString("base64");
    const prompt="分析这张食物照片、外卖截图或营养标签。优先读取画面中明确写出的商品名、营养信息和份量；没有明确数据时再根据画面估算。只返回JSON对象，不要markdown：{\"food\":\"简短中文名称\",\"portion\":\"份量说明\",\"kcal\":整数,\"protein\":数字,\"carbs\":数字,\"fat\":数字,\"confidence\":\"高/中/低\",\"note\":\"误差来源或需要用户确认的地方\"}。看不清时标低置信度，不要假装精确。";
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-6-luna",
        input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}]
      })
    });
    const raw=await r.json();
    if(!r.ok) return res.status(502).json({error:"AI 分析失败",detail:raw?.error?.message||"unknown"});
    const out=(raw.output_text||raw.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text||"").trim().replace(/^```json\s*|\s*```$/g,"");
    const data=JSON.parse(out);
    res.json(data);
  }catch(e){
    res.status(500).json({error:"图片处理或分析失败",detail:e.message});
  }
});

app.listen(process.env.PORT||10000,"0.0.0.0");