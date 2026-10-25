import {spriteImage} from './original-art.js';
// UI.MicrophoneController + Model.Project.PersisterUtilities, recovered C#.
// Current .clipdata: UTF-8 Single per line. Legacy: NRBF root Single[] only.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const roundEven=value=>{const n=Math.floor(value);return value-n===.5?n+(n%2):Math.round(value);};
export function userAudioIndex(reference){
 const value=String(reference),match=/^@?([A-Z])$/.exec(value)||/^UserClip_(\d{2})$/.exec(value);
 const index=match?(isNaN(Number(match[1]))?match[1].charCodeAt(0)-65:Number(match[1])):-1;
 if(index<0||index>25)throw Error('Sonido de usuario no válido: '+value);return index;
}
const clipName=index=>'UserClip_'+index.toString().padStart(2,'0');
async function bytes(data){if(data instanceof Blob)return new Uint8Array(await data.arrayBuffer());if(data instanceof Uint8Array)return data;if(data instanceof ArrayBuffer)return new Uint8Array(data);if(Array.isArray(data))return new Uint8Array(data);throw Error('Contenido de audio no válido.');}
// Deliberately not a general BinaryFormatter deserializer: no classes, references,
// libraries, object activation or executable callbacks are accepted.
function parseLegacyClipData(data){
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let at=0;
 const need=n=>{if(at+n>data.byteLength)throw Error('Grabaci?n binaria truncada.');};
 const byte=()=>{need(1);return view.getUint8(at++);};
 const int=()=>{need(4);const n=view.getInt32(at,true);at+=4;return n;};
 const invalid=()=>{throw Error('Formato binario de grabaci?n no compatible: se requiere un array Single[].');};
 if(byte()!==0)invalid();const root=int(),header=int(),major=int(),minor=int();
 if(root<=0||header!==-1||major!==1||minor!==0)invalid();
 const record=byte(),objectId=int();let length;
 if(record===15){length=int();if(byte()!==11)invalid();}
 else if(record===7){
  // BinaryArray(Single, rank 1, Primitive, Single), used by some serializers.
  if(byte()!==0||int()!==1)invalid();length=int();if(byte()!==0||byte()!==11)invalid();
 }else invalid();
 if(objectId!==root||length<=0||length>2_000_000)invalid();
 need(length*4+1);
 if(at+length*4+1!==data.byteLength)invalid();
 const samples=new Float32Array(length);
 for(let i=0;i<length;i++){const value=view.getFloat32(at,true);at+=4;if(!Number.isFinite(value)||Math.abs(value)>1)throw Error('Muestra de audio fuera de rango.');samples[i]=value;}
 if(byte()!==11)invalid();return samples;
}
export function parseOriginalClipData(data){
 if(data.byteLength>32*1024*1024)throw Error('Grabación demasiado grande.');
 if(data instanceof ArrayBuffer)data=new Uint8Array(data);
 if(data[0]===0)return parseLegacyClipData(data);
 let text;try{text=decoder.decode(data).replace(/^\uFEFF/,'');}catch{throw Error('Invalid .clipdata: expected UTF-8 text or binary Single[].');}
 const lines=text.trim().split(/\r?\n/);if(!text.trim()||lines.length>2_000_000)throw Error('Muestras de audio vacías o demasiado numerosas.');
 const samples=new Float32Array(lines.length);
 for(let i=0;i<lines.length;i++){const token=lines[i].trim();if(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(token))throw Error('Muestra de audio original no válida en línea '+(i+1));const value=Number(token.replace(',','.'));if(!Number.isFinite(value)||Math.abs(value)>1)throw Error('Muestra de audio fuera de rango.');samples[i]=value;}
 return samples;
}
function validateClip(clip){
 const {Samples:samples,Frequency:frequency,Channels:channels,ClipBeginTime:begin,ClipEndTime:end}=clip;
 if(!Number.isInteger(frequency)||frequency<1||frequency>192000||!Number.isInteger(channels)||channels<1||channels>8||!samples?.length||samples.length>2_000_000||samples.length%channels)throw Error('Formato de grabación original no válido.');
 if(!Number.isFinite(begin)||!Number.isFinite(end)||begin<0||end<=begin||end>samples.length/frequency)throw Error('Recorte de audio fuera de la grabación.');
 return clip;
}
export async function loadOriginalUserClip(project,reference){
 const index=userAudioIndex(reference),name=clipName(index),prefix=project.id+'/'+name;
 const find=extension=>project.bundleFiles?.find(file=>file.name.replaceAll('\\','/')===prefix+extension);
 const metadata=find('.json'),data=find('.clipdata');if(!metadata||!data)throw Error('No se encuentra la grabación @'+String.fromCharCode(65+index)+'.');
 const raw=JSON.parse(decoder.decode(await bytes(metadata.data)).replace(/^\uFEFF/,''));
 return validateClip({...raw,ClipName:name,Samples:parseOriginalClipData(await bytes(data.data))});
}
export function cropOriginalUserClip(clip){
 validateClip(clip);
 const count=roundEven(clip.Frequency*clip.Channels*(clip.ClipEndTime-clip.ClipBeginTime)),offset=roundEven(clip.Frequency*clip.ClipBeginTime)*clip.Channels;
 // Native AudioClip.Create receives array.Length as frame count, including
 // channels; preserve its padding/duration for old multichannel projects.
 const samples=new Float32Array(count*clip.Channels),sourceLength=clip.Samples.length*clip.Channels;
 for(let i=0;i<count;i++)samples[i]=clip.Samples[(offset+i)%sourceLength]||0;
 return {...clip,Samples:samples,duration:count/clip.Frequency};
}
export function encodePcmWav(samples,frequency,channels=1){
 const data=new Uint8Array(44+samples.length*2),view=new DataView(data.buffer),ascii=(at,text)=>{for(let i=0;i<text.length;i++)data[at+i]=text.charCodeAt(i);};
 ascii(0,'RIFF');view.setUint32(4,data.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,frequency,true);view.setUint32(28,frequency*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);}return new Blob([data],{type:'audio/wav'});
}
export async function resolveOriginalUserAudio(project,reference){const clip=cropOriginalUserClip(await loadOriginalUserClip(project,reference));return {...clip,blob:encodePcmWav(clip.Samples,clip.Frequency,clip.Channels)};}
export async function originalUserAudioDuration(project,reference){return cropOriginalUserClip(await loadOriginalUserClip(project,reference)).duration;}
export function saveOriginalUserClip(project,reference,clip){
 const index=userAudioIndex(reference),name=clipName(index);validateClip(clip);
 const metadata={...clip,Samples:[],ClipName:name};delete metadata.duration;delete metadata.blob;
 const text=Array.from(clip.Samples,value=>{if(!Number.isFinite(value)||Math.abs(value)>1)throw Error('Muestra de audio no válida.');return Math.fround(value).toString();}).join('\r\n')+'\r\n';
 const prefix=project.id+'/'+name;project.bundleFiles??=[];
 for(const [extension,data]of [['.json',encoder.encode(JSON.stringify(metadata))],['.clipdata',encoder.encode('\uFEFF'+text)]]){const existing=project.bundleFiles.find(file=>file.name.replaceAll('\\','/')===prefix+extension);if(existing){existing.name=prefix+extension;existing.data=data;}else project.bundleFiles.push({name:prefix+extension,data});}
 return '@'+String.fromCharCode(65+index);
}
export function nextOriginalUserAudioReference(project){for(let index=0;index<26;index++)if(!project.bundleFiles?.some(file=>file.name.replaceAll('\\','/')===project.id+'/'+clipName(index)+'.json'))return '@'+String.fromCharCode(65+index);throw Error('El proyecto ya contiene 26 grabaciones.');}

export function createOriginalAudioRecorder({onComplete=()=>{},onLevel=()=>{},onError=error=>console.error(error),environment=globalThis}={}){
 let stream,context,source,processor,mute,recording=false,opening=false,cancelled=false,chunks=[],count=0,rate=28000,completion;
 async function release(){stream?.getTracks().forEach(track=>track.stop());processor?.disconnect();source?.disconnect();mute?.disconnect();if(processor)processor.onaudioprocess=null;await context?.close();stream=context=source=processor=mute=null;}
 async function stop(){
  if(opening){cancelled=true;return null;}if(!recording)return completion||null;recording=false;
  completion=(async()=>{await release();const input=new Float32Array(count);let offset=0;for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}chunks=[];
   const samples=new Float32Array(6*28000);for(let i=0;i<samples.length;i++){const pos=i*rate/28000,left=Math.floor(pos),fraction=pos-left;if(left>=input.length)break;samples[i]=input[left]*(1-fraction)+(input[left+1]??input[left])*fraction;}
   const clip={Samples:samples,Frequency:28000,Channels:1,ClipBeginTime:0,ClipEndTime:6};await onComplete(clip);return clip;
  })();return completion;
 }
 async function start(){
  if(recording||opening)throw Error('La grabación ya está en marcha.');if(!environment.navigator?.mediaDevices?.getUserMedia)throw Error('El micrófono requiere HTTPS o localhost.');
  opening=true;cancelled=false;completion=null;chunks=[];count=0;
  try{stream=await environment.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,sampleRate:28000},video:false});if(cancelled){await release();return;}
   const AudioContext=environment.AudioContext||environment.webkitAudioContext;context=new AudioContext();await context.resume();if(cancelled){await release();return;}rate=context.sampleRate;
   source=context.createMediaStreamSource(stream);processor=context.createScriptProcessor(2048,1,1);mute=context.createGain();mute.gain.value=0;
   processor.onaudioprocess=event=>{if(!recording)return;const input=event.inputBuffer.getChannelData(0),remaining=6*rate-count,chunk=input.slice(0,remaining);chunks.push(chunk);count+=chunk.length;onLevel(Math.max(0,...chunk));if(count>=6*rate)void stop().catch(onError);};
   for(const track of stream.getTracks()){if(track.readyState==='ended')throw Error('El micrófono se ha desconectado.');track.addEventListener?.('ended',()=>{if(!recording)return;recording=false;chunks=[];void release().then(()=>onError(Error('El micrófono se ha desconectado.')),onError);},{once:true});}
   source.connect(processor);processor.connect(mute);mute.connect(context.destination);recording=true;
  }catch(error){await release();throw error;}finally{opening=false;}
 }
 return {start,stop,async cancel(){cancelled=true;recording=false;chunks=[];await release();},get recording(){return recording;}};
}

export async function showOriginalUserAudioRecorder({project,catalog,reference,onSave=()=>{},onSelect=()=>{}}){
 reference ||= nextOriginalUserAudioReference(project);
 const existing=project.bundleFiles?.some(file=>file.name.replaceAll('\\','/')===project.id+'/'+clipName(userAudioIndex(reference))+'.json');
 let clip=existing?await loadOriginalUserClip(project,reference):null,player,url,timer,started=0;
 const dialog=document.createElement('dialog'),panel=document.createElement('div'),scale=Math.min(1,(innerWidth-24)/720,(innerHeight-24)/420);
 Object.assign(dialog.style,{width:720*scale+'px',height:420*scale+'px',padding:'0',border:'0',overflow:'hidden',background:'#fff'});
 Object.assign(panel.style,{position:'relative',width:'720px',height:'420px',transform:`scale(${scale})`,transformOrigin:'0 0',font:'18px Arial,sans-serif',color:'#666'});dialog.append(panel);document.body.append(dialog);
 const title=document.createElement('span');title.textContent=reference;Object.assign(title.style,{position:'absolute',left:'27px',top:'20px'});panel.append(title);
 const waveform=document.createElement('canvas');waveform.width=666;waveform.height=225;Object.assign(waveform.style,{position:'absolute',left:'27px',top:'61px',width:'666px',height:'225px',background:'#edf8fa'});panel.append(waveform);
 const status=document.createElement('p');status.setAttribute('role','status');Object.assign(status.style,{position:'absolute',left:'25px',top:'365px',right:'25px',margin:'0',fontSize:'15px'});panel.append(status);
 const button=(label,icon,left,top,action)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;Object.assign(b.style,{position:'absolute',left:left+'px',top:top+'px',width:'57px',height:'57px',padding:'0',border:'0',background:'transparent',cursor:'pointer'});const image=spriteImage(catalog,icon);Object.assign(image.style,{width:'100%',height:'100%',objectFit:'contain'});b.append(image);b.onclick=()=>Promise.resolve(action()).catch(error=>status.textContent=error.message);panel.append(b);return b;};
 const haltPlayback=()=>{player?.pause();player=null;if(url)URL.revokeObjectURL(url);url=null;};
 const draw=()=>{const ctx=waveform.getContext('2d');ctx.clearRect(0,0,666,225);ctx.fillStyle='#c7dce2';ctx.fillRect(0,0,666,225);if(!clip)return;ctx.fillStyle='#008baa';for(let x=0;x<666;x++){let peak=0;const a=Math.floor(x*clip.Samples.length/666),b=Math.floor((x+1)*clip.Samples.length/666);for(let i=a;i<b;i++)peak=Math.max(peak,Math.abs(clip.Samples[i]));ctx.fillRect(x,112-peak*105,1,Math.max(1,peak*210));}ctx.fillStyle='#ffffff99';ctx.fillRect(0,0,clip.ClipBeginTime/6*666,225);ctx.fillRect(clip.ClipEndTime/6*666,0,666,225);};
 const save=async()=>{saveOriginalUserClip(project,reference,clip);await onSave(project);onSelect(reference);};
 const recorder=createOriginalAudioRecorder({onError:error=>{clearInterval(timer);record.disabled=false;begin.disabled=end.disabled=!clip;status.textContent=error.message;},onComplete:async value=>{clip=value;clearInterval(timer);record.disabled=false;begin.disabled=end.disabled=false;begin.value='0';end.value='6';begin.update();end.update();await save();draw();status.textContent=reference+' · 6 s';}});
 const record=button('Grabar sonido','Record',25,309.5,async()=>{haltPlayback();record.disabled=true;begin.disabled=end.disabled=true;try{await recorder.start();if(!recorder.recording){record.disabled=false;return;}started=performance.now();status.textContent='0.0 / 6 s';timer=setInterval(()=>status.textContent=Math.min(6,(performance.now()-started)/1000).toFixed(1)+' / 6 s',100);}catch(error){record.disabled=false;begin.disabled=end.disabled=!clip;throw error;}});
 button('Reproducir grabación','Playback',95,309.5,async()=>{if(!clip)throw Error('Graba primero un sonido.');await recorder.stop();haltPlayback();const resolved=await resolveOriginalUserAudio(project,reference);url=URL.createObjectURL(resolved.blob);player=new Audio(url);player.onended=haltPlayback;await player.play();});
 button('Parar grabación','Stop',166.5,309.5,async()=>{haltPlayback();await recorder.stop();});
 button('Eliminar grabación','Trash',638,308,async()=>{
  const accepted=await new Promise(resolve=>{const prompt=document.createElement('dialog');Object.assign(prompt.style,{width:'400px',height:'200px',padding:'0',border:'0',maxWidth:'90vw'});const text=document.createElement('p');text.textContent='¿Eliminar esta grabación?';Object.assign(text.style,{textAlign:'center',marginTop:'25px',font:'18px Arial,sans-serif',color:'#666'});prompt.append(text);
   for(const [label,icon,left,value]of [['Confirmar eliminación','confirm',75,true],['Cancelar eliminación','cancel',205,false]]){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);Object.assign(b.style,{position:'absolute',left:left+'px',top:'70px',width:'120px',height:'60px',padding:'0',border:'0',background:'transparent'});const image=spriteImage(catalog,icon);Object.assign(image.style,{width:'100%',height:'100%'});b.append(image);b.onclick=()=>prompt.close(String(value));prompt.append(b);}
   prompt.onclose=()=>{resolve(prompt.returnValue==='true');prompt.remove();};document.body.append(prompt);prompt.showModal();
  });
  if(!accepted)return;await recorder.cancel();haltPlayback();const prefix=project.id+'/'+clipName(userAudioIndex(reference));project.bundleFiles=project.bundleFiles?.filter(file=>![prefix+'.json',prefix+'.clipdata'].includes(file.name.replaceAll('\\','/')))||[];await onSave(project);dialog.close();
 });
 const trim=(label,initial,icon)=>{const handle=document.createElement('button');handle.type='button';handle.value=String(initial);handle.setAttribute('role','slider');handle.setAttribute('aria-label',label);handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','6');Object.assign(handle.style,{position:'absolute',top:'61px',width:'43px',height:'225px',padding:'0',border:'0',background:'transparent',touchAction:'none',cursor:'ew-resize'});
  const image=spriteImage(catalog,icon);Object.assign(image.style,{position:'absolute',width:'20px',height:'100%',left:'11.5px',top:'0'});handle.append(image);
  handle.update=()=>{handle.style.left=(27+Number(handle.value)/6*666-21.5)+'px';handle.setAttribute('aria-valuenow',handle.value);};handle.update();
  handle.onpointerdown=event=>{if(handle.disabled)return;event.preventDefault();handle.setPointerCapture(event.pointerId);const move=e=>{const rect=waveform.getBoundingClientRect();handle.value=String(Math.max(0,Math.min(6,(e.clientX-rect.left)/rect.width*6)));handle.update();};const end=e=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.onchange?.();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);};
  handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();handle.value=String(Math.max(0,Math.min(6,Number(handle.value)+(event.key==='ArrowLeft'?-.01:.01))));handle.update();handle.onchange?.();};
  handle.disabled=!clip;panel.append(handle);return handle;
 };
 const begin=trim('Inicio del recorte',clip?.ClipBeginTime||0,'SliderHandleLeft'),end=trim('Final del recorte',clip?.ClipEndTime||6,'SliderHandleRight');
 for(const input of [begin,end])input.onchange=async()=>{if(!clip)return;try{const start=Number(begin.value),finish=Number(end.value);if(finish<=start)throw Error('El final debe estar después del inicio.');validateClip({...clip,ClipBeginTime:start,ClipEndTime:finish});clip.ClipBeginTime=start;clip.ClipEndTime=finish;await save();draw();status.textContent=(finish-start).toFixed(2)+' s';}catch(error){status.textContent=error.message;begin.value=String(clip.ClipBeginTime);end.value=String(clip.ClipEndTime);begin.update();end.update();}};
 const close=button('Cerrar grabación','ConnectHubDialogCloseButtonNormal',676,12,()=>dialog.close());close.style.width=close.style.height='28px';
 dialog.addEventListener('close',()=>{clearInterval(timer);void recorder.cancel();haltPlayback();dialog.remove();},{once:true});
 draw();dialog.showModal();return {dialog,recorder,close:()=>dialog.close()};
}
