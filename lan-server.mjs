import dgram from 'node:dgram';
import {createHash} from 'node:crypto';
import {parseOriginalLanPacket,ORIGINAL_LAN_PORT} from './web/original-lan.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY=4096;
export function createOriginalLanRelay({publicOrigin=process.env.WEDO_PUBLIC_ORIGIN,udpEnabled=process.env.WEDO_LAN_BRIDGE==='1',udpFactory=()=>dgram.createSocket({type:'udp4',reuseAddr:true}),onError=()=>{},now=Date.now}={}){
 const clients=new Map(),sentUdp=new Map();let socket,udpReady=false,closed=false;
 const key=packet=>createHash('sha256').update(JSON.stringify(packet)).digest('hex');
 const valid=packet=>packet&&UUID.test(packet.guid)&&packet.timestamp.length<=128&&Buffer.byteLength(packet.message)<=2048;
 function publish(packet){for(const response of clients.get(packet.guid.toLowerCase())||[])if(!response.write(`data: ${JSON.stringify(packet)}\n\n`))response.destroy();}
 function receiveUdp(bytes){if(bytes.length>MAX_BODY)return;const packet=parseOriginalLanPacket(bytes.toString('utf8'));if(!valid(packet))return;const hash=key(packet),echo=sentUdp.get(hash);if(echo&&echo.expires>=now()){if(--echo.count===0)sentUdp.delete(hash);return;}publish(packet);}
 if(udpEnabled){socket=udpFactory();socket.on('message',receiveUdp);socket.on('error',error=>{udpReady=false;onError(error);});socket.bind(ORIGINAL_LAN_PORT,'0.0.0.0',()=>{if(closed)return;try{socket.setBroadcast(true);udpReady=true;}catch(error){onError(error);}});socket.unref?.();}
 const heartbeat=setInterval(()=>{for(const group of clients.values())for(const response of group)response.write(': keepalive\n\n');for(const [hash,echo] of sentUdp)if(echo.expires<now())sentUdp.delete(hash);},15000);heartbeat.unref?.();
 function reply(response,status,message){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({message}));}
 function sameOrigin(request){
  if(request.headers['sec-fetch-site']&& !['same-origin','none'].includes(request.headers['sec-fetch-site']))return false;
  const origin=request.headers.origin;if(!origin)return request.method==='GET';
  const expected=publicOrigin||`${request.socket.encrypted?'https':'http'}://${request.headers.host}`;
  try{return new URL(origin).origin===new URL(expected).origin;}catch{return false;}
 }
 async function handle(request,response){
  const url=new URL(request.url,'http://localhost');if(!url.pathname.startsWith('/api/original-lan/'))return false;
  if(closed){reply(response,503,'Transporte cerrado.');return true;}
  if(!sameOrigin(request)){reply(response,403,'Se requiere el mismo origen.');return true;}
  if(url.pathname==='/api/original-lan/events'&&request.method==='GET'){
   const project=url.searchParams.get('project');if(!project||!UUID.test(project)){reply(response,400,'Proyecto inválido.');return true;}
   const id=project.toLowerCase(),group=clients.get(id)||new Set();if(group.size>=64||[...clients.values()].reduce((n,g)=>n+g.size,0)>=256){reply(response,503,'Demasiadas conexiones.');return true;}
   response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});response.write(': connected\n\n');group.add(response);clients.set(id,group);response.on('close',()=>{group.delete(response);if(!group.size)clients.delete(id);});return true;
  }
  if(url.pathname==='/api/original-lan/messages'&&request.method==='POST'){
   if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||'')){reply(response,415,'Se requiere JSON.');return true;}
   let size=0,body=[];try{for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY){reply(response,413,'Mensaje demasiado grande.');return true;}body.push(chunk);}}catch{if(!response.destroyed)reply(response,400,'Cuerpo incompleto.');return true;}
   const packet=parseOriginalLanPacket(Buffer.concat(body).toString('utf8'));if(!valid(packet)){reply(response,400,'Paquete inválido.');return true;}
   publish(packet);
   if(udpReady){const hash=key(packet),previous=sentUdp.get(hash);sentUdp.set(hash,{expires:now()+1000,count:(previous&&previous.expires>=now()?previous.count:0)+1});socket.send(Buffer.from(JSON.stringify(packet)),ORIGINAL_LAN_PORT,'255.255.255.255',error=>{if(error){sentUdp.delete(hash);onError(error);}});}
   reply(response,202,udpReady?'Mensaje compartido y enviado al puente UDP.':'Mensaje compartido entre navegadores.');return true;
  }
  reply(response,405,'Método o ruta no admitidos.');return true;
 }
 return {handle,get udpReady(){return udpReady;},close(){if(closed)return;closed=true;clearInterval(heartbeat);for(const group of clients.values())for(const response of group)response.end();clients.clear();sentUdp.clear();if(socket)try{socket.close();}catch{};}};
}
