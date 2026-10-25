// Hardware.HardwarePort addresses up to three hubs, each with Left/Right/Internal.
// Web Bluetooth still authorizes each physical device separately.
export class HubGroup {
 #slots=new Map();
 constructor(initial=[]){for(const hub of Array.isArray(initial)?initial:[initial])if(hub)this.add(hub);}
 get supportsNativePorts(){return true;}
 get connected(){return this.connectedDevices.length>0;}
 get connectedDevices(){return Object.freeze([...this.#slots].filter(([,hub])=>hub.connected).map(([index,hub])=>Object.freeze({index,hub,device:hub.device})));}
 get hubs(){return Object.freeze([...this.#slots].map(([index,hub])=>Object.freeze({index,hub})));}
 add(hub,index){
  if(!hub||typeof hub.motor!=='function'||typeof hub.brake!=='function')throw Error('Hub no válido.');
  for(const [slot,existing]of this.#slots){if(existing===hub||hub.device?.id&&existing.device?.id===hub.device.id)return slot;}
  index??=[1,2,3].find(slot=>!this.#slots.has(slot));
  if(![1,2,3].includes(index))throw Error('WeDo admite hasta tres hubs.');
  if(this.#slots.has(index))throw Error('La posición del hub ya está ocupada.');
  this.#slots.set(index,hub);return index;
 }
 async remove(hubOrIndex,{disconnect=true}={}){
  const index=typeof hubOrIndex==='number'?hubOrIndex:[...this.#slots].find(([,hub])=>hub===hubOrIndex)?.[0];
  const hub=this.#slots.get(index);if(!hub)return false;
  try{if(disconnect&&hub.connected)await hub.disconnect();}finally{this.#slots.delete(index);}return true;
 }
 getHub(index){const hub=this.#slots.get(index);if(!hub?.connected)throw Error(`El hub ${index} no está conectado.`);return hub;}
 address(index,port){if(![1,2,3].includes(index)||![1,2].includes(port))throw Error('Dirección de hardware no válida.');return index===1?port:`${index}:${port}`;}
 parseAddress(address){
  if(address===1||address===2)return {index:1,port:address};
  const match=/^([123]):([12])$/.exec(String(address));if(!match)throw Error('Dirección de hardware no válida.');
  return {index:Number(match[1]),port:Number(match[2])};
 }
 resolvePorts(port=null,nativePort=null){
  if(nativePort){
   const index=Number(nativePort.PortNumber),side=Number(nativePort.ConnectorSide);
   this.getHub(index);if(![0,1].includes(side))throw Error('El bloque de motor requiere un conector externo.');
   return [this.address(index,side+1)];
  }
  if(port!==null&&port!==undefined){const {index}=this.parseAddress(port);this.getHub(index);return [port];}
  const connected=this.connectedDevices;if(!connected.length)throw Error('Conecta un hub antes de ejecutar el programa.');
  return connected.flatMap(({index})=>[this.address(index,1),this.address(index,2)]);
 }
 motor(address,power){const {index,port}=this.parseAddress(address);return this.getHub(index).motor(port,power);}
 brake(address){const {index,port}=this.parseAddress(address);return this.getHub(index).brake(port);}
 async lightIndex(color,port=null,nativePort=null){
  if(nativePort){const index=Number(nativePort.PortNumber);return this.getHub(index).lightIndex(color);}
  if(port!==null&&port!==undefined){const {index}=this.parseAddress(port);return this.getHub(index).lightIndex(color);}
  const connected=this.connectedDevices;if(!connected.length)throw Error('Conecta un hub antes de cambiar la luz.');
  for(const {hub}of connected)await hub.lightIndex(color);
 }
 async resetLights(){for(const {hub}of this.connectedDevices)await hub.resetLights();}
 async readSensor(type,port=null,nativePort=null){
  if(nativePort){const index=Number(nativePort.PortNumber),side=Number(nativePort.ConnectorSide);if(![0,1].includes(side))throw Error('El sensor requiere un conector externo.');return this.getHub(index).readSensor(type,side+1);}
  if(port!==null&&port!==undefined){const {index,port:connector}=this.parseAddress(port);return this.getHub(index).readSensor(type,connector);}
  const typeId=/tilt|inclin/i.test(type)?34:/motion|distance|distancia/i.test(type)?35:null;
  if(typeId===null)throw Error('Sensor no compatible: '+type);
  for(const {hub}of this.connectedDevices){const attachment=[...(hub.attachments?.values()||[])].find(item=>item.type===typeId);if(attachment)return hub.readSensor(type,attachment.port);}
  throw Error('No se ha detectado el sensor en los hubs conectados.');
 }
 async stop(){for(const {hub}of this.connectedDevices)await hub.stop();}
}
