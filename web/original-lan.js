// Messaging.LANController: GUID is the project ID, not a unique message ID.
export const ORIGINAL_LAN_PORT=61557;
export function parseOriginalLanPacket(value){
 try{const p=typeof value==='string'?JSON.parse(value):value;if(!p||typeof p!=='object'||typeof p.guid!=='string'||typeof p.timestamp!=='string'||typeof p.message!=='string')return null;return {guid:p.guid,timestamp:p.timestamp,message:p.message};}catch{return null;}
}
export function createOriginalLanMailbox({projectId,onMessage,now=Date.now}){
 const pending=new Map();let stoppedAt=now();
 const notify=message=>{if(now()-stoppedAt>1000)onMessage?.(message);};
 return {
  get canDeliver(){return now()-stoppedAt>1000;},
  receive(packet){const p=parseOriginalLanPacket(packet);if(!p)return false;if(pending.has(p.guid))pending.delete(p.guid);else pending.set(p.guid,p.message);return true;},
  tick(){for(const [guid,message] of pending)if(message!==''&&guid.includes(projectId)){notify(message);pending.delete(guid);}},
  sent(){pending.set(projectId,'');},cancelSent(){if(pending.get(projectId)==='')pending.delete(projectId);},
  local:notify,executionStopped(){stoppedAt=now();},clear(){pending.clear();}
 };
}
export function createOriginalLan({projectId,onMessage,onStatus,deliverLocal=true,base='/api/original-lan',EventSourceClass=globalThis.EventSource,fetchImpl=globalThis.fetch,now=Date.now}){
 const mailbox=createOriginalLanMailbox({projectId,onMessage,now});let connected=false,closed=false,settled=false,resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve),finish=value=>{if(!settled){settled=true;resolveReady(value);}};
 const source=new EventSourceClass(`${base}/events?project=${encodeURIComponent(projectId)}`);
 source.onopen=()=>{connected=true;finish(true);onStatus?.({connected:true});};
 source.onerror=()=>{connected=false;finish(false);onStatus?.({connected:false,error:'No se pudo conectar el transporte de mensajes.'});};
 source.addEventListener('message',event=>mailbox.receive(event.data));
 const timer=setInterval(()=>mailbox.tick(),16);
 return {ready,get connected(){return connected;},get canDeliver(){return mailbox.canDeliver;},executionStopped:()=>mailbox.executionStopped(),
  async send(message){
   if(closed)throw Error('El transporte de mensajes está cerrado.');message=String(message);if(deliverLocal)mailbox.local(message);
   await ready;if(!connected)throw Error('El mensaje se entregó localmente; el transporte compartido no está disponible.');
   mailbox.sent();const packet={guid:projectId,timestamp:new Date(now()).toISOString(),message};
   try{const response=await fetchImpl(`${base}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet)});if(!response.ok)throw Error(`No se pudo enviar el mensaje compartido (${response.status}).`);}catch(error){mailbox.cancelSent();onStatus?.({connected,error:error.message});throw error;}
  },
  close(){if(closed)return;closed=true;connected=false;clearInterval(timer);source.close();mailbox.clear();finish(false);}
 };
}
