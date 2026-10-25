import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createInterface} from 'node:readline';
import path from 'node:path';
export function createLocalBleBridge({base,spawnWorker=spawn}={}){
 let worker,nextId=0,closed=false;const pending=new Map(),sessions=new Map(),scanners=new Set();
 const allowed=new Set(['scan','stop-scan','connect','disconnect','write','read','subscribe']);
 const reply=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 function publish(event){for(const [owner,res]of sessions)if(!event.owner||event.owner===owner)res.write(`data: ${JSON.stringify(event)}\n\n`);}
 function ensureWorker(){
  if(worker)return worker;
  const local=path.join(base,'tools/ble-diagnostic',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const python=process.env.WEDO_BLE_PYTHON||(existsSync(local)?local:'python');
  const child=worker=spawnWorker(python,['-u',path.join(base,'scripts/local-ble-worker.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stderr='';
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-2000);});
  createInterface({input:child.stdout}).on('line',line=>{try{const message=JSON.parse(line);if(message.event){publish(message);return;}const job=pending.get(message.id);if(job){clearTimeout(job.timer);pending.delete(message.id);message.error?job.reject(Error(message.error)):job.resolve(message.result);}}catch{}});
  const failed=error=>{if(worker!==child)return;worker=null;scanners.clear();for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}pending.clear();publish({event:'error',message:error.message});};
  child.on('error',error=>failed(Error('No se pudo iniciar el puente Bluetooth: '+error.message)));
  child.on('exit',()=>failed(Error('El puente Bluetooth local se ha detenido. '+stderr.trim())));
  child.stdin.on('error',()=>{});return child;
 }
 function rpc(owner,request){return new Promise((resolve,reject)=>{if(closed){reject(Error('Puente cerrado'));return;}const child=ensureWorker(),id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(Error('El hub no respondió a tiempo.'));},30000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...request,owner,id})+'\n');});}
 function permitted(req){
  const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return false;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return false;
  if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return false;
  return req.method==='GET'&&!req.headers.origin||req.headers.origin===`http://${host}`;
 }
 async function handle(req,res){
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/local-ble/'))return false;
  if(!permitted(req)){reply(res,403,{error:'Bluetooth local requiere el mismo origen localhost.'});return true;}
  const owner=url.searchParams.get('session');if(!/^[\da-f-]{36}$/i.test(owner||'')){reply(res,400,{error:'Sesión no válida'});return true;}
  if(url.pathname==='/api/local-ble/events'&&req.method==='GET'){
   if(sessions.has(owner)||sessions.size>=16){reply(res,409,{error:'Sesión ocupada'});return true;}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});res.write(': ready\n\n');sessions.set(owner,res);
   res.on('close',()=>{if(sessions.get(owner)!==res)return;sessions.delete(owner);scanners.delete(owner);if(worker){rpc(owner,{op:'release'}).catch(()=>{});if(!scanners.size)rpc(owner,{op:'stop-scan'}).catch(()=>{});}});return true;
  }
  if(url.pathname!=='/api/local-ble/command'||req.method!=='POST'){reply(res,405,{error:'Ruta no válida'});return true;}
  if(!sessions.has(owner)){reply(res,409,{error:'Abre la sesión Bluetooth primero.'});return true;}
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(res,415,{error:'Se requiere JSON'});return true;}
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){reply(res,413,{error:'Solicitud demasiado grande'});return true;}chunks.push(chunk);}
   const request=JSON.parse(Buffer.concat(chunks).toString());if(!allowed.has(request.op))throw Error('Operación no permitida');
   if(request.op==='scan')scanners.add(owner);
   if(request.op==='stop-scan'){scanners.delete(owner);if(scanners.size){reply(res,200,{result:null});return true;}}
   const result=await rpc(owner,request);reply(res,200,{result});
  }catch(error){reply(res,503,{error:error.message});}return true;
 }
 return {handle,close(){closed=true;for(const res of sessions.values())res.end();sessions.clear();worker?.kill();worker=null;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Puente cerrado'));}pending.clear();}};
}
