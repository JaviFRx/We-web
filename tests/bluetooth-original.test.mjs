import test from 'node:test';
import assert from 'node:assert/strict';
import {Hub,inputFormatPacket,originalMotorPower} from '../web/bluetooth.js';

test('real SDK write mode is preferred when the peripheral supports both',async()=>{
 const hub=new Hub(),sent=[];hub.device={gatt:{connected:true}};
 hub.output={properties:{write:true,writeWithoutResponse:true},async writeValueWithResponse(){throw Error('Unexpected acknowledged write');},async writeValueWithoutResponse(data){sent.push([...data]);}};
 hub.input=hub.output;await hub.lightIndex(6);await hub.motor(1,80);await hub.brake(1);
 assert.deepEqual(sent,[[1,2,6,23,0,1,0,0,0,0,0],[6,4,1,6],[1,1,1,80],[1,1,1,127]]);
});

test('original SDK motor offset and braking differ from drift',async()=>{
 assert.equal(originalMotorPower(-80,1),-87);
 assert.equal(originalMotorPower(50,1),68); // Math.Round midpoint-to-even in original .NET.
 assert.equal(originalMotorPower(10,1),42);
 assert.equal(originalMotorPower(80,0),80);
 assert.equal(originalMotorPower(0,1),0);
 const hub=new Hub(),sent=[];hub.output={};hub.write=async(_,data)=>sent.push([...data]);
 await hub.brake(1);await hub.motor(1,0);
 assert.deepEqual(sent,[[1,1,1,127],[1,1,1,0]]);
});
test('discrete LED config and default colour match recovered SDK',async()=>{
 const hub=new Hub(),sent=[];hub.output={};hub.input={};hub.write=async(_,data)=>sent.push([...data]);
 await hub.lightIndex(9);await hub.resetLights();
 assert.deepEqual(sent,[[1,2,6,23,0,1,0,0,0,0,0],[6,4,1,9],[6,4,1,3]]);
 await assert.rejects(()=>hub.lightIndex(11),/rango/);
});
test('input value bundles honor revision, connect IDs and IEEE754 SI values',()=>{
 const hub=new Hub();
 hub.receiveFormat(new Uint8Array([2,1,35,0,1,0,0,0,2,1,4]));
 hub.receiveFormat(new Uint8Array([2,2,34,1,1,0,0,0,2,1,4]));
 const packet=new Uint8Array(11),view=new DataView(packet.buffer);
 packet[0]=2;packet[1]=1;view.setFloat32(2,6.5,true);packet[6]=2;view.setFloat32(7,9,true);
 hub.receiveValue(packet);
 assert.equal(hub.values.get(1).value,6.5);assert.equal(hub.values.get(2).value,9);
 packet[0]=3;view.setFloat32(2,12,true);hub.receiveValue(packet);assert.equal(hub.values.get(1).value,6.5);
 hub.receiveAttachment(new Uint8Array([1,0]));assert.equal(hub.values.has(1),false);
 assert.deepEqual([...inputFormatPacket(2,34,1)],[1,2,2,34,1,1,0,0,0,2,1]);
});
test('queued commands from a disconnected session cannot run after same device reconnects',async()=>{
 const oldSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext'),oldBluetooth=Object.getOwnPropertyDescriptor(navigator,'bluetooth');
 Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});Object.defineProperty(navigator,'bluetooth',{value:{},configurable:true});
 try{
  const device=new EventTarget(),sent=[];device.id='same-device';const characteristic={properties:{write:true},async writeValueWithResponse(data){sent.push([...data]);}};
  device.gatt={connected:false,async connect(){this.connected=true;return this;},async getPrimaryService(){return {getCharacteristic:async()=>characteristic};},disconnect(){this.connected=false;device.dispatchEvent(new Event('gattserverdisconnected'));}};
  let disconnects=0;const hub=new Hub(()=>disconnects++);await hub.connect({device});
  let release;hub.queue=new Promise(resolve=>release=resolve);const oldCommand=hub.motor(1,80);device.gatt.disconnect();
  const reconnect=hub.connect({device});await new Promise(resolve=>setImmediate(resolve));release();
  await assert.rejects(oldCommand,/desconectado/);await reconnect;
  assert.equal(sent.some(packet=>packet[0]===1&&packet[1]===1&&packet[3]===80),false);
  device.gatt.disconnect();assert.equal(disconnects,2,'stale listeners must not emit duplicate disconnect');
 }finally{if(oldSecure)Object.defineProperty(globalThis,'isSecureContext',oldSecure);else delete globalThis.isSecureContext;if(oldBluetooth)Object.defineProperty(navigator,'bluetooth',oldBluetooth);else delete navigator.bluetooth;}
});
