import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage();
 await page.route('**/original-camera.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile('web/original-camera.js','utf8')}));
 await page.addInitScript(()=>{
  window.cameraCalls=0;window.stoppedTracks=0;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{cameraCalls++;return new MediaStream();}});
  MediaStream.prototype.getTracks=function(){return [{stop(){stoppedTracks++;}}];};
  HTMLMediaElement.prototype.play=async()=>{};
  window.MediaRecorder=class{
   static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='video/webm';}
   start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['video'],{type:'video/webm'})});this.onstop?.();}
  };
 });
 await page.goto('http://localhost:8080/original/#/library');
 const result=await page.evaluate(async()=>{
  const {runCameraAction}=await import('/original-camera.js'),project={id:'mock-project'};let saves=0;
  const options={project,onSave:()=>saves++,captureCanvas:()=>new Blob(['canvas'],{type:'image/png'})};
  const canvas=await runCameraAction('camera-canvas',options);await canvas.capture();canvas.close();
  const before=cameraCalls;
  const video=await runCameraAction('camera-video',options);await video.capture();await video.capture();
  await new Promise(resolve=>setTimeout(resolve,30));video.close();
  const photo=await runCameraAction('camera-photo',options);photo.close();
  return {before,calls:cameraCalls,stopped:stoppedTracks,saves,kinds:project.capturedMedia.map(x=>x.kind),panels:document.querySelectorAll('[aria-label="Captura WeDo"]').length};
 });
 assert.equal(result.before,0);assert.equal(result.calls,2);assert.equal(result.stopped,2);assert.equal(result.saves,2);assert.deepEqual(result.kinds,['canvas','video']);assert.equal(result.panels,0);
 await page.evaluate(async()=>{
  const {runCameraAction}=await import('/original-camera.js'),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');ctx.fillStyle='#e6f6fa';ctx.fillRect(0,0,640,360);ctx.fillStyle='#008baa';ctx.font='30px sans-serif';ctx.fillText('CAPTURA SIMULADA',155,185);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  window.cameraScreenshotPanel=await runCameraAction('camera-canvas',{project:{id:crypto.randomUUID()},captureCanvas:()=>blob});
 });
 await page.screenshot({path:'analysis/original-camera-mock.png'});await page.evaluate(()=>cameraScreenshotPanel.close());
 console.log('Camera mocks: canvas, recording save, close track cleanup; no physical camera access.');
}finally{await browser.close();}
