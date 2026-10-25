import test from 'node:test';
import assert from 'node:assert/strict';
import {HubGroup} from '../web/hub-group.js';
import {OriginalRuntime,createInstruction} from '../web/original-runtime.js';
function fakeHub(id){const calls=[];return {device:{id},connected:true,attachments:new Map(),calls,motor:async(...args)=>calls.push(['motor',...args]),brake:async(...args)=>calls.push(['brake',...args]),lightIndex:async(...args)=>calls.push(['light',...args]),resetLights:async()=>calls.push(['reset']),stop:async()=>calls.push(['stop']),disconnect:async function(){this.connected=false;},readSensor:async(type,port)=>{calls.push(['sensor',type,port]);return 7;}};}
test('three hub slots preserve index and reject a fourth physical hub',async()=>{
 const one=fakeHub('one'),two=fakeHub('two'),three=fakeHub('three'),group=new HubGroup(one);
 assert.equal(group.add(two),2);assert.equal(group.add(three),3);assert.equal(group.add(two),2);
 assert.throws(()=>group.add(fakeHub('four')),/tres/);
 assert.deepEqual(group.resolvePorts(),[1,2,'2:1','2:2','3:1','3:2']);
 await group.remove(two);assert.equal(two.connected,false);assert.deepEqual(group.connectedDevices.map(d=>d.index),[1,3]);
 assert.equal(group.add(fakeHub('new')),2);assert.equal(group.connected,true);
});
test('native addressing routes motor, LED and sensor to the selected hub',async()=>{
 const one=fakeHub('one'),two=fakeHub('two'),group=new HubGroup([one,two]);
 const [address]=group.resolvePorts(null,{PortNumber:2,ConnectorSide:1});await group.motor(address,-80);await group.brake(address);
 await group.lightIndex(5,null,{PortNumber:2,ConnectorSide:2});
 await group.readSensor('MotionSensor',null,{PortNumber:2,ConnectorSide:0});
 assert.deepEqual(one.calls,[]);
 assert.deepEqual(two.calls,[['motor',2,-80],['brake',2],['light',5],['sensor','MotionSensor',1]]);
 two.connected=false;assert.throws(()=>group.resolvePorts(null,{PortNumber:2,ConnectorSide:0}),/no está conectado/);
});
test('runtime uses persistent motor options per native hardware address',async()=>{
 const one=fakeHub('one'),two=fakeHub('two'),group=new HubGroup([one,two]),runtime=new OriginalRuntime({driver:group,minBlockMs:0,settleMs:100000});
 const power=createInstruction('MotorPower');power.parameter.value='4';power.nativePort={PortNumber:2,ConnectorSide:1};power.unsupportedHardware=true;
 await runtime.run([power]);assert.deepEqual(two.calls,[['motor',2,-40]]);assert.deepEqual(one.calls,[]);
 const direction=createInstruction('MotorThatWay');direction.nativePort={PortNumber:2,ConnectorSide:1};direction.unsupportedHardware=true;
 await runtime.run([direction]);assert.deepEqual(two.calls.at(-1),['motor',2,40]);
 const all=createInstruction('MotorThisWay');await runtime.run([all]);
 assert.deepEqual(one.calls,[['motor',1,-80],['motor',2,-80]]);
 assert.deepEqual(two.calls.slice(-2),[['motor',1,-80],['motor',2,-40]]);
 await runtime.stop();assert.deepEqual(one.calls.slice(-2),[['brake',1],['brake',2]]);assert.deepEqual(two.calls.slice(-2),[['brake',1],['brake',2]]);
 one.connected=false;two.connected=false;await runtime.stop();
 clearTimeout(runtime.resetTimer);
});
