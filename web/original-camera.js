import {loadOriginalArt,spriteImage} from './original-art.js';
// UI.CaptureToolPane: mode selection opens preview; capture is a separate action.
// Native captures live in Pictures/WeDo (or project folder), selected later by SDT.
let active=null;
export async function storeCameraMedia(blob,{project,onSave},kind='photo'){
 if(!project)throw Error('No hay proyecto abierto.');
 if(!(blob instanceof Blob)||!blob.size)throw Error('La captura está vacía.');
 if(blob.size>100*1024*1024)throw Error('La captura supera 100 MB.');
 const extension=blob.type.includes('webm')?'webm':blob.type.includes('mp4')?'mp4':blob.type.includes('png')?'png':'jpg';
 const name=crypto.randomUUID()+'.'+extension,path=project.id+'/'+name;
 project.bundleFiles??=[];project.bundleFiles.push({name:path,data:new Uint8Array(await blob.arrayBuffer())});
 project.capturedMedia??=[];project.capturedMedia.push({path,kind,type:blob.type});
 await onSave?.(project);return {path,name,blob,kind};
}
export async function runCameraAction(action,{project,onSave,captureCanvas}={}){
 if(!['camera-photo','camera-video','camera-canvas'].includes(action))throw Error('Modo de cámara desconocido.');
 if(!project)throw Error('Abre un proyecto antes de capturar.');
 active?.close();
 const art=await loadOriginalArt(),panel=document.createElement('section');panel.setAttribute('aria-label','Captura WeDo');
 // CaptureTopBarGroup settles at485x270; child offsets from level1 CaptureTool prefab.
 const captureScale=innerHeight/768;
 panel.style.cssText=`position:fixed;z-index:1300;top:${54*captureScale}px;left:${22*captureScale}px;width:485px;height:270px;transform:scale(${captureScale});transform-origin:top left;background:transparent url("${art.sprites['Rectangle 3'].url}") center/100% 100% no-repeat;box-sizing:border-box`;
 const outline=spriteImage(art,'Oval Copy');outline.alt='';outline.style.cssText='position:absolute;left:.685px;top:94.575px;width:87.23px;height:79.65px;pointer-events:none';panel.append(outline);
 const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.style.cssText='position:absolute;left:99.5px;top:26px;width:356.5px;height:212px;object-fit:contain;background:#333';
 const controls=document.createElement('div'),status=document.createElement('div'),download=document.createElement('a');status.setAttribute('role','status');download.textContent='Guardar archivo';download.hidden=true;download.style.display='block';
 controls.style.cssText='position:absolute;inset:0;pointer-events:none';status.style.cssText='position:absolute;left:99.5px;top:244px;width:356.5px;font:14px WeDoRoboto,Arial,sans-serif;color:#333;text-align:center;pointer-events:auto';download.style.cssText='position:absolute;left:32.7px;top:23.3px;width:49px;height:34px;overflow:hidden;font-size:0;pointer-events:auto;background:url("'+art.sprites.capture_preview_background.url+'") center/100% 100% no-repeat';download.setAttribute('aria-label','Guardar archivo');
 function button(label,icon,handler){const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.style.cssText='position:absolute;padding:0;background:transparent;border:0;cursor:pointer;pointer-events:auto;'+(icon==='Oval'?'left:11.15px;top:99.2px;width:66.1px;height:72.4px':icon==='Flip_icon'?'left:29.6px;top:221.4px;width:45px;height:32px':'width:1px;height:1px;clip-path:inset(50%);overflow:hidden');if(icon){const img=spriteImage(art,icon);img.style.cssText='width:100%;height:100%;object-fit:fill';b.append(img);}else b.textContent=label;b.onclick=()=>Promise.resolve(handler()).catch(error=>{status.textContent=error.message;});return b;}
 let stream=null,recorder=null,recordingSession=null,closed=false,url=null,previewUrl=null,facing='environment',previewGeneration=0;
 const stopTracks=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;};
 const save=async(blob,kind)=>{const media=await storeCameraMedia(blob,{project,onSave},kind);if(closed)return media;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);download.href=url;download.download=media.name;download.hidden=false;status.textContent='Captura guardada';return media;};
 const startPreview=async()=>{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('La cámara necesita HTTPS o localhost y permiso del navegador.');
  const generation=++previewGeneration;stopTracks();
  try{const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:action==='camera-video'});
   if(closed||generation!==previewGeneration){acquired.getTracks().forEach(track=>track.stop());return;}
   stream=acquired;video.srcObject=stream;await video.play();
  }catch(error){if(closed||generation!==previewGeneration)return;throw error;}
 };
 const capture=async()=>{
  if(closed)return;
  if(action==='camera-canvas'){
   if(!captureCanvas)throw Error('La captura del programa no está disponible.');
   const result=await captureCanvas(),blob=result instanceof Blob?result:await (await fetch(result)).blob();return save(blob,'canvas');
  }
  if(!stream)throw Error('La cámara todavía no está preparada.');
  if(action==='camera-photo'){
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;if(!canvas.width)throw Error('Espera a que aparezca la imagen de la cámara.');
   canvas.getContext('2d').drawImage(video,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));return save(blob,'photo');
  }
  if(recorder?.state==='recording'){recorder.stop();return;}
  if(!globalThis.MediaRecorder)throw Error('Este navegador no permite grabar vídeo.');
  const session=recordingSession={parts:[],discard:false};const type=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
  recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
  const currentRecorder=recorder;
  recorder.ondataavailable=e=>{if(e.data.size)session.parts.push(e.data);};
  recorder.onerror=e=>{session.discard=true;if(recorder===currentRecorder){status.textContent=e.error?.message||'No se pudo grabar el vídeo.';stopTracks();}};
  recorder.onstop=()=>{if(!closed&&!session.discard)save(new Blob(session.parts,{type:currentRecorder.mimeType}),'video').catch(error=>{status.textContent=error.message;});};
  recorder.start(1000);status.textContent='Grabando. Pulsa de nuevo para detener.';
 };
 const close=()=>{if(closed)return;closed=true;previewGeneration++;if(recordingSession)recordingSession.discard=true;if(recorder?.state==='recording')recorder.stop();stopTracks();if(url)URL.revokeObjectURL(url);if(previewUrl)URL.revokeObjectURL(previewUrl);panel.remove();window.removeEventListener('pagehide',close);document.removeEventListener('keydown',escape);if(active?.panel===panel)active=null;};
 const escape=e=>{if(e.key==='Escape')close();};
 controls.append(button('Capturar','Oval',capture));
 if(action!=='camera-canvas')controls.append(button('Cambiar cámara','Flip_icon',async()=>{if(recorder?.state==='recording')throw Error('Detén el vídeo antes de cambiar de cámara.');facing=facing==='environment'?'user':'environment';await startPreview();}));
 controls.append(button('Cerrar',null,close),download,status);panel.append(video,controls);document.body.append(panel);
 window.addEventListener('pagehide',close);document.addEventListener('keydown',escape);const controller={panel,close,capture};active=controller;
 if(action==='camera-canvas'){
  video.hidden=true;status.textContent='Capturar el programa';
  if(captureCanvas)try{const result=await captureCanvas();if(!closed){const preview=document.createElement('img');preview.alt='Vista previa del programa';preview.style.cssText=video.style.cssText;preview.className=video.className;preview.src=result instanceof Blob?(previewUrl=URL.createObjectURL(result)):result;panel.append(preview);}}catch(error){status.textContent=error.message;}
 }
 else try{await startPreview();}catch(error){stopTracks();status.textContent=error.message;}
 return controller;
}
