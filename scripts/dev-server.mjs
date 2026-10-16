import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createChatHandler } from '../server/chat.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const port = Number(process.env.PORT || 8000);
const origin = 'http://127.0.0.1:' + port;
const chat = createChatHandler({env:() => ({...process.env,ALLOWED_ORIGINS:process.env.ALLOWED_ORIGINS || origin})});
const publicFiles = new Map([
  ['/','index.html'], ['/index.html','index.html'],
  ['/puente_borderhack_2026.html','puente_borderhack_2026.html'],
  ['/El_Paso_Cityscape_(cropped).jpg','El_Paso_Cityscape_(cropped).jpg'],
  ['/src/firebaseConfig.js','src/firebaseConfig.js'],
  ['/src/browserConfig.js','src/browserConfig.js'], ['/src/safeRender.js','src/safeRender.js'],
  ['/tests/browser-harness.html','tests/browser-harness.html']
]);
const types = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',jpg:'image/jpeg'};
const server = http.createServer(async (req,res) => {
  try {
    const pathname = new URL(req.url,origin).pathname;
    if (pathname === '/api/chat') {
      const headers = new Headers();
      for (const [name,value] of Object.entries(req.headers)) if (value !== undefined)
        headers.set(name,Array.isArray(value) ? value.join(',') : value);
      headers.set('x-vercel-forwarded-for',req.socket.remoteAddress || 'local');
      const options = {method:req.method,headers};
      if (!['GET','HEAD'].includes(req.method)) { options.body=Readable.toWeb(req); options.duplex='half'; }
      const response = await chat(new Request(origin + pathname,options));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    const file = publicFiles.get(pathname);
    if (!file) {res.writeHead(404);res.end('Not found');return;}
    const data = await readFile(root + file);
    res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(500);res.end('Request failed');}
});
server.listen(port,'127.0.0.1',()=>console.log('Puente local preview: ' + origin));
