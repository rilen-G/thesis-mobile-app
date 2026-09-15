import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root=resolve('.test-artifacts/build');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,`.${pathname}`);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try {if((await stat(file)).isDirectory())file=resolve(file,'index.html');}catch{if(!extname(file))file+='.html';}
  const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'}).end(data);
 }catch{res.writeHead(404).end('Not found');}
}).listen(8083,'127.0.0.1',()=>console.log('Static test preview: http://127.0.0.1:8083'));
