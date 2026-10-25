import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/loop-baseline';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 await page.evaluate(async()=>{const e=await import('/original-editor.js'),r=await import('/original-runtime.js'),p=e.getCurrentProject(),loop=r.createInstruction('Repeat');loop.parameter=null;loop.children=[r.createInstruction('Light')];loop.children[0].parameter.value='8';p.strips=[{id:'start',x:180,y:220,nodes:[r.createInstruction('Start')]},{id:'loop',x:600,y:200,nodes:[loop,r.createInstruction('DisplayAdd')]}];await e.saveCurrentProject();});
 await page.reload();await page.locator('.wedo-lobby-project-open').first().click();
 const start=page.locator('[data-strip=start] > .original-block').first(),loop=page.locator('.original-world .original-loop');
 const a=await start.boundingBox(),b=await loop.boundingBox();
 await page.mouse.move(b.x+20,b.y+10);await page.mouse.down();await page.mouse.move(a.x+a.width+20+8,a.y+a.height-b.height+10,{steps:15});
 assert.equal(await page.locator('.original-snap-target').count(),1);
 const ghost=await page.locator('.original-dragging').boundingBox();assert.ok(Math.abs(ghost.y+ghost.height-a.y-a.height)<1,'preview uses bottom edge');
 await page.screenshot({path:directory+'/01-preview.png'});await page.mouse.up();
 async function aligned(){const boxes=await page.locator('.original-world .original-block').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));assert.ok(Math.max(...boxes.map(b=>b.bottom))-Math.min(...boxes.map(b=>b.bottom))<1,'start, loop, inner light and continuation share a baseline');return boxes;}
 await aligned();assert.ok(Math.abs((await start.boundingBox()).y-a.y)<1,'adding taller loop must not move the existing start');
 await page.screenshot({path:directory+'/02-joined.png'});
 await page.reload();await page.locator('.wedo-lobby-project-open').first().click();await aligned();
 await page.getByRole('button',{name:'Acercar programa',exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.original-world')).transform.startsWith('matrix(1.5,'));await aligned();
 await page.screenshot({path:directory+'/03-zoom150.png'});
 const before=await start.boundingBox(),lift=await loop.boundingBox();await page.mouse.move(lift.x+20,lift.y+10);await page.mouse.down();await page.mouse.move(950,430,{steps:15});await page.mouse.up();
 assert.ok(Math.abs((await start.boundingBox()).y-before.y)<1,'detaching loop preserves start position');
 const tail=await page.locator('.original-strip').last().locator(':scope > .original-block').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().bottom));assert.ok(Math.abs(tail[0]-tail[1])<1,'detached mixed-height tail retains baseline');
 assert.deepEqual(errors,[]);console.log('PASS bottom alignment: preview, start/loop/child/tail, stable existing position, reload, zoom and detach.');
}finally{await browser.close();}
