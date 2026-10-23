import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/lab/');await page.locator('#run').waitFor();
 assert.equal(await page.locator('.block').count(),7);
 await page.locator('#name').fill('Proyecto de prueba');await page.reload();assert.equal(await page.locator('#name').inputValue(),'Proyecto de prueba');
 await page.locator('#palette button').filter({hasText:'Esperar'}).click();assert.equal(await page.locator('.block').count(),8);
 await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#power').textContent.includes('50'));await page.locator('#stop').click();await page.waitForFunction(()=>!document.querySelector('#run').disabled);
 assert.match(await page.locator('#status').textContent(),/detenido/);assert.match(await page.locator('#power').textContent(),/^0/);
 await page.locator('#mode').selectOption('hub');await page.locator('#run').click();assert.match(await page.locator('#status').textContent(),/Conecta el hub/);await page.locator('#mode').selectOption('sim');
 await page.screenshot({path:'analysis/web-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'analysis/web-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: navegador, guardado, añadir bloques, ejecución, parada, hub desconectado y diseño móvil; sin errores JS.');
}finally{await browser.close();}
