import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const baseURL=process.env.WEDO_TEST_URL||'http://localhost:8080';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push([r.status(),r.url()]);});
 await page.goto(baseURL+'/');await page.getByRole('button',{name:'Volver al programa',exact:true}).click();await page.getByRole('button',{name:'Biblioteca de proyectos',exact:true}).click();await page.getByText('1. Fuerzas',{exact:true}).waitFor();assert.match(page.url(),/original/);
 await page.getByText('1. Fuerzas',{exact:true}).click();await page.getByText('Ir',{exact:true}).click();await page.locator('.page-right-arrow').waitFor();
 await page.waitForFunction(()=>document.body.innerText.includes('Max'));
 const before=await page.locator('body').innerText();await page.locator('.page-right-arrow').click();await page.waitForFunction(()=>document.body.innerText.includes('fricción'));assert.notEqual(await page.locator('body').innerText(),before);
 const catalog=await (await fetch(baseURL+'/original/library.json')).json();
 let checked=0;
 for(const key of ['guided','open','getting.started','thinking.guided','thinking.open','activities.introduction'])for(const a of catalog[key].flat(Infinity)){
  await page.goto(baseURL+'/original/#/library/project/'+a.id);
  await page.waitForFunction(id=>{const route=angular.element(document.documentElement).injector().get('$route');return route.current?.locals?.Project?.id===id;},a.id);
  await page.locator('.project-view').waitFor();
  await page.waitForFunction(()=>document.querySelector('.template-container')?.children.length>0);
  // LAN keeps an SSE response open: wait for rendered activity assets, not network idle.
  await page.waitForFunction(()=>[...document.querySelectorAll('.template-container img')].every(image=>image.complete&&(image.naturalWidth>0||!image.getAttribute('src'))));checked++;
 }
 assert.equal(checked,32);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await mkdir('analysis',{recursive:true});
 await page.goto(baseURL+'/original/#/library');await page.getByText('1. Fuerzas',{exact:true}).waitFor();await page.screenshot({path:'analysis/original-library.png',fullPage:true});
 assert.equal((await fetch(baseURL+'/original/build/js/build.min.js',{headers:{Range:'bytes=0-19'}})).status,206);
 assert.equal((await fetch(baseURL+'/original/%2e%2e%5cserver.mjs')).status,403);
 console.log('PASS: visor original, 32 actividades, avance de lección, sin errores JS/HTTP observados, rangos y bloqueo de rutas externas.');
}finally{await browser.close();}
