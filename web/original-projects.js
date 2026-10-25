// Model.Project.Project and Model.Persistence.Persister recovered from Assembly-CSharp.dll.
// .proj is UTF-8 JSON; .wedo is a ZIP containing that JSON and a project media directory.
const instructionTypes=['Unknown','Start','MotorPower','MotorOnFor','MotorOff','MotorThisWay','MotorThatWay','Light','PlaySound','Display','WaitFor','SendMessage','StartOnMessage','StartOnKeyPress','DisplayBackground','DisplayAdd','DisplayResize','Repeat'];
const parameterTypes=['Unknown','TiltSensorNeutral','MotionSensor','NumberInput','TextInput','RandomInput','SoundSensorInput','DisplayInput'];
const clone=value=>value===undefined?undefined:structuredClone(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const id=()=>globalThis.crypto?.randomUUID?.()||'web-'+Math.random().toString(36).slice(2);
const position=(raw,transform)=>transform({x:Number(raw['Strip Position X'])||0,y:Number(raw['Strip Position Y'])||0});
const identity=value=>value;
const portFromNative=(port,type)=>{
 if(!port)return {port:null};
 const external=port.ConnectorSide===0||port.ConnectorSide===1;
 return {port:port.PortNumber===1&&external?port.ConnectorSide+1:null,nativePort:clone(port),unsupportedHardware:port.PortNumber!==1||(!external&&type!=='Light')};
};
function parseParameter(raw){
 if(!object(raw))throw Error('Parámetro original no válido.');
 const type=parameterTypes[raw.ParameterType];if(!type)throw Error('Tipo de parámetro no reconocido: '+raw.ParameterType);
 return {id:id(),type,mode:raw.Mode||'',value:String(raw.RawValue??''),...portFromNative(raw.Port,type),native:clone(raw)};
}
function parseNodes(items,depth=0){
 if(!Array.isArray(items)||items.length>1000||depth>40)throw Error('La estructura del programa supera los límites de lectura.');
 return items.map(entry=>{
  const raw=entry?.Instruction;if(!object(raw))throw Error('Instrucción original no válida.');
  const type=instructionTypes[raw.InstructionType];if(!type)throw Error('Tipo de instrucción no reconocido: '+raw.InstructionType);
  return {id:id(),type,mode:raw.Mode||'',key:raw.InstructionOnKey||'',parameter:raw.Parameter?parseParameter(raw.Parameter):null,children:raw['Loop Inner Instructions']?parseNodes(raw['Loop Inner Instructions'],depth+1):[],...portFromNative(raw.Port,type),native:clone(raw),nativeEnvelope:clone(entry)};
 });
}
export function parseOriginalProject(text,{toCanvasPosition=identity}={}){
 if(typeof text!=='string'||text.length>10_000_000)throw Error('Archivo .proj demasiado grande o no válido.');
 const raw=JSON.parse(text.replace(/^\uFEFF/,''));
 if(!object(raw)||typeof raw.CanvasJson!=='string'||typeof raw.Name!=='string')throw Error('No es un proyecto WeDo .proj.');
 const canvas=JSON.parse(raw.CanvasJson);
 if(!object(canvas)||!Array.isArray(canvas.Strips))throw Error('CanvasJson no contiene las tiras originales.');
 if(canvas.Strips.length>1000)throw Error('Demasiadas tiras de programación.');
 const strips=canvas.Strips.map(entry=>{const strip=entry?.Strip;if(!object(strip))throw Error('Tira original no válida.');return {id:id(),...position(strip,toCanvasPosition),nodes:parseNodes(strip['Strip Instructions']),native:clone(strip),nativeEnvelope:clone(entry)};});
 const comments=(canvas.Comments||[]).map(entry=>{const raw=entry.Comment;if(!object(raw))throw Error('Comentario original no válido.');return{id:id(),...position(raw,toCanvasPosition),text:String(raw.CommentValue??''),native:clone(raw),nativeEnvelope:clone(entry)};});
 const detachedParameters=(canvas.DetachedParameters||[]).map(entry=>{const raw=entry.DetachedParameter;if(!object(raw))throw Error('Parámetro separado no válido.');return{id:id(),...position(raw,toCanvasPosition),parameter:parseParameter(raw.Parameter),native:clone(raw),nativeEnvelope:clone(entry)};});
 return {id:raw.Id||id(),name:raw.Name,strips,comments,detachedParameters,native:clone(raw),nativeCanvas:clone(canvas),coordinateSystem:toCanvasPosition===identity?'unity-local':'converted'};
}
function nativePort(node){
 if(node.unsupportedHardware&&node.nativePort)return clone(node.nativePort);
 if(node.port===1||node.port===2)return {...(node.nativePort||{}),PortNumber:1,ConnectorSide:node.port-1};
 if(node.type==='Light'&&node.nativePort?.ConnectorSide===2)return clone(node.nativePort);
 return undefined;
}
function writeParameter(parameter){
 const index=parameterTypes.indexOf(parameter.type);if(index<0)throw Error('Parámetro no exportable: '+parameter.type);
 const raw={...(clone(parameter.native)||{}),ParameterType:index,Mode:parameter.mode||'',RawValue:String(parameter.value??'')};
 const port=nativePort(parameter);if(port)raw.Port=port;else delete raw.Port;
 return raw;
}
function writeNodes(nodes,depth=0){
 if(!Array.isArray(nodes)||nodes.length>1000||depth>40)throw Error('Programa no exportable: estructura fuera de límites.');
 return nodes.map(node=>{
  const index=instructionTypes.indexOf(node.type);if(index<0)throw Error('Instrucción no exportable: '+node.type);
  const raw={...(clone(node.native)||{}),InstructionType:index,Mode:node.mode||''};
  if(node.type==='StartOnKeyPress')raw.InstructionOnKey=node.key||'';else delete raw.InstructionOnKey;
  if(node.parameter)raw.Parameter=writeParameter(node.parameter);else delete raw.Parameter;
  const port=nativePort(node);if(port)raw.Port=port;else delete raw.Port;
  if(node.type==='Repeat')raw['Loop Inner Instructions']=writeNodes(node.children||[],depth+1);else delete raw['Loop Inner Instructions'];
  return {...(clone(node.nativeEnvelope)||{}),Instruction:raw};
 });
}
function setPosition(raw,item,transform){const point=transform({x:item.x,y:item.y});if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Posición no válida.');return {...raw,'Strip Position X':point.x,'Strip Position Y':point.y};}
export function serializeOriginalProject(project,{fromCanvasPosition=identity}={}){
 if(!project||typeof project.name!=='string'||!Array.isArray(project.strips))throw Error('Proyecto no válido.');
 const canvas={...(clone(project.nativeCanvas)||{}),Strips:project.strips.map(strip=>({...clone(strip.nativeEnvelope),Strip:{...setPosition(clone(strip.native)||{},strip,fromCanvasPosition),'Strip Instructions':writeNodes(strip.nodes)}})),DetachedParameters:(project.detachedParameters||[]).map(item=>({...clone(item.nativeEnvelope),DetachedParameter:{...setPosition(clone(item.native)||{},item,fromCanvasPosition),Parameter:writeParameter(item.parameter)}})),Comments:(project.comments||[]).map(item=>({...clone(item.nativeEnvelope),Comment:{...setPosition(clone(item.native)||{},item,fromCanvasPosition),CommentValue:String(item.text??'')}}))};
 const now=new Date().toISOString();
 const raw={Name:project.name,Id:project.id||id(),CreationDate:now,LastOpenDate:now,StudentDocumentationToolProject:'',SDTLockedState:false,...(clone(project.native)||{})};
 raw.Name=project.name;raw.Id=project.id||raw.Id;raw.CanvasJson=JSON.stringify(canvas);
 raw.LastOpenDate=project.lastOpenDate||now;
 if(project.creationDate)raw.CreationDate=project.creationDate;
 return JSON.stringify(raw);
}
export function duplicateOriginalProject(project,newId){
 if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(newId)||newId===project.id)throw Error('La copia necesita un UUID nuevo.');
 const copy=clone(project),oldId=String(project.id),now=new Date().toISOString();
 const relocate=value=>typeof value==='string'&&(value.startsWith(oldId+'/')||value.startsWith(oldId+'\\'))?newId+value.slice(oldId.length):value;
 copy.id=newId;copy.creationDate=now;copy.lastOpenDate=now;
 copy.native??={};copy.native.Id=newId;copy.native.CreationDate=now;copy.native.LastOpenDate=now;
 for(const file of copy.bundleFiles||[])file.name=relocate(file.name);
 const raw=copy.native.StudentDocumentationToolProject;
 if(raw){
  let documentation;try{documentation=typeof raw==='string'?JSON.parse(raw):raw;}catch(error){throw new Error('No se puede duplicar: la documentación original contiene JSON no válido.',{cause:error});}
  const visit=value=>{if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(key==='path'||key==='poster')value[key]=relocate(value[key]);else visit(value[key]);}};
  visit(documentation);copy.native.StudentDocumentationToolProject=typeof raw==='string'?JSON.stringify(documentation):documentation;
 }
 return copy;
}
export const ORIGINAL_PROJECT_FORMAT={extension:'.proj',exportedBundleExtension:'.wedo',instructionTypes,parameterTypes,coordinates:'Unity local units; pass explicit transforms when using CSS pixels.'};
