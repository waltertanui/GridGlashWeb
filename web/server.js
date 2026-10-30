import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import events from './api/events.js';
import stats from './api/stats.js';
const envFile=path.resolve(import.meta.dirname,'.env.local');
if(existsSync(envFile))process.loadEnvFile(envFile);
const root=path.resolve(import.meta.dirname,'dist');
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/api/events')return await events(req,res);
    if(pathname==='/api/stats')return await stats(req,res);
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    const page=pathname==='/'?'/index.html':pathname==='/admin'?'/admin.html':pathname==='/privacy'?'/privacy.html':pathname;
    const file=path.resolve(root,'.'+page);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
