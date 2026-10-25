// Port of the installed WeDo Assembly-CSharp build (SHA256 579d17be…bdae).
// REA static ev_4093b10…dc; imported reconstruction ev_5b66caca…a98.
// Sources: InstructionFactory, InstructionInterpreter, MotorController/Options,
// ExecutionEngine/Dispatcher, WaitForController, DisplayPaneModel, LANController.
// Browser adaptation: sensor polling replaces Unity notifications; LAN transport is optional.
const def=(label,category,parameterType=null,defaultValue=null,modes=[])=>({label,category,parameterType,defaultValue,modes,attachDefaultParameter:parameterType!==null});
export const ORIGINAL_DEFINITIONS=Object.freeze({
 MotorPower:def('Potencia del motor','HardwareOutput','NumberInput','8'),
 MotorOnFor:def('Motor durante','HardwareOutput','NumberInput','1'),
 MotorOff:def('Parar motor','HardwareOutput'),
 MotorThisWay:def('Motor en un sentido','HardwareOutput',null,null,['MotorCounterClockwise','MotorClockwise']),
 MotorThatWay:def('Motor en sentido contrario','HardwareOutput',null,null,['MotorClockwise','MotorCounterClockwise']),
 Light:def('Luz','HardwareOutput','NumberInput','1'),
 PlaySound:def('Sonido','SmartDeviceOutput','NumberInput','1'),
 DisplayBackground:def('Fondo de pantalla','SmartDeviceOutput','NumberInput','1'),
 Display:def('Mostrar','SmartDeviceOutput','TextInput','123'),
 DisplayAdd:def('Operación de pantalla','SmartDeviceOutput','NumberInput','1',['DisplayAdd','DisplaySubtract','DisplayMultiplication','DisplayDivide']),
 DisplayResize:def('Tamaño de pantalla','SmartDeviceOutput',null,null,['DisplaySmaller','DisplayLarger','DisplayHide']),
 Start:def('Inicio','Start'),
 StartOnKeyPress:def('Al pulsar tecla','Start'),
 StartOnMessage:def('Al recibir mensaje','Start','TextInput','abc'),
 SendMessage:def('Enviar mensaje','FlowControl','TextInput','abc'),
 WaitFor:def('Esperar','FlowControl','NumberInput','1'),
 Repeat:{...def('Repetir','FlowControl','NumberInput','10'),attachDefaultParameter:false}
});
export const ORIGINAL_PARAMETERS=Object.freeze({
 TiltSensorNeutral:{label:'Inclinación',value:'',modes:['TiltSensorChange','TiltSensorLeft','TiltSensorRight','TiltSensorBackward','TiltSensorForward','TiltSensorNeutral']},
 MotionSensor:{label:'Distancia',value:'',modes:['DistanceSensorChange','DistanceSensorDefault','DistanceSensorCloser','DistanceSensorFurther']},
 SoundSensorInput:{label:'Sonido detectado',value:'',modes:[]},
 NumberInput:{label:'Número',value:'123',modes:[]},
 TextInput:{label:'Texto',value:'abc',modes:[]},
 DisplayInput:{label:'Valor de pantalla',value:'',modes:[]},
 RandomInput:{label:'Aleatorio',value:'',modes:[]}
});
let serial=0;
const id=()=>globalThis.crypto?.randomUUID?.()||`instruction-${Date.now()}-${++serial}`;
export function createParameter(type){
 const d=ORIGINAL_PARAMETERS[type];if(!d)throw Error('Parámetro desconocido: '+type);
 return {type,value:d.value,mode:d.modes[0]||'',port:null};
}
export function createInstruction(type){
 const d=ORIGINAL_DEFINITIONS[type];if(!d)throw Error('Instrucción desconocida: '+type);
 const parameter=d.attachDefaultParameter?{...createParameter(d.parameterType),value:d.defaultValue}:null;
 return {id:id(),type,mode:d.modes[0]||'',parameter,children:[],port:null,...(type==='StartOnKeyPress'?{key:'A'}:{})};
}
const float=value=>value!==null&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
const integer=value=>/^[+-]?\d+$/.test(String(value).trim())&&Number.isSafeInteger(Number(value))?Number(value):null;
const abortError=()=>new DOMException('Programa detenido','AbortError');
function pause(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const finish=()=>{signal?.removeEventListener('abort',cancel);resolve();};
  const timer=setTimeout(finish,Math.max(0,ms));
  const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(abortError());};
  signal?.addEventListener('abort',cancel,{once:true});
 });
}
const tiltValues={TiltSensorNeutral:0,TiltSensorLeft:7,TiltSensorRight:5,TiltSensorBackward:3,TiltSensorForward:9};
function distanceMatches(mode,current,initial){
 return mode==='DistanceSensorCloser'?current<initial:mode==='DistanceSensorFurther'?current>initial:mode==='DistanceSensorChange'?current!==initial:current<8;
}
function checkStrip(strip,seen=new Set(),checkHardware=true){
 if(!Array.isArray(strip))throw Error('La tira debe ser una lista de instrucciones.');
 for(const node of strip){
  if(!node||!ORIGINAL_DEFINITIONS[node.type])throw Error('Instrucción no compatible: '+node?.type);
  if(checkHardware&&(node.unsupportedHardware||node.parameter?.unsupportedHardware))throw Error('Este programa utiliza otro hub o un puerto que todavía no está disponible.');
  if(seen.has(node))throw Error('El programa contiene conexiones circulares o compartidas.');seen.add(node);
  if(node.port!==null&&node.port!==undefined&&![1,2].includes(node.port))throw Error('Puerto no válido.');
  if(node.parameter&&!ORIGINAL_PARAMETERS[node.parameter.type])throw Error('Parámetro no compatible: '+node.parameter.type);
  if(node.children?.length&&node.type!=='Repeat')throw Error('Solo Repetir admite bloques interiores.');
  checkStrip(node.children||[],seen,checkHardware);
 }
}

export class OriginalRuntime {
 constructor({driver={},onState=()=>{},onDisplay=()=>{},onSound,onSoundDuration,random=Math.random,pollMs=30,minBlockMs=300,settleMs=1}={}){
  Object.assign(this,{driver,onState,onDisplay,onSound,onSoundDuration,random,pollMs,minBlockMs,settleMs});
  this.motors=new Map([[1,{speed:8,direction:-1}],[2,{speed:8,direction:-1}]]);
  this.display={label:'',background:'0',mode:'DisplayHide',shown:false,fullscreen:false};
  this.runs=new Set();this.pendingActions=new Set();this.strips=[];this.touchedMotor=false;this.touchedLight=false;
  this.messageBlockedUntil=0;this.resetTimer=null;
 }
 get running(){return this.runs.size>0;}
 get capabilities(){return {lan:typeof this.driver.sendMessage==='function',sound:!!(this.onSound||this.driver.sound),sensors:typeof this.driver.readSensor==='function'};}
 registerStrips(strips){for(const s of strips)checkStrip(s,new Set(),false);this.strips=strips;}
 async call(name,...args){if(typeof this.driver[name]!=='function')throw Error('Función no disponible: '+name);return this.driver[name](...args);}
 emit(status,node,extra={}){this.onState({status,instructionId:node?.id||null,type:node?.type||null,activeRuns:this.runs.size,...extra});}
 async run(strip,{startIndex=0}={}){
  checkStrip(strip,new Set(),!this.driver.supportsNativePorts);clearTimeout(this.resetTimer);
  const execution={controller:new AbortController(),active:new Set(),root:strip,promise:null};this.runs.add(execution);
  execution.promise=(async()=>{
   try{await this.sequence(strip,execution.controller.signal,execution,startIndex);this.runs.delete(execution);this.emit('completed');}
   catch(error){this.runs.delete(execution);this.emit(error.name==='AbortError'?'stopped':'error',null,{error:error.message});throw error;}
   finally{this.runs.delete(execution);if(!this.runs.size)this.scheduleLightReset();}
  })();
  return execution.promise;
 }
 scheduleLightReset(){
  clearTimeout(this.resetTimer);
  if(typeof this.driver.resetLights!=='function')return;
  this.resetTimer=setTimeout(()=>{this.call('resetLights').catch(error=>this.emit('error',null,{error:error.message}));},this.settleMs);
  this.resetTimer?.unref?.();
 }
 stopForDraggedInstructions(nodes){
  const dragged=new Set(nodes);let stopped=0;
  for(const run of this.runs)if([...run.active].some(node=>dragged.has(node))){run.controller.abort();stopped++;}
  return stopped;
 }
 async stop(){
  this.messageBlockedUntil=Date.now()+1000;
  const active=[...this.runs];for(const run of active)run.controller.abort();
  for(const action of this.pendingActions)action.abort();
  await Promise.allSettled(active.map(run=>run.promise));
  if(this.touchedMotor){const ports=this.driver.resolvePorts?(this.driver.connected===false?[]:this.driver.resolvePorts(null,null)):[1,2];const results=await Promise.allSettled(ports.map(port=>this.call('brake',port)));const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;}
  this.emit('stopped');this.scheduleLightReset();
 }
 async message(text){
  if(Date.now()<this.messageBlockedUntil)return [];
  if(this.driver.canDeliverMessage&&!this.driver.canDeliverMessage())return [];
  const tasks=[];
  for(const strip of this.strips)for(let i=0;i<strip.length;i++){
   const node=strip[i];if(node.type==='StartOnMessage'&&String(await this.parameter(node.parameter,node))===String(text))tasks.push(this.run(strip,{startIndex:i}));
  }
  return Promise.all(tasks);
 }
 async key(character){
  const tasks=[];for(const strip of this.strips)for(let i=0;i<strip.length;i++)if(strip[i].type==='StartOnKeyPress'&&String(strip[i].key||'A')===String(character))tasks.push(this.run(strip,{startIndex:i}));
  return Promise.all(tasks);
 }
 async parameter(parameter,node){
  if(!parameter)return null;
  switch(parameter.type){
   case 'NumberInput':case 'TextInput':return parameter.value;
   case 'DisplayInput':return this.display.label;
   case 'RandomInput':return String(['DisplayBackground','PlaySound'].includes(node?.type)?Math.floor(this.random()*29):1+Math.floor(this.random()*9));
   case 'TiltSensorNeutral':case 'MotionSensor':case 'SoundSensorInput':{
    const value=await this.call('readSensor',parameter.type,parameter.port??null,...(this.driver.supportsNativePorts?[parameter.nativePort??null]:[]));
    if(!Number.isFinite(Number(value))||value===null||value===undefined)throw Error('El sensor no tiene una lectura válida.');return String(value);
   }
   default:throw Error('Parámetro no compatible: '+parameter.type);
  }
 }
 findInstructionLocation(node,execution){
  const visited=new Set();
  const search=(list,owner=null)=>{
   if(visited.has(list))return null;visited.add(list);
   const index=list.indexOf(node);if(index>=0)return {list,index,owner};
   for(const entry of list){const found=search(entry.children||[],entry);if(found)return found;}
   return null;
  };
  for(const root of [...this.strips,execution?.root||[]]){const found=search(root);if(found)return found;}
  return null;
 }
 async sequence(strip,signal,execution,startIndex=0,containingLoop=null){
  let node=strip[startIndex];
  while(node){
   if(signal.aborted)throw abortError();const started=Date.now();execution?.active.add(node);this.emit('running',node);
   try{
    // Native strip-stop cancels the continuation, not the outstanding motor timer.
    const action=new AbortController();this.pendingActions.add(action);
    const task=this.execute(node,strip.slice(strip.indexOf(node)),action.signal,execution,signal);
    task.finally(()=>this.pendingActions.delete(action)).catch(()=>{});
    const result=await new Promise((resolve,reject)=>{
     const cancel=()=>reject(abortError());
     if(signal.aborted){cancel();return;}
     signal.addEventListener('abort',cancel,{once:true});
     task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
    });
    if(result?.relocated)return result;
    await pause(Math.max(0,this.minBlockMs-(Date.now()-started)),signal);
   }finally{execution?.active.delete(node);this.emit('instruction-ended',node);}
   const location=this.findInstructionLocation(node,execution);
   if(location)strip=location.list;
   const currentIndex=strip.indexOf(node),next=currentIndex<0?null:strip[currentIndex+1];
   if(!next&&containingLoop&&location?.owner!==containingLoop){
    // Native ExecInstruction follows live NextInstruction, then finds the new
    // containing loop through PreviousInstruction instead of returning to the old loop.
    if(location?.owner){
     const destination=this.findInstructionLocation(location.owner,execution);
     execution?.active.delete(containingLoop);
     if(destination)await this.sequence(destination.list,signal,execution,destination.index,destination.owner);
    }
    return {relocated:true};
   }
   node=next;
  }
 }
 firstDirection(forward){
  for(const node of forward){if(['MotorThisWay','MotorThatWay'].includes(node.type))return node.mode==='MotorCounterClockwise'?-1:1;
   if(node.type==='Repeat'){const inner=this.firstDirection(node.children||[]);if(inner!==null)return inner;}}
  return null;
 }
 async motor(node,options){
  this.touchedMotor=true;
  const ports=this.driver.resolvePorts?this.driver.resolvePorts(node.port??null,node.nativePort??null):node.port==null?[1,2]:[node.port];
  for(const port of ports){
   const previous=this.motors.get(port)||{speed:8,direction:-1},state={...previous,...options};this.motors.set(port,state);
   await this.call('motor',port,Math.max(0,state.speed)*10*state.direction);
  }
 }
 async brake(port,nativePort=null){this.touchedMotor=true;const ports=this.driver.resolvePorts?this.driver.resolvePorts(port??null,nativePort):port==null?[1,2]:[port];for(const p of ports)await this.call('brake',p);}
 updateDisplay(changes){Object.assign(this.display,changes);this.onDisplay({...this.display});}
 async execute(node,forward,signal,execution,flowSignal=signal){
  const value=await this.parameter(node.parameter,node);
  switch(node.type){
   case 'Start':case 'StartOnKeyPress':case 'StartOnMessage':return;
   case 'MotorPower':{const speed=integer(value);if(speed!==null){const direction=this.firstDirection(forward);await this.motor(node,{speed,...(direction===null?{}:{direction})});}return;}
   case 'MotorThisWay':case 'MotorThatWay':await this.motor(node,{direction:node.mode==='MotorCounterClockwise'?-1:1});return;
   case 'MotorOnFor':if(float(value)!==null){await this.motor(node,{});await this.wait(node,value,signal);await this.brake(node.port,node.nativePort??null);}return;
   case 'MotorOff':await this.brake(node.port,node.nativePort??null);return;
   case 'Light':{const color=integer(value);if(color!==null){this.touchedLight=true;await this.call('lightIndex',Math.min(color,10),node.port??null,...(this.driver.supportsNativePorts?[node.nativePort??null]:[]));}return;}
   case 'WaitFor':await this.wait(node,value,signal);return;
   case 'Repeat':return this.repeat(node,flowSignal,value,execution);
   case 'Display':this.updateDisplay({label:String(value??''),shown:true});return;
   case 'DisplayBackground':this.updateDisplay({background:String(value??''),shown:true});return;
   case 'DisplayResize':{
    if(!ORIGINAL_DEFINITIONS.DisplayResize.modes.includes(node.mode))throw Error('Modo de pantalla no válido.');
    this.updateDisplay({mode:node.mode,shown:node.mode!=='DisplayHide',...(node.mode==='DisplayHide'?{}:{fullscreen:node.mode==='DisplayLarger'})});return;
   }
   case 'DisplayAdd':{
    const amount=float(value),previous=float(this.display.label);if(amount===null)return;
    let result;
    switch(node.mode){case 'DisplayAdd':result=(previous??0)+amount;break;case 'DisplaySubtract':result=(previous??0)-amount;break;case 'DisplayMultiplication':result=(previous??1)*amount;break;case 'DisplayDivide':result=previous===null?amount:previous/amount;break;default:throw Error('Operación de pantalla no válida.');}
    this.updateDisplay({label:Number.isInteger(result)?String(result):result.toFixed(2),shown:true});return;
   }
   case 'PlaySound':{
    if(value===null||String(value)==='')return;
    const play=this.onSound||this.driver.sound;if(!play)throw Error('Reproducción de sonidos originales no disponible.');
    if(this.onSoundDuration){
     // InstructionInterpreter.PlaySound evaluates the parameter again for WaitForController.
     // In particular RandomInput can choose a different clip for the wait duration.
     await play.call(this.driver,String(value),{signal,wait:false});
     const soundParameter=node.parameter,durationValue=await this.parameter(node.parameter,node),started=Date.now();
     const seconds=Number(await this.onSoundDuration(String(durationValue),{signal}));
     if(!Number.isFinite(seconds)||seconds<0)throw Error('La duración del sonido no es válida.');
     while(node.parameter===soundParameter&&Date.now()-started<seconds*1000)await pause(Math.min(this.pollMs,Math.max(0,seconds*1000-(Date.now()-started))),signal);return;
    }
    await play.call(this.driver,String(value),{signal});return;
   }
   case 'SendMessage':{
    if(value===null||String(value)==='')return;
    if(this.driver.sendMessage)await this.call('sendMessage',String(value));
    this.message(String(value)).catch(error=>this.emit('error',node,{error:error.message}));return;
   }
   default:throw Error('Instrucción no disponible: '+node.type);
  }
 }
 async wait(node,initial,signal){
  const parameter=node.parameter;if(!parameter)return;
  const start=Date.now();
  if(['NumberInput','TextInput','RandomInput'].includes(parameter.type)){
   while(node.parameter===parameter&&(Date.now()-start)/1000<=Math.max(0,float(parameter.type==='RandomInput'?initial:parameter.value)??0))await pause(this.pollMs,signal);
   return;
  }
  const initialNumber=Number(initial);
  while(true){
   if(signal.aborted)throw abortError();
   if(node.parameter!==parameter)return;
   if(parameter.type==='MotionSensor'||parameter.mode==='TiltSensorChange')await pause(this.pollMs,signal);
   const value=Number(await this.parameter(parameter,node));let ready=false;
   if(parameter.type==='DisplayInput')ready=(Date.now()-start)/1000>(float(this.display.label)??0);
   if(parameter.type==='SoundSensorInput')ready=value>=8;
   if(parameter.type==='MotionSensor')ready=distanceMatches(parameter.mode,value,initialNumber);
   if(parameter.type==='TiltSensorNeutral')ready=parameter.mode==='TiltSensorChange'?value!==initialNumber:value===tiltValues[parameter.mode];
   if(ready)return;
   if(parameter.type!=='MotionSensor'&&parameter.mode!=='TiltSensorChange')await pause(this.pollMs,signal);
  }
 }
 async repeat(node,signal,initialValue,execution){
  const children=node.children||[];if(!children.length)return;
  let initial,iterations=0,first=true;
  while(true){
   if(signal.aborted)throw abortError();
   const p=node.parameter;
   if(p){
    const value=first?initialValue:await this.parameter(p,node),n=Number(value);first=false;iterations++;let done;
    if(p.type==='SoundSensorInput')done=n>=8;
    else if(p.type==='TiltSensorNeutral'){
     done=p.mode==='TiltSensorChange'?initial!==undefined&&n!==initial:n===tiltValues[p.mode];initial??=n;
    }else if(p.type==='MotionSensor'&&p.mode!=='DistanceSensorDefault'){
     done=initial!==undefined&&distanceMatches(p.mode,n,initial);initial??=n;
    }else{const count=integer(value);done=count===null||iterations>count;}
    if(done)return;
   }
   const result=await this.sequence(children,signal,execution,0,node);
   if(result?.relocated)return result;
  }
 }
}
