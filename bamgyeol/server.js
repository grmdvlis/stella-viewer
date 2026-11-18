import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import community from './api/community.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
async function serve(req,res){
  const url=new URL(req.url,'http://127.0.0.1:5173');
  if(url.pathname==='/api/community'){
    const body=req.method==='POST'?Readable.toWeb(req):undefined;
    const response=await community.fetch(new Request(url,{method:req.method,headers:req.headers,body,duplex:'half'}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const name=decodeURIComponent(url.pathname.slice(1))||'index.html';
  const file=path.resolve(root,name);
  const relative=path.relative(root,file).split(path.sep).join('/');
  const publicFile=/^(assets|data|vendor)\//.test(relative)||
    /^(index\.html|style\.css|[a-z][a-z-]*\.js|work\/tutorial-preview\.(html|js|css))$/.test(relative);
  if(!file.startsWith(root+path.sep)||!publicFile||relative==='server.js'){
    res.writeHead(404).end('Not found');
    return;
  }
  const data=fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  res.end(data);
}
http.createServer((req,res)=>serve(req,res).catch(()=>{
  if(!res.headersSent)res.writeHead(404);
  res.end('Not found');
})).listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173'));
