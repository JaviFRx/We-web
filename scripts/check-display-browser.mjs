import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/original-display.js',route=>readFile(new URL('../web/original-display.js',import.meta.url),'utf8').then(body=>route.fulfill({contentType:'text/javascript',body})));
 await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');await page.getByRole('button',{name:'Volver al programa',exact:true}).click();
 await page.evaluate(async()=>{const {createOriginalDisplay}=await import('/original-display.js'),catalog=await(await fetch('/original-assets.json')).json();window.displayModes=[];
  const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',width:'1024px',height:'768px',zIndex:'5000',pointerEvents:'none'});document.body.append(host);
  window.testDisplay=createOriginalDisplay({catalog,onModeChange:mode=>window.displayModes.push(mode)});window.testDisplay.element.style.pointerEvents='auto';window.testDisplay.element.id='test-display';host.append(window.testDisplay.element);window.testDisplay.update({shown:true,fullscreen:false,label:'a'.repeat(60),background:'1'});
 });
 const display=page.locator('#test-display');await display.waitFor();assert.equal(await display.locator('output').innerText(),'a'.repeat(50)+'..');
 let rect=await display.boundingBox();assert.ok(Math.abs(rect.width-440.8)<.05);assert.ok(Math.abs(rect.height-275.5)<.05);assert.ok(Math.abs(rect.y-(384-30-275.5/2))<.05);
 await display.getByRole('button',{name:'Ampliar pantalla'}).click();await page.waitForFunction(()=>Math.abs(document.querySelector('#test-display').getBoundingClientRect().width-881.6)<.05);
 assert.equal(await page.evaluate(()=>window.displayModes.at(-1)),'DisplayLarger');
 await display.getByRole('button',{name:'Reducir pantalla'}).click();await page.waitForFunction(()=>Math.abs(document.querySelector('#test-display').getBoundingClientRect().width-440.8)<.05);
 rect=await display.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(0,0,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>{const rect=document.querySelector('#test-display').getBoundingClientRect();return Math.abs(rect.x-10)<.05&&Math.abs(rect.y-75)<.05;});
 await page.screenshot({path:'analysis/original-display-pane.png'});await display.getByRole('button',{name:'Cerrar pantalla'}).click();assert.equal(await display.isVisible(),false);assert.equal(await page.evaluate(()=>window.displayModes.at(-1)),'DisplayHide');assert.deepEqual(errors,[]);
 console.log('PASS: DisplayPane tamaños nativos, truncado50, resize/close, arrastre y snap con margen10/topbar65.');
}finally{await browser.close();}
