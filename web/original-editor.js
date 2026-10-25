import {createOriginalCanvasControls} from './original-canvas-controls.js';
import {createOriginalLan} from './original-lan.js';
import {createOriginalDisplay} from './original-display.js';
import {resolveOriginalUserAudio,originalUserAudioDuration} from './original-user-audio.js';
import {openOriginalParameterEditor} from './original-parameter-editor.js';
import {duplicateOriginalProject} from './original-projects.js';
import * as microphone from './original-microphone.js';
import {loadOriginalLibrary,saveOriginalLibrary} from './original-storage.js';
import {createOriginalTopbar} from './original-topbar.js';
import {canSnapInstruction,canSnapInsideLoop,canWrapWithLoop,attachmentDistance} from './original-snapping.js';
import {showHardwareAddressing} from './original-addressing.js';
import {showOriginalLobby,captureOriginalProgramPreview} from './original-lobby.js';
import {saveDocumentation,releaseDocumentation} from './original-documentation.js';
import {loadOriginalArt,spriteImage,spriteSize,sprite} from './original-art.js';
import {hubGroup,showConnectionCenter} from './connection.js';
import {OriginalRuntime,createInstruction,createParameter,ORIGINAL_DEFINITIONS,ORIGINAL_PARAMETERS} from './original-runtime.js';

const STORAGE='wedo-original-editor-v2';
const labels={Start:'Inicio',MotorPower:'Potencia del motor',MotorOnFor:'Motor durante',MotorOff:'Parar motor',MotorThisWay:'Motor antihorario',MotorThatWay:'Motor horario',Light:'Luz',PlaySound:'Sonido',Display:'Pantalla',WaitFor:'Esperar',SendMessage:'Enviar mensaje',StartOnMessage:'Al recibir mensaje',StartOnKeyPress:'Al pulsar tecla',DisplayBackground:'Fondo de pantalla',DisplayAdd:'Operación de pantalla',DisplayResize:'Tamaño de pantalla',Repeat:'Repetir',TiltSensorNeutral:'Sensor de inclinación',MotionSensor:'Sensor de movimiento',SoundSensorInput:'Sensor de sonido',NumberInput:'Número',TextInput:'Texto',DisplayInput:'Valor de pantalla',RandomInput:'Número aleatorio',CommentBlock:'Comentario'};
const icons={Start:'Play',MotorPower:'MotorSpeed',MotorOnFor:'MotorTime',MotorOff:'MotorStop',Light:'RGBLight',PlaySound:'Node',Display:'Display',WaitFor:'Hourglass',SendMessage:'Envelope',StartOnMessage:'Mailbox',StartOnKeyPress:'KeyboardKey',DisplayBackground:'DisplayBackground',Repeat:'LoopWithoutParameter'};
const inputs={NumberInput:'ParameterBlueWhite',TextInput:'ParameterBlueWhite',DisplayInput:'ParameterBlue',RandomInput:'ParameterBlue',SoundSensorInput:'ParameterBlue',MotionSensor:'ParameterOrange',TiltSensorNeutral:'ParameterOrange'};
const parameterIcons={DisplayInput:'DisplayInput',RandomInput:'Dice',SoundSensorInput:'SoundSensor'};
const tabRoutes={library:'/library',models:'/models',docs:'/documentation',help:'/help'};
let canvasControls,displayController,cameraPanel,webViewSize='Full',topbar,art,root,stage,canvas,palette,toast,display,runtime,doc,library,storageBlocked=false,currentKey,activityKey,selected=null,scale=1,zoom=1,pan={x:0,y:0},drag=null;
const activeStarts=new Set(),playingSounds=new Set(),zoomLevels=[.5,.75,1,1.5,2];
let lastCanvasCenter,cameraAnimation,canvasPanning=false,zoomTarget=1,lan,lanProject;
const uid=()=>crypto.randomUUID();
const el=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
const walk=(nodes,fn)=>nodes.forEach(n=>{fn(n);if(n.children)walk(n.children,fn);});
function notify(message){toast.textContent=message;toast.hidden=!message;}
function makeDocument(name=(art?.activeTranslations||art?.translations?.ES)?.LobbyDefaultProjectName||'Proyecto'){return{id:uid(),name,coordinateOrigin:innerWidth/(innerHeight/768)/2,strips:[{id:uid(),x:innerWidth/(innerHeight/768)/2,y:320,nodes:[createInstruction('Start')]}],detachedParameters:[],comments:[],notes:''};}
async function loadLibrary(){
 try{library=await loadOriginalLibrary(STORAGE);}
 catch{library={projects:{}};storageBlocked=true;}
}
function persist(){
 if(storageBlocked){notify('No se sobrescribe el almacenamiento que no se pudo leer. Exporta tu proyecto.');return Promise.resolve();}
 library.projects[currentKey]=doc;library.activeKey=currentKey;
 return saveOriginalLibrary(library).catch(error=>notify(error.message+'. Exporta una copia antes de cerrar.'));
}
function register(){runtime.registerStrips(doc.strips.map(s=>s.nodes));if(lanProject!==doc.id){lan?.close();lanProject=doc.id;lan=createOriginalLan({projectId:doc.id,deliverLocal:false,onMessage:message=>runtime.message(message).catch(error=>{if(error.name!=='AbortError')notify(error.message);})});}}
function change(){persist();register();renderCanvas();}
function highlightBlock(block,active){
 if(!block)return;block.classList.toggle('executing',active);
 const node=findNode(block.dataset.node)?.node;if(!node)return;
 const base=node.type==='Repeat'?(node.parameter?'LoopWithPar':'LoopWithoutPar'):nodeLook(node).background;
 const image=sprite(art,base+(active?'HighLight':''))||sprite(art,base);
 const shell=block.querySelector(':scope > .original-loop-shell');if(shell)shell.style.borderImageSource=`url("${image.url}")`;else{const background=block.querySelector(':scope > .original-background');if(background)background.src=image.url;}
}
function state(event){
 canvasControls?.setRunning(!!event.activeRuns);
 if(event.instructionId){const block=canvas.querySelector(`[data-node="${CSS.escape(event.instructionId)}"]`);highlightBlock(block,event.status==='running');}
 if(event.status==='error')notify(event.error?.message||String(event.error||'No se pudo ejecutar el bloque.'));
 if((event.status==='completed'||event.status==='stopped')&&!event.activeRuns){canvas.querySelectorAll('.executing').forEach(e=>highlightBlock(e,false));}
}
async function soundDuration(id){return /^@?[A-Z]$/.test(id)?originalUserAudioDuration(doc,id):art.sounds?.[String(id)]?.duration||0;}
async function sound(id,{signal,wait=true}={}){
 let url,temporary=false;
 if(/^@?[A-Z]$/.test(id)){const clip=await resolveOriginalUserAudio(doc,id);url=URL.createObjectURL(clip.blob);temporary=true;}
 else{const entry=art.sounds?.[String(id)];if(!entry)return;url=typeof entry==='string'?entry:entry.url;}
 const audio=new Audio(url),cleanup=()=>{playingSounds.delete(audio);signal?.removeEventListener('abort',cancel);if(temporary)URL.revokeObjectURL(url);};
 playingSounds.add(audio);let cancel;
 await new Promise((resolve,reject)=>{
  cancel=()=>{audio.pause();cleanup();reject(new DOMException('Detenido','AbortError'));};
  audio.onended=()=>{cleanup();resolve();};audio.onerror=()=>{cleanup();reject(Error('No se pudo reproducir el sonido.'));};
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}audio.play().then(()=>{if(!wait)resolve();}).catch(error=>{cleanup();reject(error);});
 });
}
function showDisplay(value){displayController.update(value);}
async function execute(nodes,startIndex=0){
 if(!nodes[startIndex]||activeStarts.has(nodes[startIndex].id))return;const start=nodes[startIndex].id;activeStarts.add(start);
 notify('');try{await microphone.prepareForProgram(doc.strips.flatMap(strip=>strip.nodes));if(nodes[startIndex].type==='Start')runtime.updateDisplay({label:''});await runtime.run(nodes,{startIndex});}catch(error){if(error.name!=='AbortError')notify(error.message);}finally{activeStarts.delete(start);}
}
async function stopPrograms(){lan?.executionStopped();try{await runtime.stop();}finally{microphone.stop();for(const audio of playingSounds){audio.pause();audio.onended?.();}playingSounds.clear();}}
async function executeKey(key){if(!doc.strips.some(strip=>strip.nodes.some(node=>node.type==='StartOnKeyPress'&&node.key===key)))return;try{await microphone.prepareForProgram(doc.strips.flatMap(strip=>strip.nodes));await runtime.key(key);}catch(error){if(error.name!=='AbortError')notify(error.message);}}
function button(name,icon,action,cls=''){
 const b=el('button',cls);b.type='button';b.title=name;b.setAttribute('aria-label',name);b.append(spriteImage(art,icon));b.onclick=action;return b;
}
function resize(){
 scale=innerHeight/768;const center=innerWidth/scale/2;if(lastCanvasCenter!==undefined)pan.x+=(center-lastCanvasCenter)*(1-zoom);lastCanvasCenter=center;stage.style.width=(innerWidth/scale)+'px';stage.style.height='768px';stage.style.transform=`scale(${scale})`;applyWebViewSize();if(displayController&&runtime)displayController.update(runtime.display);if(canvas)updateCamera();
}
function cameraOffset(){return{x:pan.x+(innerWidth/scale/2-(doc?.coordinateOrigin??innerWidth/scale/2))*zoom,y:pan.y};}
function world(event){const r=canvas.getBoundingClientRect(),offset=cameraOffset();return{x:((event.clientX-r.left)/scale-offset.x)/zoom,y:((event.clientY-r.top)/scale-offset.y)/zoom};}
function stepZoom(direction){const index=zoomLevels.indexOf(zoomTarget);setZoom(zoomLevels[Math.max(0,Math.min(4,index+direction))]);}
function setZoom(next,centerView=false){
 const center={x:innerWidth/scale/2,y:323};zoomTarget=next;doc.zoomLevel=next;persist();
 const transition={next,pan:centerView?{x:0,y:0}:{x:center.x-(center.x-pan.x)*next/zoom,y:center.y-(center.y-pan.y)*next/zoom},progress:0,last:performance.now()};cameraAnimation=transition;
 const frame=now=>{if(cameraAnimation!==transition)return;const elapsed=(now-transition.last)/1000;transition.last=now;
  if(!canvasPanning){transition.progress=Math.min(1,transition.progress+elapsed*7.5);zoom+=(next-zoom)*transition.progress;pan.x+=(transition.pan.x-pan.x)*transition.progress;pan.y+=(transition.pan.y-pan.y)*transition.progress;updateCamera();}
  if(transition.progress<1)requestAnimationFrame(frame);else cameraAnimation=null;
 };requestAnimationFrame(frame);canvasControls?.setZoom?.(zoomTarget);
}
function restoreCamera(){cameraAnimation=null;zoom=zoomTarget=zoomLevels.includes(doc.zoomLevel)?doc.zoomLevel:1;pan={x:innerWidth/scale/2*(1-zoom),y:323*(1-zoom)};}
function updateCamera(){const offset=cameraOffset();canvas.querySelector('.original-world').style.transform=`translate(${offset.x}px,${offset.y}px) scale(${zoom})`;canvasControls?.setZoom?.(zoomTarget);}
function nodeLook(node){
 const param=!!node.parameter||['MotorPower','MotorOnFor','Light','PlaySound','Display','WaitFor','SendMessage','StartOnMessage','DisplayBackground','DisplayAdd'].includes(node.type);
 const prefix=node.type.startsWith('Start')?'Start':['MotorPower','MotorOnFor','MotorOff','MotorThisWay','MotorThatWay','Light'].includes(node.type)?'BlockGreen':['PlaySound','Display','DisplayBackground','DisplayAdd','DisplayResize'].includes(node.type)?'BlockRed':'BlockYellow';
 return {background:prefix+(param?'WithPar':'WithoutPar'),icon:node.mode||icons[node.type],param};
}
function parameterView(parameter,owner){
 const item=el('div','original-parameter');item.dataset.parameter=owner?.id||parameter.id||'';
 const name=inputs[parameter.type]||'ParameterBlue';const size=spriteSize(art,name);item.style.width=size.width+'px';item.style.height=size.height+'px';item.append(spriteImage(art,name,'original-background'));
 const isValue=['NumberInput','TextInput'].includes(parameter.type);
 if(isValue){const input=el('input');input.type='text';input.value=String(parameter.value??'');input.setAttribute('aria-label',labels[parameter.type]);input.onchange=()=>{parameter.value=input.value;persist();register();};input.oninput=input.onchange;input.onclick=event=>{event.stopPropagation();openOriginalParameterEditor({parameter,owner,anchor:item,catalog:art,project:doc,onSave:persist,onChange:()=>{input.value=parameter.value;persist();register();}});};item.append(input);}
 else{item.append(spriteImage(art,parameter.mode||parameterIcons[parameter.type],'original-icon'));item.onclick=event=>{event.stopPropagation();const modes=ORIGINAL_PARAMETERS[parameter.type]?.modes;if(modes?.length){parameter.mode=modes[(modes.indexOf(parameter.mode)+1)%modes.length];change();}};}
 showHardwareAddressing({node:parameter,anchor:item,catalog:art,activate:false,onChange:()=>{persist();register();}});
 if(owner)item.addEventListener('pointerdown',event=>beginDrag(event,{kind:'attached',owner,parameter},item));
 item.title=labels[parameter.type]||parameter.type;
 return item;
}
function blockView(node,list,index,strip){
 const block=el('div','original-block');block.dataset.node=node.id;block.tabIndex=0;block.setAttribute('role','button');block.setAttribute('aria-label',labels[node.type]||node.type);
 if(node.type==='Repeat'){
  block.classList.add('original-loop');
  const background=sprite(art,node.parameter?'LoopWithPar':'LoopWithoutPar');const shell=el('span','original-loop-shell');shell.style.borderImageSource=`url("${background.url}")`;block.append(shell);
  const loopIcon=spriteImage(art,'LoopWithoutParameter','original-loop-icon');block.append(loopIcon);
  const inside=el('div','original-loop-inner');inside.dataset.loop=node.id;
  (node.children||=[]).forEach((child,i)=>inside.append(blockView(child,node.children,i,strip)));block.append(inside);
  const widths=node.children.map(child=>child.type==='Repeat'?211.25:spriteSize(art,nodeLook(child).background).width);const width=211.25+(widths.length?widths.slice(1).reduce((a,b)=>a+b,0):0);block.style.width=width+'px';block.style.height='138px';shell.style.width=(width+15)+'px';loopIcon.style.right='10px';
  if(node.parameter){const parameter=parameterView(node.parameter,node);parameter.style.left=(width-91)+'px';parameter.style.top=(119.5-spriteSize(art,inputs[node.parameter.type]||'ParameterBlue').height*.15)+'px';block.append(parameter);}
 }else{
  const look=nodeLook(node),size=spriteSize(art,look.background);block.style.width=size.width+'px';block.style.height=size.height+'px';block.append(spriteImage(art,look.background,'original-background'),spriteImage(art,look.icon,'original-icon'));
  if(node.parameter){const parameter=parameterView(node.parameter,node);parameter.style.top=(size.height-18-spriteSize(art,inputs[node.parameter.type]||'ParameterBlue').height*.15)+'px';block.append(parameter);}
  if(node.type==='StartOnKeyPress'){const input=el('input','original-key');input.maxLength=1;input.value=node.key||'A';input.setAttribute('aria-label','Tecla de inicio');input.onchange=()=>{node.key=input.value||'A';persist();register();};block.append(input);}
 }
 showHardwareAddressing({node,anchor:block,catalog:art,activate:false,onChange:()=>{persist();register();}});
 block.addEventListener('pointerdown',event=>beginDrag(event,{kind:'node',node,list,index,strip},block));
 block.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();showHardwareAddressing({node,anchor:block,catalog:art,onChange:()=>{persist();register();}});};
 block.onkeydown=event=>{event.stopPropagation();if(event.target.tagName==='INPUT')return;if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();runtime.stopForDraggedInstructions([node]);list.splice(index,1);doc.strips=doc.strips.filter(s=>s.nodes.length);change();}if(event.key==='Enter')block.click();};
 block.onclick=event=>{
  event.stopPropagation();
  if(drag?.moved||drag?.held||event.target.closest('input,.original-parameter'))return;
  selected=node.id;
  if(node.type==='Start')execute(list,index);
  else if(node.type==='StartOnKeyPress')executeKey(node.key||'A');
  else{const modes=ORIGINAL_DEFINITIONS[node.type]?.modes;if(modes?.length){node.mode=modes[(modes.indexOf(node.mode)+1)%modes.length];change();}}
 };
 return block;
}
const instructionHeight=node=>node.type==='Repeat'?138:spriteSize(art,nodeLook(node).background).height;
const stripLift=nodes=>nodes.length?Math.max(...nodes.map(instructionHeight))-instructionHeight(nodes[0]):0;
function renderCanvas(){
 const plane=canvas.querySelector('.original-world');plane.replaceChildren();
 for(const strip of doc.strips){const row=el('div','original-strip');row.style.left=strip.x+'px';row.style.top=(strip.y-stripLift(strip.nodes))+'px';row.dataset.strip=strip.id;strip.nodes.forEach((n,i)=>row.append(blockView(n,strip.nodes,i,strip)));plane.append(row);}
 for(const p of doc.detachedParameters||[]){const item=parameterView(p.parameter);item.style.position='absolute';item.style.left=p.x+'px';item.style.top=p.y+'px';item.addEventListener('pointerdown',event=>beginDrag(event,{kind:'detached',entry:p},item));plane.append(item);}
 for(const comment of doc.comments||[])plane.append(commentView(comment));
 updateCamera();
}
function commentView(comment){
  const note=el('div','original-comment');note.style.left=comment.x+'px';note.style.top=comment.y+'px';
  const shell=el('span','original-comment-shell');shell.style.borderImageSource=`url("${sprite(art,'BubbleComment').url}")`;note.append(shell);
  const field=el('textarea');field.value=comment.text||'';field.maxLength=140;field.setAttribute('aria-label','Comentario');
  const fit=()=>{field.style.height='auto';field.style.height=Math.max(60,field.scrollHeight)+'px';};
  field.oninput=()=>{comment.text=field.value;fit();persist();};field.onclick=()=>openOriginalParameterEditor({parameter:{type:'TextInput'},owner:{type:'CommentBlock'},anchor:note,catalog:art});note.append(field);
  note.addEventListener('pointerdown',event=>beginDrag(event,{kind:'existing-comment',comment},note));requestAnimationFrame(fit);return note;
}
function findNode(id){let result;for(const s of doc.strips){const visit=list=>list.forEach((n,i)=>{if(n.id===id)result={node:n,list,index:i,strip:s};if(n.children)visit(n.children);});visit(s.nodes);}return result;}
function descendants(node){const ids=new Set([node.id]);walk(node.children||[],n=>ids.add(n.id));return ids;}
function makeDragView(d){
 const source=d.source,view=el('div','original-dragging');view.style.display='flex';view.style.width='max-content';
 const append=original=>{const copy=original.cloneNode(true);copy.style.visibility='visible';copy.style.pointerEvents='none';copy.style.position='relative';copy.style.left='0';copy.style.top='0';view.append(copy);};
 if(source.kind==='node'){
  const tail=source.list.slice(source.index);runtime.stopForDraggedInstructions(tail);
  d.offset.y+=stripLift(tail);
  d.hidden=tail.map(node=>canvas.querySelector(`[data-node="${CSS.escape(node.id)}"]`)).filter(Boolean);d.hidden.forEach(append);d.hidden.forEach(node=>{node.style.visibility='hidden';});
  d.moving=source.list.splice(source.index);d.detached=true;
 }else if(source.kind==='palette'){
  d.created=createInstruction(source.type);append(blockView(d.created,[d.created],0,null));
  d.offset={x:51.2/zoom,y:51.2/zoom+(source.type==='Repeat'?138*(1-.783):0)};
 }else if(source.kind==='parameter'){
  d.createdParameter=createParameter(source.type);const size=spriteSize(art,inputs[source.type]||'ParameterBlue');append(parameterView(d.createdParameter));d.offset={x:size.width/2,y:25.6/zoom+size.height*.15};
 }else if(source.kind==='comment'){
  d.createdComment={id:uid(),x:0,y:0,text:''};append(commentView(d.createdComment));d.offset={x:102.4/zoom,y:100-51.2/zoom};
 }else{
  append(d.element);d.hidden=[d.element];d.element.style.visibility='hidden';
  if(source.kind==='attached'){source.owner.parameter=null;d.detachedParameter=true;}
 }
 for(const img of view.querySelectorAll('img[data-sprite]')){const lifted=sprite(art,img.dataset.sprite+'Liftup');if(lifted)img.src=lifted.url;}
 for(const shell of view.querySelectorAll('.original-loop-shell')){const owner=shell.parentElement;const lifted=sprite(art,(owner.querySelector(':scope > .original-parameter')?'LoopWithPar':'LoopWithoutPar')+'Liftup');if(lifted)shell.style.borderImageSource=`url("${lifted.url}")`;}
 for(const shell of view.querySelectorAll('.original-comment-shell')){const lifted=sprite(art,'BubbleCommentLiftup');if(lifted)shell.style.borderImageSource=`url("${lifted.url}")`;}
 for(const node of view.querySelectorAll('[data-node]'))node.removeAttribute('data-node');
 view.style.cssText+=`;position:fixed;left:0;top:0;transform:scale(${scale*zoom});transform-origin:top left;z-index:4000;pointer-events:none;`;
 document.body.append(view);return view;
}
function updateSnapTarget(d,event){
 document.querySelectorAll('.original-snap-target').forEach(x=>x.classList.remove('original-snap-target'));
 d.target=null;d.snapSide=null;
 const hit=document.elementFromPoint(event.clientX,event.clientY);
 if(hit?.closest('.original-palette'))return;
 const source=d.source,moving=d.moving||(d.created?[d.created]:null);
 if(!moving){
  if(['attached','detached','parameter'].includes(source.kind))d.target=hit?.closest('.original-block')||null;
 }else{
  const bounds=d.ghost.getBoundingClientRect();let best=Infinity;
  for(const element of canvas.querySelectorAll('.original-block')){
   if(getComputedStyle(element).visibility==='hidden')continue;
   const target=findNode(element.dataset.node);if(!target)continue;
   const rect=element.getBoundingClientRect(),index=target.list.indexOf(target.node);
   const context={target:target.node,incoming:moving,targetPrevious:target.list[index-1],targetNext:target.list[index+1],targetInsideLoop:target.list!==target.strip.nodes};
   for(const side of ['after','before']){
    if(!canSnapInstruction({...context,side}))continue;
    const distance=attachmentDistance(bounds,rect,side,scale*zoom);
    if(distance<best){best=distance;d.target=element;d.snapSide=side;}
   }
   // Preserve explicit loop insertion/wrapping, independently of side snapping.
   if(hit?.closest('.original-block')===element){
    if(target.node.type==='Repeat'&&event.clientY>rect.top+20*scale*zoom&&canSnapInsideLoop({target:target.node,incoming:moving})){d.target=element;d.snapSide='inside';best=-1;}
    else if(moving.length===1&&canWrapWithLoop({...context,incomingLoop:moving[0],rightAdjacent:target.list.slice(index+1)})&&event.clientX>rect.left+rect.width*.25&&event.clientX<rect.right-rect.width*.25){d.target=element;d.snapSide='around';best=-1;}
   }
  }
  if(d.target&&['before','after'].includes(d.snapSide)){
   const rect=d.target.getBoundingClientRect();
   d.snapWidth=bounds.width/(scale*zoom);
   d.ghost.style.left=(d.snapSide==='after'?rect.right:rect.left-bounds.width)+'px';d.ghost.style.top=(rect.bottom-bounds.height)+'px';
  }
 }
 d.target?.classList.add('original-snap-target');
}
function beginDrag(event,source,element){
 if(event.button!==0||event.target.closest('input,textarea'))return;
 event.preventDefault();event.stopPropagation();element.setPointerCapture(event.pointerId);
 const point=world(event),box=element.getBoundingClientRect();let offset={x:(event.clientX-box.left)/(scale*zoom),y:(event.clientY-box.top)/(scale*zoom)};if(source.kind==='palette'){const n=createInstruction(source.type),size=n.type==='Repeat'?{width:226.25,height:138}:spriteSize(art,nodeLook(n).background);offset={x:(event.clientX-box.left)/box.width*size.width,y:(event.clientY-box.top)/box.height*size.height};}drag={source,offset,moved:false,start:point,screen:{x:event.clientX,y:event.clientY},element,ghost:null,target:null};
 drag.fromPalette=['palette','parameter','comment'].includes(source.kind);drag.paletteScroll=palette.scrollLeft;
 const hold=setTimeout(()=>{if(!drag||drag.moved||drag.scrolled)return;const node=source.node||source.parameter||source.entry?.parameter;if(node){showHardwareAddressing({node,anchor:element,catalog:art,onChange:()=>{persist();register();}});drag.held=true;}},1001);
 const move=e=>{
  if(!drag)return;const d=drag;if(!d.moved&&Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)<5)return;
  if(!d.moved&&d.fromPalette){const bar=palette.getBoundingClientRect();if(e.clientY>=bar.top&&e.clientY<=bar.bottom&&e.clientX>=bar.left&&e.clientX<=bar.right){clearTimeout(hold);d.scrolled=true;palette.scrollLeft=d.paletteScroll-(e.clientX-d.screen.x)/scale;return;}}
  if(!d.moved){clearTimeout(hold);d.moved=true;d.ghost=makeDragView(d);}
  d.ghost.style.left=(e.clientX-d.offset.x*scale*zoom)+'px';d.ghost.style.top=(e.clientY-d.offset.y*scale*zoom)+'px';
  d.ghost.style.opacity=document.elementFromPoint(e.clientX,e.clientY)?.closest('.original-palette')?'.7':'1';
  updateSnapTarget(d,e);
 };
 const up=e=>{
  clearTimeout(hold);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',up);
  const d=drag;if(!d)return;if(d.moved&&d.ghost){d.ghost.style.left=(e.clientX-d.offset.x*scale*zoom)+'px';d.ghost.style.top=(e.clientY-d.offset.y*scale*zoom)+'px';updateSnapTarget(d,e);}d.ghost?.remove();d.hidden?.forEach(node=>{node.style.visibility='';});document.querySelectorAll('.original-snap-target').forEach(x=>x.classList.remove('original-snap-target'));
  const hit=document.elementFromPoint(e.clientX,e.clientY),valid=e.type!=='pointercancel'&&hit?.closest('.original-canvas,.original-palette');
  if(d.moved&&valid)drop(d,world(e),e);
  else if(d.moved){if(d.detached)source.list.splice(source.index,0,...d.moving);if(d.detachedParameter)source.owner.parameter=source.parameter;change();}
  setTimeout(()=>{if(drag===d)drag=null;},0);
 };
 element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',up);
}
function drop(d,point,event){
 const source=d.source,hit=document.elementFromPoint(event.clientX,event.clientY);
 if(hit?.closest('.original-palette')){
  if(source.kind==='node'){if(!d.detached)source.list.splice(source.index);doc.strips=doc.strips.filter(s=>s.nodes.length);change();}
  if(source.kind==='existing-comment'){doc.comments=doc.comments.filter(c=>c!==source.comment);change();}
  if(source.kind==='attached'){source.owner.parameter=null;change();}
  if(source.kind==='detached'){doc.detachedParameters=doc.detachedParameters.filter(p=>p!==source.entry);change();}return;
 }
 if(!hit?.closest('.original-canvas'))return;
 const target=d.target?findNode(d.target.dataset.node):null;
 if(source.kind==='parameter'||source.kind==='detached'||source.kind==='attached'){
  const parameter=source.kind==='attached'?source.parameter:source.kind==='detached'?source.entry.parameter:d.createdParameter||createParameter(source.type);
  if(source.kind==='attached')source.owner.parameter=null;
  if(target&&ORIGINAL_DEFINITIONS[target.node.type]?.parameterType){if(target.node.parameter&&target.node.parameter!==parameter)(doc.detachedParameters||=[]).push({id:uid(),x:point.x,y:point.y+80,parameter:target.node.parameter});target.node.parameter=parameter;}else (doc.detachedParameters||=[]).push({id:uid(),x:point.x-d.offset.x,y:point.y-d.offset.y,parameter});
  if(source.kind==='detached')doc.detachedParameters=doc.detachedParameters.filter(p=>p!==source.entry);
  change();return;
 }
 if(source.kind==='existing-comment'){source.comment.x=point.x-d.offset.x;source.comment.y=point.y-d.offset.y;change();return;}
 if(source.kind==='comment'){doc.comments.push({...d.createdComment,x:point.x-d.offset.x,y:point.y-d.offset.y});change();return;}
 let moving;
 if(source.kind==='palette')moving=[d.created||createInstruction(source.type)];
 else moving=d.moving||source.list.splice(source.index);
 let joined=false;
 if(target&&!moving.some(n=>descendants(n).has(target.node.id))){
  const rect=d.target.getBoundingClientRect(),index=target.list.indexOf(target.node);
  const targetInsideLoop=target.list!==target.strip.nodes;
  const context={target:target.node,incoming:moving,targetPrevious:target.list[index-1],targetNext:target.list[index+1],targetInsideLoop};
  if(d.snapSide==='around'&&moving.length===1&&canWrapWithLoop({...context,incomingLoop:moving[0],rightAdjacent:target.list.slice(index+1)})){
   if(index===0&&!targetInsideLoop)target.strip.y+=instructionHeight(target.node)-instructionHeight(moving[0]);
   moving[0].children=target.list.splice(index);target.list.push(moving[0]);joined=true;
  }else if(d.snapSide==='inside'&&canSnapInsideLoop({target:target.node,incoming:moving})){
   target.node.children.unshift(...moving);joined=true;
  }else{
   const before=d.snapSide==='before';
   if(canSnapInstruction({...context,side:before?'before':'after'})){if(before&&!targetInsideLoop){target.strip.x-=d.snapWidth;target.strip.y+=instructionHeight(target.node)-instructionHeight(moving[0]);}target.list.splice(index+(before?0:1),0,...moving);joined=true;}
  }
 }
 if(!joined)doc.strips.push({id:uid(),x:point.x-d.offset.x,y:point.y-d.offset.y+stripLift(moving),nodes:moving});

 doc.strips=doc.strips.filter(s=>s.nodes.length);change();
}
function buildPalette(){
 palette.replaceChildren();
 for(const entry of art.palette){const type=entry.type,b=el('button','original-palette-block');b.type='button';b.setAttribute('aria-label','Añadir '+(labels[type]||type));b.title=labels[type]||type;b.dataset.type=type;
  const background=sprite(art,entry.background);b.style.width=(ORIGINAL_PARAMETERS[type]?80:background?80*background.width/background.height:80)+'px';b.append(spriteImage(art,entry.background,'original-background'));if(entry.icon)b.append(spriteImage(art,entry.icon,'original-palette-icon'));if(entry.text){const text=el('span');text.textContent=entry.text;b.append(text);}
  const kind=type==='CommentBlock'?'comment':ORIGINAL_PARAMETERS[type]?'parameter':'palette';
  b.addEventListener('pointerdown',event=>beginDrag(event,{kind,type},b));
  palette.append(b);
 }
}
export async function showProjects(){return projects();}
async function projects(save=true){
 await stopPrograms();if(save){saveDocumentation(window);const preview=await captureOriginalProgramPreview(canvas);if(preview)doc.previewUrl=preview;await persist();}
 const open=async key=>{releaseDocumentation(window);currentKey=key;doc=library.projects[key];doc.lastOpenDate=new Date().toISOString();restoreCamera();persist();register();renderCanvas();showCanvas();};
 const fresh=()=>{releaseDocumentation(window);currentKey=uid();doc=makeDocument();doc.lastOpenDate=new Date().toISOString();restoreCamera();change();showCanvas();};
 let lobby;
 lobby=showOriginalLobby({catalog:art,projects:library.projects,currentId:currentKey,
  onOpen:open,
  onCreate:fresh,
  onRename:(key,name)=>{library.projects[key].name=name;persist();},
  onDelete:key=>{if(currentKey===key)releaseDocumentation(window);delete library.projects[key];if(currentKey===key){currentKey=uid();doc=makeDocument();register();renderCanvas();}persist();},
  onDuplicate:key=>{const copy=duplicateOriginalProject(library.projects[key],uid());copy.name+=' (2)';library.projects[copy.id]=copy;persist();lobby.refresh(library.projects);},
  onImport:importProject,
  onExport:key=>exportProject(true,library.projects[key]),
  onSettings:async()=>{const {showOriginalSettings}=await import('/original-settings.js');return showOriginalSettings({catalog:art,
   onIntroduction:async()=>{const {showOriginalIntroduction}=await import('/original-teacher-resources.js');return showOriginalIntroduction({catalog:art});},
   onLanguage:async code=>{art.activeTranslations=art.translations[code]||art.translations.ES;localStorage.setItem('wedo-language',code);window.unityEmitMessage?.('LanguageChange',code);},
   onDeleteAll:async()=>{releaseDocumentation(window);library.projects={};delete library.activeKey;await saveOriginalLibrary(library);currentKey=uid();doc=makeDocument();restoreCamera();register();renderCanvas();lobby.refresh(library.projects);},
   onClose:()=>{lobby.close();projects(false);}
  });},
  onTeacher:async()=>{const {showOriginalTeacherResources}=await import('/original-teacher-resources.js');return showOriginalTeacherResources({catalog:art});},
  onActivities:()=>{fresh();return originalPage('/library');},
  onTutorial:()=>{fresh();return originalPage('/library/project/50073bec-7b47-4014-b7f3-1c6fd174c113');}
 });
}
const toCanvasPosition=({x,y})=>({x:x+innerWidth/(innerHeight/768)/2,y:323-y});
async function exportProject(bundle=false,project=doc){
 const convert=({x,y})=>({x:x-(project.coordinateOrigin??innerWidth/(innerHeight/768)/2),y:323-y});
 try{let blob;if(bundle===true){const module=await import('/original-bundle.js');blob=await module.exportOriginalBundle(project,{fromCanvasPosition:convert});}else{const module=await import('/original-projects.js');blob=new Blob([module.serializeOriginalProject(project,{fromCanvasPosition:convert})],{type:'application/json'});}const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=(project.name||'proyecto')+(bundle===true?'.wedo':'.proj');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){notify('No se pudo exportar: '+error.message);}
}
async function importProject(file){if(!file)return;if(file.size>100*1024*1024)throw Error('El proyecto es demasiado grande.');let imported;if(file.name.toLowerCase().endsWith('.wedo')){const module=await import('/original-bundle.js');imported=await module.importOriginalBundle(file,{toCanvasPosition});}else{const module=await import('/original-projects.js');imported=module.parseOriginalProject(await file.text(),{toCanvasPosition});}await stopPrograms();releaseDocumentation(window);await persist();currentKey=uid();doc=imported;doc.coordinateOrigin=innerWidth/(innerHeight/768)/2;restoreCamera();change();showCanvas();}
export function updateOriginalButtonState(query){const params=new URLSearchParams(query);for(const [key,value]of params){const button=topbar?.element.querySelector('[data-action="'+CSS.escape(value)+'"]');if(button)button.disabled=key==='DisableButton';}}
export function setWebViewSize(size){if(['Full','Half','Quarter'].includes(size))webViewSize=size;applyWebViewSize();}
function applyWebViewSize(){
 if(!root)return;const height={Full:707,Half:260,Quarter:427}[webViewSize];root.classList.toggle('split-content',webViewSize!=='Full');root.style.setProperty('--webview-edge',(61+height)+'px');
 document.body.style.setProperty('--webview-top',Math.ceil(innerHeight*61/768)+'px');document.body.style.setProperty('--webview-height',Math.floor(innerHeight*height/768)+'px');
}
function rememberTab(){if(root?.dataset.contentGroup)tabRoutes[root.dataset.contentGroup]=location.hash.slice(1);}
function showCanvas(){rememberTab();root.hidden=false;root.classList.remove('showing-content');document.body.classList.remove('wedo-content-open');delete root.dataset.contentGroup;topbar.setSelected(null);}
async function originalPage(route){rememberTab();saveDocumentation(window);persist();root.hidden=false;root.classList.add('showing-content');document.body.classList.add('wedo-content-open');setWebViewSize('Full');if(location.hash==='#'+route&&route==='/documentation'){const injector=window.angular.element(document.documentElement).injector();injector.get('$rootScope').$evalAsync(()=>injector.get('$route').reload());}else location.hash=route;const group=route.startsWith('/library')?'library':route==='/documentation'?'docs':route==='/help'?'help':'models';root.dataset.contentGroup=group;topbar.setSelected(group);topbar.setDocsLocked(!!doc.native?.SDTLockedState);}
async function topbarSelect(group){
 try{if(group!=='camera'){cameraPanel?.close();cameraPanel=null;}if(group==='home')return projects();if(!group){saveDocumentation(window);showCanvas();return;}if(group==='camera'){showCanvas();topbar.setSelected('camera');return topbarAction('camera-photo');}return originalPage(tabRoutes[group]);}catch(error){notify(error.message);}
}
async function topbarAction(action){
 try{
  if(action==='library-root')return originalPage('/library');
  if(action.startsWith('models-')){topbar.setModelMode(action);return originalPage(action==='models-program'?'/programs':'/models');}
  if(action.startsWith('camera-')){const {runCameraAction}=await import('/original-camera.js');return cameraPanel=await runCameraAction(action,{project:doc,onSave:persist,captureCanvas:()=>captureOriginalProgramPreview(canvas,{width:Math.round(canvas.getBoundingClientRect().width),height:Math.round(canvas.getBoundingClientRect().height),preserveViewport:true})});}
  if(action==='lock'||action==='unlock'){doc.native??={};doc.native.SDTLockedState=action==='lock';persist();}
  window.unityEmitMessage?.(action);
 }catch(error){notify(error.message);}
}
export function getCurrentProject(){return doc;}
export function saveCurrentProject(){persist();}
async function init(){
 art=await loadOriginalArt();await loadLibrary();root=el('section','wedo-original-editor');root.hidden=true;root.setAttribute('aria-label','Programación WeDo');stage=el('div','original-stage');root.append(stage);document.body.append(root);
 topbar=createOriginalTopbar({catalog:art,onSelect:topbarSelect,onAction:topbarAction});stage.append(topbar.element);
 const connect=button('Conectar hub',art.ui.hub.open,showConnectionCenter,'original-hub-button');const bt=spriteImage(art,hubGroup.connected?art.ui.hub.connected:art.ui.hub.disconnected,'original-hub-state');connect.append(bt);stage.append(connect);
 canvasControls=createOriginalCanvasControls({catalog:art,onZoomIn:()=>stepZoom(1),onZoomOut:()=>stepZoom(-1),onFit:()=>setZoom(1,true),onStop:()=>stopPrograms().catch(error=>notify(error.message))});stage.append(canvasControls.element);
 window.addEventListener('wedo-connection-change',()=>{bt.src=sprite(art,hubGroup.connected?art.ui.hub.connected:art.ui.hub.disconnected).url;});
 canvas=el('div','original-canvas');const plane=el('div','original-world');canvas.append(plane);stage.append(canvas);
 palette=el('nav','original-palette');palette.setAttribute('aria-label','Bloques de programación');stage.append(palette);
 toast=el('p','original-status');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;stage.append(toast);
 displayController=createOriginalDisplay({catalog:art,onModeChange:mode=>runtime.updateDisplay({mode,shown:mode!=='DisplayHide',fullscreen:mode==='DisplayLarger'})});display=displayController.element;stage.append(display);
 const readHardwareSensor=hubGroup.readSensor.bind(hubGroup);hubGroup.readSensor=(type,...args)=>type==='SoundSensorInput'?microphone.readLevel():readHardwareSensor(type,...args);
 runtime=new OriginalRuntime({driver:hubGroup,onState:state,onDisplay:showDisplay,onSound:sound,onSoundDuration:soundDuration});
 hubGroup.sendMessage=message=>{lan?.send(message).catch(error=>notify(error.message));};
 hubGroup.canDeliverMessage=()=>lan?.canDeliver??true;
 window.addEventListener('pagehide',()=>lan?.close());
 window.addEventListener('wedo-disconnected',()=>stopPrograms().catch(error=>notify(error.message)));
 window.addEventListener('keydown',event=>{if(root.hidden||root.classList.contains('showing-content')||event.target.closest('input,textarea,[contenteditable]'))return;if(event.key==='Escape')stopPrograms().catch(error=>notify(error.message));else executeKey(event.key.toUpperCase());});
 canvas.addEventListener('wheel',event=>{event.preventDefault();if(event.ctrlKey){stepZoom(event.deltaY<0?1:-1);}else{pan.x-=event.deltaX/scale;pan.y-=event.deltaY/scale;}updateCamera();},{passive:false});
 canvas.addEventListener('pointerdown',event=>{if(event.target!==canvas&&event.target!==plane)return;canvasPanning=true;const start={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};canvas.setPointerCapture(event.pointerId);const move=e=>{pan.x=start.px+(e.clientX-start.x)/scale;pan.y=start.py+(e.clientY-start.y)/scale;updateCamera();};const up=()=>{canvasPanning=false;if(cameraAnimation){const ratio=cameraAnimation.next/zoom;cameraAnimation.pan={x:innerWidth/scale/2-(innerWidth/scale/2-pan.x)*ratio,y:323-(323-pan.y)*ratio};}canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);};canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);});
 window.addEventListener('resize',resize);resize();buildPalette();
}
let ready;
export async function ensureProjectReady(){
 await (ready ||= init().catch(error=>{ready=null;throw error;}));
 if(!doc){const route=location.hash||'free';activityKey=route;currentKey=library.activeKey&&library.projects[library.activeKey]?library.activeKey:route;doc=library.projects[currentKey]||makeDocument();doc.coordinateOrigin??=innerWidth/(innerHeight/768)/2;doc.detachedParameters||=[];doc.comments||=[];restoreCamera();register();renderCanvas();}
 return doc;
}
export async function openProgramming(){
 await ensureProjectReady();saveDocumentation(window);showCanvas();resize();if(storageBlocked)notify('No se pudo leer la biblioteca guardada. Sus datos se conservan.');
}
export async function installProgramming(){
 if(document.querySelector('link[data-wedo-editor]'))return;const css=el('link');css.rel='stylesheet';css.href='/original-editor.css';css.dataset.wedoEditor='';document.head.append(css);const contentCss=el('link');contentCss.rel='stylesheet';contentCss.href='/original-content.css';document.head.append(contentCss);
 await openProgramming();
 if(location.hash.includes('/project/')||['#/documentation','#/help','#/models','#/programs'].includes(location.hash))await originalPage(location.hash.slice(1));else await projects(false);
}
