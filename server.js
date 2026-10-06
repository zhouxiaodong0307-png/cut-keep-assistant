import http from "node:http";

const PORT=Number(process.env.PORT||10000);
const ALLOWED_ORIGIN="https://cut-keep-assistant.onrender.com";

const server=http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin",ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");

  if(req.method==="OPTIONS"){
    res.writeHead(204);
    return res.end();
  }

  if(req.method==="GET"&&req.url==="/health"){
    res.writeHead(200,{"Content-Type":"application/json; charset=utf-8"});
    return res.end(JSON.stringify({ok:true,version:"1.4.0",photoAI:false}));
  }

  if(req.url==="/api/analyze-food"){
    res.writeHead(410,{"Content-Type":"application/json; charset=utf-8"});
    return res.end(JSON.stringify({error:"图片 AI 识别已停用，请使用文字或营养信息粘贴识别。"}));
  }

  res.writeHead(404,{"Content-Type":"application/json; charset=utf-8"});
  res.end(JSON.stringify({error:"Not found"}));
});

server.listen(PORT,"0.0.0.0");
