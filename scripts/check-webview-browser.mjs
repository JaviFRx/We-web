import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>{errors.push(dialog.message());dialog.dismiss();});
 await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');
 await page.getByRole('button',{name:'Volver al programa',exact:true}).click();
 await page.evaluate(()=>{
  const handler=angular.element(document.documentElement).injector().get('CommunicationHandler.wsa'),process=handler.processQueue.bind(handler);
  window.webViewMessages=[];handler.processQueue=message=>{if(message.startsWith('UpdateWebViewSize?'))window.webViewMessages.push(message);return process(message);};
 });
 await page.getByRole('button',{name:'Biblioteca de proyectos',exact:true}).click();
 await page.getByText('1. Fuerzas',{exact:true}).click();await page.getByText('Ir',{exact:true}).click();
 await page.locator('.page-right-arrow').waitFor();
 await page.locator('.page-right-arrow').click();
 const sizes=await page.evaluate(()=>{
  const injector=angular.element(document.documentElement).injector(),templates=injector.get('TemplateService');
  const find=scope=>{if(scope.project&&typeof scope.gotoPage==='function')return scope;for(let child=scope.$$childHead;child;child=child.$$nextSibling){const found=find(child);if(found)return found;}};
  const scope=find(injector.get('$rootScope'));
  window.activityScope=scope;window.activityPages=scope.project.sections.flatMap(section=>section.pages).flatMap(page=>page.branches?Object.values(page.branches):[page]).filter(page=>page&&page.template_id!==undefined);
  return [...new Set(window.activityPages.map(page=>templates.getTemplateSize(templates.getTemplate(page.template_id))))];
 });
 assert.ok(sizes.includes('Half')&&sizes.includes('Full'),JSON.stringify(sizes));
 async function navigate(size){
  await page.evaluate(size=>{
   // Shipped desktop Config.useConnectionCenter maps template12 to Full.
   // Quarter is therefore checked through the original service/bridge contract,
   // while Full and Half are emitted by actual activity page navigation.
   if(size==='Quarter'){angular.element(document.documentElement).injector().get('UnityMessageService').pageSize(size);return;}
   const templates=angular.element(document.documentElement).injector().get('TemplateService'),target=window.activityPages.find(page=>templates.getTemplateSize(templates.getTemplate(page.template_id))===size);
   window.activityScope.$apply(()=>window.activityScope.gotoPage(target));
  },size);
  const height={Full:707,Half:260,Quarter:427}[size];
  await page.waitForFunction(({size,height})=>window.webViewMessages.at(-1)==='UpdateWebViewSize?Size='+size&&document.body.style.getPropertyValue('--webview-height')===Math.floor(innerHeight*height/768)+'px',{size,height});
  const bounds=await page.locator('.base-frame').boundingBox();assert.ok(bounds,'web frame visible');
  const viewport=page.viewportSize();assert.equal(bounds.x,0);assert.equal(bounds.width,viewport.width);assert.equal(bounds.y,Math.ceil(viewport.height*61/768));assert.equal(bounds.height,Math.floor(viewport.height*height/768));
  if(size!=='Full'){
   const palette=page.locator('.original-palette');assert.equal(await palette.isVisible(),true);
   const box=await palette.boundingBox();assert.ok(box.y>=bounds.y+bounds.height,'palette remains below activity');
   const button=palette.locator('button').first();await button.click({trial:true});
   const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.original-palette')!==null,{x:box.x+30,y:box.y+box.height/2});assert.equal(hit,true,'palette receives pointers');
   const canvasHit=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.original-canvas'),{x:viewport.width/2,y:(bounds.y+bounds.height+box.y)/2});assert.equal(canvasHit,true,'exposed canvas receives pointers');
  }else assert.equal(await page.locator('.original-palette').isVisible(),false);
 }
 for(const size of ['Half','Quarter','Full','Half'])await navigate(size);
 await page.setViewportSize({width:1024,height:768});await navigate('Quarter');
 await page.screenshot({path:'analysis/original-webview-split.png'});
 assert.deepEqual(errors,[]);console.log('PASS: actividad Fuerzas emite Full/Half, servicio original emite Quarter; límites nativos, resize y paleta accesible debajo.');
}finally{await browser.close();}
