import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve('analysis/verification/comparison.html')).href);
 const count=await page.locator('#scene option').count();assert.ok(count>=11);
 for(let i=0;i<count;i++){
  await page.selectOption('#scene',String(i));
  const dimensions=await page.evaluate(async()=>Promise.all(['nativeLink','webLink'].map(id=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);image.onerror=reject;image.src=document.getElementById(id).href;}))));assert.deepEqual(dimensions,[[1920,1080],[1920,1080]]);
 }
 await page.selectOption('#mode','overlay');await page.locator('#opacity').fill('75');assert.equal(await page.locator('#webOverlay').getAttribute('opacity'),'0.75');await page.selectOption('#crop','full');assert.equal(await page.locator('#combined').getAttribute('viewBox'),'0 0 1920 1080');assert.deepEqual(errors,[]);console.log(`PASS: ${count} comparisons / ${count*2} PNG references, local file mode, overlay opacity and full-frame controls.`);
}finally{await browser.close();}
