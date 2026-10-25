import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');
 await page.getByRole('button',{name:'Volver al programa',exact:true}).click();
 await page.evaluate(async()=>{
  const api=await import('/original-user-audio.js'),catalog=await (await fetch('/original-assets.json')).json();window.testAudioApi=api;
  window.testAudioProject={id:crypto.randomUUID(),name:'Audio test',strips:[],bundleFiles:[]};window.audioChanges=0;
  api.saveOriginalUserClip(window.testAudioProject,'@A',{Samples:new Float32Array(28000*6).fill(.25),Frequency:28000,Channels:1,ClipBeginTime:0,ClipEndTime:6});
  await api.showOriginalUserAudioRecorder({project:window.testAudioProject,catalog,reference:'@A',onSave:()=>window.audioChanges++,onSelect:value=>window.selectedAudio=value});
 });
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 await page.getByRole('slider',{name:'Inicio del recorte'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>window.audioChanges===1);
 assert.equal(await page.evaluate(()=>window.selectedAudio),'@A');
 const result=await page.evaluate(async()=>{const resolved=await window.testAudioApi.resolveOriginalUserAudio(window.testAudioProject,'@A');return {duration:resolved.duration,bytes:resolved.blob.size};});
 assert.equal(result.duration,5.99);assert.equal(result.bytes,44+5.99*28000*2);
 const unloaded=await dialog.locator('img').evaluateAll(images=>images.filter(image=>image.hidden||!image.complete||!image.naturalWidth).map(image=>image.dataset.sprite));assert.deepEqual(unloaded,[]);
 await page.screenshot({path:'analysis/original-user-audio.png'});
 await page.getByRole('button',{name:'Eliminar grabación',exact:true}).click();await page.getByRole('button',{name:'Cancelar eliminación',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.testAudioProject.bundleFiles.length),2);
 await page.getByRole('button',{name:'Cerrar grabación'}).click();assert.equal(await dialog.count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: panel audio nativo, recursos originales, recorte por teclado, selección @A y WAV; sin pedir micrófono ni reproducir audio físico.');
}finally{await browser.close();}
