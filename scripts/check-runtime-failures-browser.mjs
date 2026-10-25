import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{
  window.mediaMode='denied';window.fakeTracks=[];window.pendingGrants=[];window.savedMedia=0;
  const fakeStream=()=>{const track={stopped:false,stop(){this.stopped=true;}};window.fakeTracks.push(track);const stream=new MediaStream();stream.getTracks=()=>[track];return stream;};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{if(window.mediaMode==='denied')throw new DOMException('Permiso denegado (simulado)','NotAllowedError');if(window.mediaMode==='pending')return new Promise(resolve=>window.pendingGrants.push(()=>resolve(fakeStream())));return fakeStream();}});
  HTMLMediaElement.prototype.play=async()=>{};
  window.MediaRecorder=class{static isTypeSupported(){return true;}constructor(){window.fakeRecorder=this;this.mimeType='video/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['partial'],{type:this.mimeType})});this.onstop?.();}};
 });
 await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');await page.getByRole('button',{name:'Volver al programa',exact:true}).click();
 const camera=await page.evaluate(async()=>{
  const {runCameraAction}=await import('/original-camera.js');window.cameraApi=runCameraAction;window.cameraProject={id:crypto.randomUUID()};
  const denied=await runCameraAction('camera-photo',{project:cameraProject});const deniedMessage=denied.panel.querySelector('[role=status]').textContent;denied.close();
  mediaMode='ready';const failed=await runCameraAction('camera-video',{project:cameraProject,onSave:()=>savedMedia++});await failed.capture();
  fakeRecorder.onerror({error:new Error('Fallo grabador (simulado)')});fakeRecorder.stop();await new Promise(resolve=>setTimeout(resolve,30));
  window.failedCamera=failed;
  return {deniedMessage,errorMessage:failed.panel.querySelector('[role=status]').textContent,saved:savedMedia,tracksStopped:fakeTracks.every(track=>track.stopped)};
 });
 await page.screenshot({path:'analysis/runtime-camera-failure.png'});await page.evaluate(()=>failedCamera.close());
 const stale=await page.evaluate(async()=>{
  mediaMode='pending';const pending=cameraApi('camera-photo',{project:cameraProject});
  while(!document.querySelector('[aria-label="Captura WeDo"]'))await new Promise(resolve=>setTimeout(resolve,0));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));pendingGrants.shift()();await pending;
  return {panels:document.querySelectorAll('[aria-label="Captura WeDo"]').length,allStopped:fakeTracks.every(track=>track.stopped)};
 });
 const storage=await page.evaluate(async()=>{
  const api=await import('/original-storage.js');await api.saveOriginalLibrary({projects:{before:{name:'before'}}});
  const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Cuota simulada','QuotaExceededError');};
  let message='';try{await api.saveOriginalLibrary({projects:{after:{name:'should not persist'}}});}catch(error){message=error.message;}finally{IDBObjectStore.prototype.put=original;}
  const preserved=await api.loadOriginalLibrary();await api.saveOriginalLibrary({projects:{recovered:{name:'recovered'}}});const recovered=await api.loadOriginalLibrary();
  return {message,preserved:Object.keys(preserved.projects),recovered:Object.keys(recovered.projects)};
 });
 const switchRace=await page.evaluate(async()=>{
  mediaMode='ready';const controller=await cameraApi('camera-photo',{project:cameraProject});mediaMode='pending';
  const flip=controller.panel.querySelector('[aria-label="Cambiar cámara"]');flip.click();flip.click();
  pendingGrants[1]();await new Promise(resolve=>setTimeout(resolve,0));pendingGrants[0]();pendingGrants=[];await new Promise(resolve=>setTimeout(resolve,0));
  const liveBeforeClose=fakeTracks.filter(track=>!track.stopped).length;controller.close();return {liveBeforeClose,liveAfterClose:fakeTracks.filter(track=>!track.stopped).length};
 });
 await page.evaluate(async()=>{mediaMode='denied';const api=await import('/original-user-audio.js'),catalog=await(await fetch('/original-assets.json')).json();window.recordPanel=await api.showOriginalUserAudioRecorder({project:{id:crypto.randomUUID(),bundleFiles:[]},catalog});});
 await page.getByRole('button',{name:'Grabar sonido',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog [role=status]')?.textContent.includes('Permiso denegado'));
 const audio={message:await page.locator('dialog [role=status]').innerText(),recordEnabled:await page.getByRole('button',{name:'Grabar sonido',exact:true}).isEnabled()};await page.screenshot({path:'analysis/runtime-audio-denied.png'});await page.evaluate(()=>recordPanel.close());
 console.log(JSON.stringify({camera,stale,switchRace,storage,audio},null,2));
 assert.match(camera.deniedMessage,/denegado/);assert.equal(camera.saved,0,'failed video must not be saved');assert.match(camera.errorMessage,/Fallo grabador/);assert.equal(camera.tracksStopped,true);assert.deepEqual(stale,{panels:0,allStopped:true});
 assert.match(storage.message,/Cuota simulada/);assert.deepEqual(storage.preserved,['before']);assert.deepEqual(storage.recovered,['recovered']);assert.equal(audio.recordEnabled,true);
 assert.deepEqual(switchRace,{liveBeforeClose:1,liveAfterClose:0});
 console.log('PASS: camera denied/error/pending-close, recorder denied, IndexedDB abort preserves prior library and later writes recover. All failure sources simulated.');
}finally{await browser.close();}
