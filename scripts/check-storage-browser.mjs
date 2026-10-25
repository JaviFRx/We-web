import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const context=await browser.newContext(),page=await context.newPage();
 const moduleSource=await readFile(new URL('../web/original-storage.js',import.meta.url),'utf8');
 await page.route('**/storage-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage test</title>'}));
 await page.route('**/original-storage.js',route=>route.fulfill({contentType:'text/javascript',body:moduleSource}));
 await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/storage-test');
 const initial=await page.evaluate(async()=>{
  const api=await import('/original-storage.js');window.storageApi=api;
  localStorage.setItem('legacy','{invalid');let error='';try{await api.loadOriginalLibrary('legacy');}catch(e){error=e.message;}
  const source=JSON.stringify({projects:{legacy:{name:'Original',bundleFiles:[{name:'sound.wav',data:[1,2,3]}]}}});localStorage.setItem('legacy',source);
  const library=await api.loadOriginalLibrary('legacy');
  const migrated=library.projects.legacy.name==='Original'&&localStorage.getItem('legacy')===source;
  let quota=false;try{localStorage.setItem('too-big','x'.repeat(8*1024*1024));}catch(e){quota=e.name==='QuotaExceededError';}
  const bytes=new Uint8Array(8*1024*1024);bytes[0]=17;bytes[bytes.length-1]=241;
  const first=api.saveOriginalLibrary({projects:{first:{name:'First'}}});
  const last={projects:{large:{name:'Last',bundleFiles:[{name:'movie.mp4',data:bytes}],blob:new Blob(['retained'])}}};
  const second=api.saveOriginalLibrary(last);last.projects.large.name='Unsaved';bytes[0]=99;
  await Promise.all([first,second]);
  return {error,migrated,quota};
 });
 assert.match(initial.error,/No se pudo leer o migrar/);assert.equal(initial.migrated,true);assert.equal(initial.quota,true);
 await page.reload();
 const restored=await page.evaluate(async()=>{
  const api=await import('/original-storage.js');const library=await api.loadOriginalLibrary('legacy');const project=library.projects.large,data=project.bundleFiles[0].data;
  let failure='';try{await api.saveOriginalLibrary({projects:{invalid:()=>{}}});}catch(e){failure=e.message;}
  await api.saveOriginalLibrary(library);
  return {name:project.name,bytes:data.length,start:data[0],end:data.at(-1),typed:data instanceof Uint8Array,blob:await project.blob.text(),legacy:!!localStorage.getItem('legacy'),failure,count:Object.keys(library.projects).length};
 });
 assert.deepEqual({...restored,failure:undefined},{name:'Last',bytes:8*1024*1024,start:17,end:241,typed:true,blob:'retained',legacy:true,failure:undefined,count:1});
 assert.match(restored.failure,/No se pudo preparar/);
 console.log('PASS: migración sin borrar legacy, fallo explícito, escrituras ordenadas con snapshot, media8MiB supera localStorage, reload conserva Uint8Array y Blob.');
}finally{await browser.close();}
