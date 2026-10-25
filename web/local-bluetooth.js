// BluetoothDevice-compatible adapter backed by the loopback Bleak worker.
// Keeps the existing WeDo protocol/runtime and bypasses navigator.bluetooth.
const uuid=value=>({device_information:'0000180a-0000-1000-8000-00805f9b34fb',firmware_revision_string:'00002a26-0000-1000-8000-00805f9b34fb'}[value]||value.toLowerCase());
export function createLocalBluetooth({onDevices=()=>{},onError=()=>{}}={}){
 const devices=new Map();let session,stream,ready,closed=false;
 function lost(){for(const device of devices.values())if(device.gatt.connected){device.gatt.connected=false;device.characteristics.clear();device.dispatchEvent(new Event('gattserverdisconnected'));}}
 function remember(items){
  const visible=[];
  for(const item of items){let device=devices.get(item.id);if(!device){device=new EventTarget();device.id=item.id;device.localBridge=true;device.characteristics=new Map();
    device.gatt={connected:false,async connect(){const services=await command({op:'connect',device:device.id});this.services=services;this.connected=true;return this;},async getPrimaryService(name){const service=this.services?.find(s=>s.uuid===uuid(name));if(!service)throw Error('Servicio del hub no disponible: '+name);return {async getCharacteristic(name){const definition=service.characteristics.find(c=>c.uuid===uuid(name));if(!definition)throw Error('Característica del hub no disponible: '+name);let characteristic=device.characteristics.get(definition.uuid);if(!characteristic){characteristic=new EventTarget();characteristic.uuid=definition.uuid;characteristic.properties={write:definition.properties.includes('write'),writeWithoutResponse:definition.properties.includes('write-without-response')};const call=(op,extra={})=>command({op,device:device.id,characteristic:characteristic.uuid,...extra});characteristic.writeValueWithResponse=data=>call('write',{data:[...data],response:true});characteristic.writeValueWithoutResponse=data=>call('write',{data:[...data],response:false});characteristic.readValue=async()=>new DataView(new Uint8Array(await call('read')).buffer);characteristic.startNotifications=async()=>{await call('subscribe');return characteristic;};device.characteristics.set(definition.uuid,characteristic);}return characteristic;}};},disconnect(){const task=command({op:'disconnect',device:device.id});task.catch(error=>onError(error));return task;}};
    devices.set(item.id,device);
   }Object.assign(device,{name:item.name,uuids:item.uuids,rssi:item.rssi});visible.push(device);
  }
  for(const device of devices.values())if(device.gatt.connected&&!visible.includes(device))visible.push(device);
  onDevices(visible);return visible;
 }
 function open(){
  if(ready)return ready;
  session=crypto.randomUUID();
  ready=new Promise((resolve,reject)=>{
   stream=new EventSource('/api/local-ble/events?session='+session);const timer=setTimeout(()=>{stream.close();ready=null;reject(Error('No responde el puente Bluetooth local.'));},8000);
   stream.onopen=()=>{clearTimeout(timer);resolve();};
   stream.onerror=()=>{clearTimeout(timer);stream.close();ready=null;lost();const error=Error('Se ha perdido la conexión con el puente Bluetooth local.');reject(error);onError(error);};
   stream.onmessage=event=>{const message=JSON.parse(event.data);if(message.event==='devices'){remember(message.devices);return;}if(message.event==='error'){lost();onError(Error(message.message));return;}const device=devices.get(message.device);if(!device)return;
    if(message.event==='disconnected'){device.gatt.connected=false;device.characteristics.clear();device.dispatchEvent(new Event('gattserverdisconnected'));}
    if(message.event==='value'){const characteristic=device.characteristics.get(message.characteristic);if(characteristic){characteristic.value=new DataView(new Uint8Array(message.data).buffer);characteristic.dispatchEvent(new Event('characteristicvaluechanged'));}}
   };
  });return ready;
 }
 async function command(request){
  if(closed)throw Error('Puente Bluetooth cerrado.');await open();
  const response=await fetch('/api/local-ble/command?session='+session,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const result=await response.json();if(!response.ok)throw Error(result.error||'Error del puente Bluetooth.');return result.result;
 }
 return {async scan(){return remember(await command({op:'scan'}));},async stopScan(){if(ready)await command({op:'stop-scan'});},close(){closed=true;stream?.close();}};
}
