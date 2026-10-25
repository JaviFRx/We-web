import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOriginalLanRelay} from './lan-server.mjs';
import {createLocalBleBridge} from './local-ble-server.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const localBle=createLocalBleBridge({base});
const original=process.env.WEDO_CONTENT_ROOT||path.join(base,'content/wedo');
const port=Number(process.env.PORT||8080);
const lanRelay=createOriginalLanRelay({onError:error=>console.error('Puente LAN:',error.message)});
const files={'/lab/':'index.html','/app.js':'app.js','/core.js':'core.js','/bluetooth.js':'bluetooth.js','/connection.js':'connection.js','/programming.js':'programming.js','/programming.css':'programming.css','/style.css':'style.css','/library.css':'library.css','/library.js':'library.js','/activities.js':'activities.js'};
for(const name of ['original-lan.js','original-settings.js','original-canvas-controls.js','original-display.js','original-user-audio.js','original-teacher-resources.js','original-content.css','original-text-format.js','original-microphone.js','original-parameter-editor.js','original-camera.js','original-storage.js','original-addressing.js','original-topbar.js','original-snapping.js','hub-group.js','original-lobby.js','original-lobby.css','original-documentation.js','original-art.js','original-editor.js','original-editor.css','original-connection.css','original-runtime.js','original-projects.js','original-bundle.js','original-assets.json'])files['/'+name]=name;
const mime={html:'text/html',js:'text/javascript',json:'application/json',css:'text/css',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',mp4:'video/mp4',mp3:'audio/mpeg',ogg:'audio/ogg',pdf:'application/pdf'};
files['/local-bluetooth.js']='local-bluetooth.js';
mime.wav='audio/wav';
const server=http.createServer(async(req,res)=>{
 try{
  if(await localBle.handle(req,res))return;
  if(await lanRelay.handle(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'){res.writeHead(302,{Location:'/original/#/library'});res.end();return;}
  let file,body;
  if(pathname.startsWith('/original-assets/')){
   const relative=pathname.slice('/original-assets/'.length);
   if(!relative||relative.includes('\\')||relative.includes(':')||relative.split('/').includes('..')){res.writeHead(403);res.end();return;}
   const root=await realpath(path.join(base,'web/original-assets'));file=await realpath(path.resolve(root,relative));
   if(!file.toLowerCase().startsWith((root+path.sep).toLowerCase())){res.writeHead(403);res.end();return;}
  }
  else if(pathname==='/original/bridge.js')file=path.join(base,'original/bridge.js');
  else if(pathname.startsWith('/original/')){
   const relative=pathname.slice('/original/'.length)||'index.html';
   if(relative.includes('\\')||relative.includes(':')||relative.split('/').includes('..')){res.writeHead(403);res.end();return;}
   const root=await realpath(original);file=await realpath(path.resolve(root,relative));
   if(!file.toLowerCase().startsWith((root+path.sep).toLowerCase())){res.writeHead(403);res.end();return;}
   if(relative==='index.html')body=(await readFile(file,'utf8')).replace('</body>','<script src="/original/bridge.js"></script></body>');
   if(relative==='build/config.js')body=(await readFile(file,'utf8')).split('// Internet explorer')[0];
  }else if(files[pathname])file=path.join(base,'web',files[pathname]);
  else {res.writeHead(404);res.end('No encontrado');return;}
  const headers={'Content-Type':(mime[path.extname(file).slice(1)]||'application/octet-stream'),'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
  if(body!==undefined){res.writeHead(200,{...headers,'Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
  let start=0,end=info.size-1,code=200;
  if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match||Number(match[1])>=info.size||(match[2]&&Number(match[2])<Number(match[1]))){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;code=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
  res.writeHead(code,{...headers,'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes'});
  if(req.method==='HEAD'||!info.size)res.end();else createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end('No se pudo cargar el recurso local.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`WeDo local: http://localhost:${server.address().port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.on('close',()=>{lanRelay.close();localBle.close();});
