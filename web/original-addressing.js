import {sprite,spriteImage} from './original-art.js';

// REA ev_ac57750f0b3c1de3e6e4b6e00972f3401fb89727c6b06b5a4bea2a14d582a331:
// HardwareAddressing.ListOfAllHardwarePortsForAddressingMode; Model.*.TogglePort.
const externalTypes=new Set(['MotorPower','MotorOnFor','MotorOff','MotorThisWay','MotorThatWay','TiltSensorNeutral','MotionSensor']);
export function hardwareAddressingMode(node){return node?.type==='Light'?'ByHub':externalTypes.has(node?.type)?'ByPort':'Unsupported';}
export function hardwareAddressingPorts(node){
 const mode=hardwareAddressingMode(node);
 return mode==='Unsupported'?[]:[1,2,3].flatMap(PortNumber=>(mode==='ByHub'?[2]:[0,1]).map(ConnectorSide=>({PortNumber,ConnectorSide})));
}
export function currentHardwarePort(node){return node.nativePort||([1,2].includes(node.port)?{PortNumber:1,ConnectorSide:node.port-1}:null);}
function assignPort(node,port){
 node.nativePort=port;node.port=port?.PortNumber===1&&port.ConnectorSide!==2?port.ConnectorSide+1:null;
 node.unsupportedHardware=!!port&&(port.PortNumber!==1||(port.ConnectorSide===2&&node.type!=='Light'));
 return port;
}
export function activateHardwareAddressing(node){const ports=hardwareAddressingPorts(node);if(!ports.length)return null;return assignPort(node,currentHardwarePort(node)||ports[0]);}
export function toggleHardwareAddressing(node){
 const ports=hardwareAddressingPorts(node);if(!ports.length)return null;
 const current=currentHardwarePort(node),index=ports.findIndex(port=>port.PortNumber===current?.PortNumber&&port.ConnectorSide===current?.ConnectorSide);
 return assignPort(node,ports[index+1]||null);
}

// Pass a positioned block element as anchor. The indicator remains attached to
// the block; the final tap selects all ports and removes it, as in Unity.
export function showHardwareAddressing({node,anchor,catalog,onChange=()=>{},activate=true}){
 if(hardwareAddressingMode(node)==='Unsupported')return null;
 anchor.querySelector(':scope > .original-hardware-addressing')?.remove();
 const hadPort=currentHardwarePort(node);
 if(activate)activateHardwareAddressing(node);
 if(!currentHardwarePort(node))return null;
 const button=document.createElement('button');button.type='button';button.className='original-hardware-addressing';
 Object.assign(button.style,{position:'absolute',left:'50%',bottom:'100%',transform:'translateX(-50%)',width:'60px',height:'40px',padding:'0',border:'0',background:'transparent',zIndex:'20',cursor:'pointer',touchAction:'none'});
 const background=spriteImage(catalog,hardwareAddressingMode(node)==='ByHub'?'HardwareAddressingCellInternalBackground':'HardwareAddressingCellMultiBackground');
 Object.assign(background.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
 const index=document.createElement('img');index.alt='';index.draggable=false;
 Object.assign(index.style,{position:'absolute',width:'10px',height:'10px',transform:'translate(-50%,-50%)',pointerEvents:'none'});
 button.append(background,index);anchor.append(button);
 const render=()=>{const port=currentHardwarePort(node);if(!port){button.remove();return;}
  const rows=hardwareAddressingMode(node)==='ByHub'?1:2,row=port.ConnectorSide===1?1:0;
  index.src=sprite(catalog,`hw_adr_${port.PortNumber}${row+1}`).url;
  index.style.left=`${30+(port.PortNumber-2)*((60-4)/3+1)}px`;index.style.top=`${((40-2-(rows-1))/rows+1)*(row+.5)}px`;
  button.setAttribute('aria-label',`Hub ${port.PortNumber}${rows===2?', puerto '+(row+1):''}. Cambiar dirección de hardware`);
 };
 const advance=()=>{toggleHardwareAddressing(node);render();onChange(node);};
 button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();advance();});
 button.addEventListener('click',event=>{event.stopPropagation();if(event.detail===0)advance();});
 button.addEventListener('contextmenu',event=>event.preventDefault());
 render();if(!hadPort&&activate)onChange(node);
 return {element:button,render,close:()=>button.remove()};
}
