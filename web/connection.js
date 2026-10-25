import {Hub} from './bluetooth.js';
import {HubGroup} from './hub-group.js';
import {loadOriginalArt,spriteImage,sprite} from './original-art.js';
import {createLocalBluetooth} from './local-bluetooth.js';
let panel,status,connect,disconnect,light,showAll,searchAll,devices,art,tip,pillState,tipAnimation,busy=false;
let authorized=[],connectingDevice=null;
const localMode=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('bluetooth')!=='web';
const localBluetooth=localMode?createLocalBluetooth({onDevices:list=>{authorized=list;if(panel&&!busy)renderDevices(authorized);},onError:error=>{if(panel?.open&&!busy)render(error.message);}}):null;
window.addEventListener('pagehide',()=>localBluetooth?.close());
function buttonChanged(){if(panel?.open)renderDevices(authorized);}
function changed(){window.setConnectedState?.(hubGroup.connected?'true':'false');window.dispatchEvent(new Event('wedo-connection-change'));}
function disconnected(){render('El hub se ha desconectado.');changed();window.dispatchEvent(new Event('wedo-disconnected'));}
export const hub=new Hub(disconnected,buttonChanged);
export const hubGroup=new HubGroup(hub);
const sameDevice=(a,b)=>a===b||!!(a?.id&&a.id===b?.id);
async function connectDevice({device,showAll=false}={}){
 if(hubGroup.connectedDevices.length>=3)throw Error('WeDo admite hasta tres hubs.');
 if(!globalThis.isSecureContext)throw Error('Bluetooth requiere HTTPS o localhost.');
 if(!device?.localBridge&&!navigator.bluetooth)throw Error('Bluetooth web no está disponible. Abre esta página en Chrome o Edge en este PC.');
 // Invoke the chooser before the first await, directly within the click gesture.
 device ||= await navigator.bluetooth.requestDevice({...showAll?{acceptAllDevices:true}:{filters:[{services:['00001523-1212-efde-1523-785feabcd123']}]},optionalServices:['00001523-1212-efde-1523-785feabcd123','00004f0e-1212-efde-1523-785feabcd123','device_information']});
 let target=hubGroup.hubs.find(({hub:h})=>sameDevice(h.device,device))?.hub;
 if(target?.connected)return target;
 target ||= hubGroup.hubs.find(({hub:h})=>!h.connected)?.hub;
 if(!target){target=new Hub(disconnected,buttonChanged);hubGroup.add(target);}
 if(!authorized.some(d=>sameDevice(d,device)))authorized.push(device);
 connectingDevice=device;renderDevices(authorized);
 try{await target.connect({device});changed();return target;}finally{connectingDevice=null;}
}
function render(message){
 if(!panel)return;status.textContent=message;status.hidden=!message;
 connect.disabled=busy;showAll.disabled=busy||hubGroup.connectedDevices.length>=3;searchAll.disabled=showAll.disabled;
 disconnect.hidden=true;light.hidden=true;disconnect.disabled=busy||!hubGroup.connected;light.disabled=busy||!hubGroup.connected;tip.hidden=hubGroup.connected;
 panel.querySelector('.connection-tools').hidden=localMode;
 if(pillState)pillState.src=sprite(art,hubGroup.connected?art.ui.hub.connected:art.ui.hub.disconnected).url;
 renderDevices(authorized);
}
function renderDevices(list){
 const connected=hubGroup.connectedDevices;
 const all=[...connected.map(entry=>entry.device),...list.filter(d=>!connected.some(entry=>sameDevice(entry.device,d)))];
 devices.replaceChildren();for(const device of all){const entry=connected.find(entry=>sameDevice(entry.device,device));const row=document.createElement('div');row.style.position='relative';const item=document.createElement('button');item.type='button';item.className='original-device';
 const connecting=connectingDevice&&sameDevice(connectingDevice,device),pressed=!!entry?.hub.buttonPressed;
 const frame=pressed?art.ui.connection.selectedFrame:entry?art.ui.connection.connectedFrame:connecting?'connectionHubDialogFeatherFrame':'splice';
 item.style.backgroundImage=`url("${sprite(art,frame).url}")`;item.dataset.frame=frame;item.dataset.pressed=String(pressed);
 if(frame==='splice'){Object.assign(item.style,{backgroundImage:'none',boxSizing:'border-box',borderStyle:'solid',borderWidth:'0 calc(6.5px * var(--connection-scale))',borderImageSource:`url("${sprite(art,frame).url}")`,borderImageSlice:'0 13 fill',paddingLeft:'calc(3.5px * var(--connection-scale))',paddingRight:'calc(3.5px * var(--connection-scale))'});}
 item.style.color=entry?'white':connecting?'rgb(0,150,62)':'rgb(128,128,128)';
 item.append(spriteImage(art,art.ui.connection.hubIcon));const name=document.createElement('span');name.textContent=device.name||'Hub WeDo 2.0';item.append(name);item.disabled=busy||!!entry||connected.length>=3;if(entry)item.style.opacity='1';
 if(entry)item.dataset.hubIndex=entry.index;
 item.onclick=()=>act(()=>connectDevice({device}),'Conectando…',()=>`Conectado a ${device.name||'WeDo 2.0'}`);row.append(item);devices.append(row);
 if(entry){const remove=document.createElement('button');remove.type='button';remove.setAttribute('aria-label',`Desconectar ${device.name||'hub '+entry.index}`);remove.disabled=busy;
 // UI.DetectedDevice.Start: icn_remove; prefab width442, center406, size30.
 Object.assign(remove.style,{position:'absolute',right:'calc(21px * var(--connection-scale))',top:'50%',transform:'translateY(-50%)',width:'calc(30px * var(--connection-scale))',height:'calc(30px * var(--connection-scale))',padding:'0',border:'0',background:'transparent',cursor:'pointer'});
 const icon=spriteImage(art,'icn_remove');Object.assign(icon.style,{width:'100%',height:'100%'});remove.append(icon);
 remove.onclick=()=>act(()=>entry.hub.disconnect(),'Desconectando…',()=> 'Hub desconectado.');row.append(remove);}}
}
async function knownDevices(){
 if(!navigator.bluetooth)throw Error('Bluetooth web no está disponible. Abre esta página en Chrome o Edge con Bluetooth activo.');
 if(!navigator.bluetooth.getDevices)return;
 const list=await navigator.bluetooth.getDevices();
 for(const device of list.filter(d=>!d.uuids?.length||d.uuids.some(uuid=>['00001523-1212-efde-1523-785feabcd123','00004f0e-1212-efde-1523-785feabcd123'].includes(uuid.toLowerCase()))))if(!authorized.some(d=>sameDevice(d,device)))authorized.push(device);
 if(!busy)renderDevices(authorized);
}
async function act(action,pending,success){
 if(busy)return;busy=true;render(pending);try{await action();render(success());}
 catch(error){render(/globally disabled/i.test(error.message)?'Brave tiene Bluetooth desactivado. Activa brave://flags/#brave-web-bluetooth-api y reinicia, o abre esta dirección en Chrome.':error.name==='NotFoundError'?'No has seleccionado un hub. Pulsa buscar para abrir el selector del navegador.':error.name==='SecurityError'?'El navegador ha bloqueado Bluetooth. Revisa los permisos del sitio.':error.message);}
 finally{busy=false;render(status.textContent);}
}
// UI.ConnectionCenterTooltipAnimator: PressButtonOnPhysicalHub y=lerp(40,60,abs(sin(t*3))).
function animateTip(){cancelAnimationFrame(tipAnimation);let y=39.0052490234375;const frame=time=>{if(!panel?.open)return;const t=Math.abs(Math.sin(time/1000*3));y+=(40+20*t-y)*t;tip.querySelector('.tip-hand').style.top=`calc(${-82-y}px * var(--connection-scale))`;tipAnimation=requestAnimationFrame(frame);};tipAnimation=requestAnimationFrame(frame);}
function resize(){if(panel)panel.style.setProperty('--connection-scale',innerHeight/768);}
function create(){
 const link=document.createElement('link');link.rel='stylesheet';link.href='/original-connection.css';document.head.append(link);
 panel=document.createElement('dialog');panel.className='wedo-connection';panel.setAttribute('aria-labelledby','wedo-connection-title');
 panel.innerHTML='<div class="connection-tip"></div><section class="connection-sheet"><h2 id="wedo-connection-title">Elige el hub inteligente</h2><button type="button" data-close aria-label="Cerrar"></button><div class="connection-devices"></div><p role="status" aria-live="polite" hidden></p><div class="connection-tools"><button type="button" data-all>Autorizar un hub nuevo</button><button type="button" data-light hidden>Probar luz</button><button type="button" data-disconnect hidden>Desconectar</button></div><button type="button" data-connect aria-label="Actualizar hubs" title="Actualizar hubs"></button></section>';
 document.body.append(panel);status=panel.querySelector('[role=status]');devices=panel.querySelector('.connection-devices');tip=panel.querySelector('.connection-tip');
 tip.append(spriteImage(art,art.ui.connection.tipHand,'tip-hand'),spriteImage(art,art.ui.connection.tipHub,'tip-hub'));
 connect=panel.querySelector('[data-connect]');showAll=panel.querySelector('[data-all]');disconnect=panel.querySelector('[data-disconnect]');light=panel.querySelector('[data-light]');
 searchAll=document.createElement('button');searchAll.type='button';searchAll.textContent='Buscar todos los dispositivos';panel.querySelector('.connection-tools').append(searchAll);
 const pill=document.createElement('button');pill.type='button';pill.className='connection-hub-pill';pill.setAttribute('aria-label','Cerrar centro de conexiones');pill.append(spriteImage(art,art.ui.hub.open));pillState=spriteImage(art,art.ui.hub.disconnected,'connection-hub-state');pill.append(pillState);pill.onclick=()=>panel.close();panel.append(pill);
 connect.append(spriteImage(art,art.ui.connection.refresh));panel.querySelector('[data-close]').append(spriteImage(art,art.ui.connection.close));
 const search=showAll=>{let selected;return act(async()=>{selected=await connectDevice({showAll});},'Selecciona tu hub en el navegador…',()=>`Conectado a ${selected.device.name||'WeDo 2.0'}`);};
 // If the browser cannot restore permissions, refresh must still offer discovery.
 // Invoke requestDevice in this click, before any await can lose user activation.
 connect.onclick=()=>authorized.length||hubGroup.connected?act(()=>knownDevices(),'Actualizando hubs…',()=> ''):search(false);
 if(localMode)connect.onclick=()=>act(()=>localBluetooth.scan(),'Buscando hubs cercanos…',()=> '');
 showAll.onclick=()=>search(false);searchAll.onclick=()=>search(true);
 disconnect.onclick=()=>act(async()=>{for(const {hub:h}of hubGroup.connectedDevices)await h.disconnect();},'Desconectando…',()=> 'Hub desconectado.');
 light.onclick=()=>act(async()=>{for(const {hub:h}of hubGroup.connectedDevices)await h.light('#00aacc');},'Cambiando la luz…',()=> 'Orden enviada: la luz del hub debe verse azul.');
 panel.querySelector('[data-close]').onclick=()=>panel.close();window.addEventListener('resize',resize);resize();
 panel.addEventListener('close',()=>localBluetooth?.stopScan().catch(()=>{}));
}
export async function showConnectionCenter(){
 art ||= await loadOriginalArt();if(!panel)create();if(!panel.open){panel.showModal();animateTip();}
 if(!busy)render(hubGroup.connected?`${hubGroup.connectedDevices.length} hub(s) conectado(s)`:'');
 if(localMode){try{await localBluetooth.scan();}catch(error){if(!busy)render(error.message);}return;}
 try{await knownDevices();if(!busy&&!authorized.length&&!hubGroup.connected)render('No hay hubs autorizados disponibles en este navegador. Pulsa actualizar para buscar; si no aparece, usa «Buscar todos los dispositivos».');}
 catch(error){if(!busy)render(error.message+' Puedes volver a autorizar el hub desde este panel.');}
}
