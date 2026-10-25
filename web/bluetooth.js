import {motorPacket,lightPacket} from './core.js';
const uuid=n=>`0000${n}-1212-efde-1523-785feabcd123`;
const bytes=value=>new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
const roundEven=value=>{const floor=Math.floor(value),fraction=value-floor;return fraction===0.5?(floor%2?floor+1:floor):Math.round(value);};
export function inputFormatPacket(port,type,mode,unit=2,notifications=true){return new Uint8Array([1,2,port,type,mode,1,0,0,0,unit,Number(notifications)]);}
export function originalMotorPower(power,firmwareMajor=0){
 if(!Number.isFinite(power)||power< -100||power>100)throw Error('Potencia fuera de rango.');
 if(!power)return 0;
 const magnitude=Math.max(1,Math.abs(power));
 return Math.sign(power)*(firmwareMajor>=1?roundEven(0.65*magnitude+35):magnitude);
}
export class Hub {
 constructor(onDisconnect=()=>{},onButton=()=>{}){this.onDisconnect=onDisconnect;this.onButton=onButton;this.buttonPressed=false;this.buttonError=null;this.device=null;this.output=null;this.input=null;this.queue=Promise.resolve();this.session=0;this.attachments=new Map();this.formats=new Map();this.values=new Map();this.sensorModes=new Map();this.firmwareMajor=0;this.lightMode=1;this.sensorError=null;}
 get connected(){return !!(this.device?.gatt.connected && this.output);}
 async connect({showAll=false,device=null}={}){
  if(this.connected)return;
  if(!globalThis.isSecureContext)throw Error('Bluetooth requiere HTTPS o localhost.');
  if(!device?.localBridge&&!navigator.bluetooth)throw Error('Bluetooth web no está disponible. Abre esta página en Chrome o Edge en este PC.');
  const discovery=showAll?{acceptAllDevices:true}:{filters:[{services:[uuid('1523')]}]};
  this.device=device||await navigator.bluetooth.requestDevice({...discovery,optionalServices:[uuid('1523'),uuid('4f0e'),'device_information']});
  const currentDevice=this.device,session=++this.session;
  this.attachments.clear();this.formats.clear();this.values.clear();this.sensorModes.clear();this.sensorError=null;this.buttonError=null;this.buttonPressed=false;this.firmwareMajor=0;
  this.device.addEventListener('gattserverdisconnected',()=>{if(this.device!==currentDevice||this.session!==session)return;this.session++;this.output=null;this.input=null;this.values.clear();this.onDisconnect();});
  try{
   const gatt=await this.device.gatt.connect();const io=await gatt.getPrimaryService(uuid('4f0e'));
   this.output=await io.getCharacteristic(uuid('1565'));const input=this.input=await io.getCharacteristic(uuid('1563'));
   await this.write(input,new Uint8Array([1,2,6,23,1,0,0,0,0,0,0]));
   this.lightMode=1;
   try{const info=await gatt.getPrimaryService('device_information'),characteristic=await info.getCharacteristic('firmware_revision_string');if(characteristic.readValue)this.firmwareMajor=parseInt(new TextDecoder().decode(bytes(await characteristic.readValue())),10)||0;}catch{/* SDK uses zero offset if firmware revision is unknown. */}
   try{
    await this.subscribe(await io.getCharacteristic(uuid('1561')),v=>this.receiveFormat(v));
    await this.subscribe(await io.getCharacteristic(uuid('1560')),v=>this.receiveValue(v));
    const service=await gatt.getPrimaryService(uuid('1523'));
    await this.subscribe(await service.getCharacteristic(uuid('1527')),v=>this.receiveAttachment(v));
   }catch(error){this.sensorError=error;}
   // DeviceServiceDefinition.DeviceButton = 0x1526. Subscribe independently:
   // a missing sensor characteristic must not disable physical hub identification.
   try{const service=await gatt.getPrimaryService(uuid('1523'));await this.subscribe(await service.getCharacteristic(uuid('1526')),data=>{if(data.length){this.buttonPressed=data[0]!==0;this.onButton(this.buttonPressed);}});}catch(error){this.buttonError=error;}
  }catch(e){if(this.session===session){currentDevice.gatt.disconnect();this.output=null;}throw e;}
 }
 async subscribe(characteristic,callback){
  if(!characteristic.startNotifications)return;
  const device=this.device,session=this.session;
  characteristic.addEventListener('characteristicvaluechanged',event=>{if(this.device===device&&this.session===session&&device.gatt.connected)callback(bytes(event.target.value));});
  await characteristic.startNotifications();
 }
 receiveAttachment(data){
  if(data.length<2)return;const port=data[0];
  if(!data[1]){this.attachments.delete(port);this.formats.delete(port);this.values.delete(port);this.sensorModes.delete(port);return;}
  if(data.length===12)this.attachments.set(port,{port,type:data[3],hubIndex:data[2]});
 }
 receiveFormat(data){
  if(data.length!==11)return;
  this.formats.set(data[1],{revision:data[0],type:data[2],mode:data[3],unit:data[8],size:data[10]});
 }
 receiveValue(data){
  if(data.length<3)return;let offset=1;const pending=[];
  while(offset<data.length){
   const port=data[offset++],format=this.formats.get(port);
   if(!format||format.revision!==data[0]||!format.size||offset+format.size>data.length)return;
   const raw=data.slice(offset,offset+format.size);offset+=format.size;
   const value=format.unit===2&&raw.length===4?new DataView(raw.buffer,raw.byteOffset,raw.byteLength).getFloat32(0,true):raw.length===1?raw[0]:Array.from(raw);
   pending.push([port,{value,mode:format.mode,type:format.type}]);
  }
  for(const [port,value]of pending)this.values.set(port,value);
 }
 write(characteristic,data){
  const device=this.device,session=this.session;
  const task=this.queue.catch(()=>{}).then(async()=>{
   if(this.device!==device||this.session!==session||!this.connected)throw Error('El hub está desconectado.');
   // BluetoothIo.WriteOutputCommand in the recovered SDK uses WriteWithoutResponse.
   // Prefer that operation when the hub advertises both properties.
   if(characteristic.properties.writeWithoutResponse)await characteristic.writeValueWithoutResponse(data);
   else if(characteristic.properties.write)await characteristic.writeValueWithResponse(data);
   else throw Error('La característica Bluetooth no permite escritura.');
  });this.queue=task;return task;
 }
 motor(port,power){const attached=this.attachments.get(port);if(attached&&attached.type!==1)return Promise.resolve();return this.write(this.output,motorPacket(port,originalMotorPower(power,this.firmwareMajor)));}
 brake(port){if(![1,2].includes(port))throw Error('Puerto de motor no válido.');const attached=this.attachments.get(port);if(attached&&attached.type!==1)return Promise.resolve();return this.write(this.output,new Uint8Array([port,1,1,127]));}
 async light(color){if(this.lightMode!==1){await this.write(this.input,inputFormatPacket(6,23,1,0,false));this.lightMode=1;}return this.write(this.output,lightPacket(color));}
 async lightIndex(index){
  if(!Number.isInteger(index)||index<0||index>10)throw Error('Índice de luz fuera de rango (0–10).');
  if(this.lightMode!==0){await this.write(this.input,inputFormatPacket(6,23,0,0,false));this.lightMode=0;}
  return this.write(this.output,new Uint8Array([6,4,1,index]));
 }
 resetLights(){return this.lightIndex(3);}
 async readSensor(type,port=null){
  if(!this.connected)throw Error('Conecta el hub para leer el sensor.');
  const session=this.session;
  if(this.sensorError)throw Error('No se pudieron activar las notificaciones del sensor: '+this.sensorError.message);
  const tilt=/tilt|inclin/i.test(type),motion=/motion|distance|distancia/i.test(type);
  if(!tilt&&!motion)throw Error('Sensor no compatible: '+type);
  const typeId=tilt?34:35,mode=tilt?1:0;
  if(port===null)port=[...this.attachments.values()].find(item=>item.type===typeId)?.port;
  if(![1,2].includes(port))throw Error('No se ha detectado el sensor '+(tilt?'de inclinación':'de distancia')+'.');
  const attached=this.attachments.get(port);if(attached&&attached.type!==typeId)throw Error('El sensor del puerto no corresponde al bloque.');
  const config=typeId+':'+mode;
  if(this.sensorModes.get(port)!==config){this.values.delete(port);await this.write(this.input,inputFormatPacket(port,typeId,mode,2,true));this.sensorModes.set(port,config);}
  const until=Date.now()+2500;
  while(Date.now()<until){if(!this.connected||this.session!==session)throw Error('El hub se ha desconectado.');const sample=this.values.get(port);if(sample&&sample.type===typeId&&sample.mode===mode)return sample.value;await new Promise(resolve=>setTimeout(resolve,25));}
  throw Error('El sensor no ha enviado datos. Comprueba el puerto y la conexión.');
 }
 async stop(){if(this.connected){await this.motor(1,0);await this.motor(2,0);}}
 async disconnect(){try{await this.stop();}finally{await this.device?.gatt.disconnect();this.output=null;}}
}
