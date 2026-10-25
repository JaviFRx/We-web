import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/original-teacher-resources.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile('web/original-teacher-resources.js','utf8')}));
 await page.goto('http://localhost:8080/original/#/library');
 if(process.argv.includes('--integrated'))await page.getByRole('button',{name:'Recursos para el profesor',exact:true}).click();
 else await page.evaluate(async()=>{const {showOriginalTeacherResources}=await import('/original-teacher-resources.js');const catalog=await(await fetch('/original-assets.json')).json();showOriginalTeacherResources({catalog});});
 const dialog=page.locator('.wedo-teacher-resources');await dialog.waitFor();assert.equal(await dialog.locator('a').count(),3);
 assert.match(await dialog.getByRole('link',{name:'Guías para el profesor'}).getAttribute('href'),/teacher-guides$/);
 await page.waitForFunction(()=>document.querySelector('.wedo-teacher-resources')?.dataset.transition==='complete');await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));await page.screenshot({path:'analysis/teacher-menu.png'});
 await dialog.getByRole('button',{name:'Sugerencias y consejos para la clase'}).click();
 assert.equal(await dialog.locator('[data-original-name="Page1Image1"]').count(),1);
 assert.equal(await dialog.getByRole('button',{name:'Página anterior'}).count(),0);
 for(let i=2;i<=5;i++)await dialog.getByRole('button',{name:'Página siguiente'}).click();
 assert.equal(await dialog.locator('[data-original-name="Page5Image1"]').count(),1);
 assert.equal(await dialog.getByRole('button',{name:'Página siguiente'}).count(),0);
 await page.waitForFunction(()=>document.querySelector('.wedo-teacher-resources')?.dataset.transition==='complete');await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));await page.screenshot({path:'analysis/teacher-slide5.png'});
 await dialog.getByRole('button',{name:'Cerrar recursos'}).click();await dialog.locator('a').first().waitFor();assert.equal(await dialog.locator('a').count(),3);
 await dialog.getByRole('button',{name:'Cerrar recursos'}).click();await dialog.waitFor({state:'detached'});assert.equal(await dialog.count(),0);
 assert.deepEqual(errors,[]);console.log('Original teacher resources: four menu actions, five local slides, navigation/close passed; external links not opened.');
}finally{await browser.close();}
