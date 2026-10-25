import {chromium,browserOptions} from './browser-test-support.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/original-teacher-resources.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile('web/original-teacher-resources.js','utf8')}));
 await page.goto('http://localhost:8080/original/#/library');
 await page.evaluate(async()=>{const {showOriginalIntroduction}=await import('/original-teacher-resources.js');const catalog=await fetch('/original-assets.json').then(r=>r.json());showOriginalIntroduction({catalog});});
 const dialog=page.locator('.wedo-original-introduction');
 await mkdir('analysis/verification/flows',{recursive:true});
 for(let i=0;i<5;i++){
  await page.waitForFunction(()=>document.querySelector('.wedo-original-introduction')?.dataset.transition==='complete');
  await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:`analysis/verification/flows/09-introduction-${i+1}.png`});
  assert.ok((await dialog.locator('[data-original-name=PageTitleText]').textContent()).length>0);
  if(i===2){const frames=dialog.locator('[data-original-name=ProgrammingBuild]>img');const first=await frames.getAttribute('src');await page.waitForTimeout(1400);assert.notEqual(await frames.getAttribute('src'),first);}
  if(i<4)await dialog.getByRole('button',{name:'Página siguiente',exact:true}).click();
 }
 await dialog.locator('[data-original-name=GetStarted]').click();await dialog.waitFor({state:'detached'});assert.equal(await dialog.count(),0);assert.deepEqual(errors,[]);
 await page.evaluate(async()=>{localStorage.setItem('wedo-language','arabic');const catalog=await fetch('/original-assets.json').then(r=>r.json());catalog.activeTranslations=catalog.translations.arabic;const {showOriginalIntroduction}=await import('/original-teacher-resources.js');showOriginalIntroduction({catalog});});
 await page.waitForFunction(()=>document.querySelector('.wedo-original-introduction')?.dataset.transition==='complete');
 const rtl=page.locator('.wedo-original-introduction');assert.equal(await rtl.locator('[data-original-name=RightArrow]').count(),0);assert.equal(await rtl.locator('[data-original-name=LeftArrow]').count(),1);
 const closeRect=await rtl.locator('[data-original-name=Close]').boundingBox();assert.ok(closeRect.x<100);
 const before=await rtl.locator('[data-original-name=PageTitleText]').textContent();await rtl.locator('[data-original-name=LeftArrow]').click();
 await page.waitForFunction(()=>document.querySelector('.wedo-original-introduction')?.dataset.transition==='complete');assert.notEqual(await rtl.locator('[data-original-name=PageTitleText]').textContent(),before);
 assert.doesNotMatch(await rtl.locator('[data-original-name=PageTitleText]').textContent(),/REPLACEWITH/);
 assert.equal(await rtl.locator('[data-original-name=Panel]').evaluate(e=>getComputedStyle(e).flexDirection),'row-reverse');
 await page.screenshot({path:'analysis/verification/flows/09-introduction-arabic.png'});await rtl.locator('[data-original-name=Close]').click();await rtl.waitFor({state:'detached'});
 console.log('PASS five native introduction pages, original animated programming frames, native finish closes. No hardware.');
}finally{await browser.close();}
