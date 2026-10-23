import {motorPacket,lightPacket} from './core.js';
const uuid=n=>`0000${n}-1212-efde-1523-785feabcd123`;
export class Hub {
 constructor(onDisconnect){this.onDisconnect=onDisconnect;this.device=null;this.output=null;this.queue=Promise.resolve();}
 get connected(){return !!(this.device?.gatt.connected && this.output);}
 async connect(){
  if(!navigator.bluetooth)throw Error('Bluetooth web no está disponible. Abre esta página en Chrome o Edge en este PC.');
  this.device=await navigator.bluetooth.requestDevice({filters:[{services:[uuid('1523')]}],optionalServices:[uuid('4f0e')]});
  this.device.addEventListener('gattserverdisconnected',()=>{this.output=null;this.onDisconnect();});
  try{
   const gatt=await this.device.gatt.connect();const io=await gatt.getPrimaryService(uuid('4f0e'));
   this.output=await io.getCharacteristic(uuid('1565'));const input=await io.getCharacteristic(uuid('1563'));
   await this.write(input,new Uint8Array([1,2,6,23,1,0,0,0,0,0,0]));
  }catch(e){this.device.gatt.disconnect();this.output=null;throw e;}
 }
 write(characteristic,data){
  const task=this.queue.catch(()=>{}).then(async()=>{
   if(!this.connected)throw Error('El hub está desconectado.');
   if(characteristic.properties.write)await characteristic.writeValueWithResponse(data);
   else await characteristic.writeValueWithoutResponse(data);
  });this.queue=task;return task;
 }
 motor(port,power){return this.write(this.output,motorPacket(port,power));}
 light(color){return this.write(this.output,lightPacket(color));}
 async stop(){if(this.connected){await this.motor(1,0);await this.motor(2,0);}}
 async disconnect(){try{await this.stop();}finally{this.device?.gatt.disconnect();this.output=null;}}
}
