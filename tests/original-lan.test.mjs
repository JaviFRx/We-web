import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {createOriginalLanRelay} from '../lan-server.mjs';
import {createOriginalLanMailbox,createOriginalLan,parseOriginalLanPacket} from '../web/original-lan.js';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const packet=(guid,message)=>({guid,timestamp:'24/10/2026 18:00:00',message});
test('native mailbox toggles GUID before tick, filters project and suppresses 1000ms after stop',()=>{
 let now=0;const seen=[],m=createOriginalLanMailbox({projectId:A,onMessage:v=>seen.push(v),now:()=>now});
 now=1000;m.receive(packet(A,'too early'));m.tick();assert.deepEqual(seen,[]);
 now=1001;m.sent();m.local('sent');m.receive(packet(A,'sent'));m.tick();assert.deepEqual(seen,['sent']);
 m.receive(packet(A,'duplicate'));m.receive(packet(A,'duplicate'));m.tick();assert.deepEqual(seen,['sent']);
 m.receive(packet(B,'other project'));m.receive(packet(A,'next'));m.tick();assert.deepEqual(seen,['sent','next']);
 m.executionStopped();now=2001;m.receive(packet(A,'boundary'));m.tick();now=2002;m.receive(packet(A,'after'));m.tick();assert.deepEqual(seen,['sent','next','after']);
 assert.equal(parseOriginalLanPacket('{bad'),null);assert.equal(parseOriginalLanPacket({guid:A,message:'missing timestamp'}),null);
});
async function fixture(options={}){
 const errors=[],relay=createOriginalLanRelay({udpEnabled:false,onError:e=>errors.push(e),...options});
 const server=http.createServer(async(req,res)=>{if(!await relay.handle(req,res)){res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`,readers=[];
 return {origin,relay,errors,async stream(project){const response=await fetch(`${origin}/api/original-lan/events?project=${project}`),reader=response.body.getReader();readers.push(reader);await reader.read();return reader;},post(p,headers={}){return fetch(`${origin}/api/original-lan/messages`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(p)});},async close(){for(const r of readers)await r.cancel();relay.close();await new Promise(resolve=>server.close(resolve));}};
}
const data=async reader=>new TextDecoder().decode((await reader.read()).value);
test('loopback SSE shares only matching project; validates same origin, JSON and UUID',async()=>{
 const f=await fixture();try{const a=await f.stream(A),b=await f.stream(B);assert.equal((await f.post(packet(A,'hello'))).status,202);assert.match(await data(a),/hello/);await f.post(packet(B,'different'));const other=await data(b);assert.match(other,/different/);assert.doesNotMatch(other,/hello/);
  assert.equal((await f.post(packet(A,'blocked'),{Origin:'https://elsewhere.invalid'})).status,403);
  assert.equal((await f.post(packet(A,'blocked'),{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.post(packet('not-a-project','bad'))).status,400);assert.equal((await f.post(packet(A,'x'.repeat(2050)))).status,400);assert.equal(f.relay.udpReady,false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('native UDP gateway uses injected fixture only; forwards, filters own echo and closes',async()=>{
 const socket=new EventEmitter(),sent=[];let bound,closed=false;
 Object.assign(socket,{bind(port,address,done){bound=[port,address];queueMicrotask(done);},setBroadcast(v){assert.equal(v,true);},send(bytes,port,address,done){sent.push({bytes,port,address});done();},close(){closed=true;}});
 const f=await fixture({udpEnabled:true,udpFactory:()=>socket});try{assert.deepEqual(bound,[61557,'0.0.0.0']);const a=await f.stream(A);await f.post(packet(A,'out'));assert.match(await data(a),/out/);assert.equal(sent.length,1);assert.equal(sent[0].address,'255.255.255.255');assert.equal(sent[0].port,61557);
  socket.emit('message',sent[0].bytes);socket.emit('message',Buffer.from(JSON.stringify(packet(A,'native input'))));const received=await data(a);assert.match(received,/native input/);assert.doesNotMatch(received,/'out'/);
 }finally{await f.close();assert.equal(closed,true);}
});
test('browser transport disables local delivery for runtime integration and consumes server echo',async()=>{
 class FakeEvents extends EventTarget{constructor(){super();queueMicrotask(()=>this.onopen());}close(){this.closed=true;}}
 let source,now=2000;class Events extends FakeEvents{constructor(){super();source=this;}}
 const seen=[],client=createOriginalLan({projectId:A,onMessage:v=>seen.push(v),deliverLocal:false,EventSourceClass:Events,now:()=>now,fetchImpl:async(url,options)=>{source.dispatchEvent(new MessageEvent('message',{data:options.body}));return {ok:true};}});
 try{await client.ready;now=4000;await client.send('one');await new Promise(r=>setTimeout(r,40));assert.deepEqual(seen,[]);source.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(packet(A,'external'))}));await new Promise(r=>setTimeout(r,40));assert.deepEqual(seen,['external']);}finally{client.close();assert.equal(source.closed,true);}
});
