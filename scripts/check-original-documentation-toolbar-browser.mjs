import {chromium,browserOptions} from './browser-test-support.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/original/#/library');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByRole('button',{name:'Documentación',exact:true}).click();
 const remove=page.getByRole('button',{name:'Eliminar página',exact:true});await page.waitForFunction(()=>document.querySelector('[data-action=deletePage]')?.disabled===true);
 assert.equal(await remove.isDisabled(),true);assert.equal(await page.locator('.original-hub-button').isVisible(),false);
 const alpha=await remove.locator('img').evaluate(e=>parseFloat(getComputedStyle(e).opacity));assert.ok(Math.abs(alpha-128/255)<.00001);
 await page.waitForFunction(()=>document.querySelector('.wedo-native-topbar')?.getBoundingClientRect().width>innerWidth);
 const widths=await page.locator('.wedo-native-topbar').evaluate(e=>({bar:e.getBoundingClientRect().width,viewport:innerWidth}));assert.ok(widths.bar>widths.viewport);
 await page.getByRole('button',{name:'Añadir página',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-action=deletePage]')?.disabled===false);assert.equal(await remove.isDisabled(),false);
 await remove.click();await page.waitForFunction(()=>document.querySelector('[data-action=deletePage]')?.disabled===true);
 assert.deepEqual(errors,[]);console.log('PASS full documentation hides covered hub, extends native top background, and delete-page enabled/disabled states plus native tint follow page count.');
}finally{await browser.close();}
