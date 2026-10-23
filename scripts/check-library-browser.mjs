import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/lab/');await page.evaluate(()=>{localStorage.removeItem('wedo-lab-library-v2');localStorage.setItem('wedo-lab-v1',JSON.stringify({version:1,name:'Anterior',blocks:[{type:'stop'}]}));});await page.reload();assert.equal(await page.locator('#name').inputValue(),'Anterior');
 await page.locator('[data-view=activities]').click();assert.equal(await page.locator('#activity-list article').count(),6);await page.locator('#activity-filter').selectOption('Reto');assert.equal(await page.locator('#activity-list article').count(),1);await page.locator('#activity-filter').selectOption('all');
 await page.locator('#activity-list button').first().click();assert.equal(await page.locator('#name').inputValue(),'Primer movimiento');await page.locator('#notes').fill('Probé el motor durante tres segundos.');await page.locator('#activity-guide input').first().check();
 await page.reload();assert.equal(await page.locator('#notes').inputValue(),'Probé el motor durante tres segundos.');assert.equal(await page.locator('#activity-guide input').first().isChecked(),true);
 await page.locator('[data-view=projects]').click();assert.equal(await page.locator('#project-list article').count(),2);await page.locator('#project-list article').filter({hasText:'Primer movimiento'}).getByRole('button',{name:'Duplicar'}).click();assert.match(await page.locator('#name').inputValue(),/copia/);
 await page.locator('[data-view=projects]').click();page.once('dialog',d=>d.accept('Renombrado'));await page.locator('#project-list article').filter({hasText:'copia'}).getByRole('button',{name:'Renombrar'}).click();await page.locator('#project-search').fill('Renombrado');assert.equal(await page.locator('#project-list article').count(),1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Eliminar',exact:true}).click();assert.equal(await page.locator('#project-list article').count(),0);await page.locator('#project-search').fill('');assert.equal(await page.locator('#project-list article').count(),2);
 await page.locator('[data-view=activities]').click();await page.screenshot({path:'analysis/activities-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'analysis/activities-mobile.png',fullPage:true});
 // Another tab must not silently overwrite the current library.
 const second=await context.newPage();await second.goto('http://localhost:8080/lab/');await second.locator('#name').fill('Otra pestaña');await page.waitForFunction(()=>document.querySelector('#library-status').textContent.includes('otra pestaña'));assert.deepEqual(errors,[]);
 // Corrupt input stays intact, even after an attempted edit.
 await second.close();await page.evaluate(()=>localStorage.setItem('wedo-lab-library-v2','corrupt'));await page.reload();await page.locator('#name').fill('No sobrescribir');assert.equal(await page.evaluate(()=>localStorage.getItem('wedo-lab-library-v2')),'corrupt');
 console.log('PASS: migración, catálogo y filtro, actividad, notas/progreso, duplicación, renombrado, búsqueda, borrado, móvil, conflicto y datos corruptos.');
}finally{await browser.close();}
