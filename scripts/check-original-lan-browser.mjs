import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/lan';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions()),errors=[];
const projectId='b7256927-aa91-4f07-b403-5275d278456a';
async function setup(sender,id){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 await page.evaluate(async({sender,id})=>{const editor=await import('/original-editor.js'),r=await import('/original-runtime.js'),storage=await import('/original-storage.js'),p=editor.getCurrentProject();p.id=id;p.name=sender?'LAN sender':'LAN receiver';
 const send=r.createInstruction('SendMessage'),receive=r.createInstruction('StartOnMessage'),display=r.createInstruction('Display');send.parameter.value=receive.parameter.value='42';display.parameter.value='Network proof';
 p.strips=[{id:'listener',x:150,y:350,nodes:[receive,display]}];if(sender)p.strips.push({id:'sender',x:150,y:170,nodes:[r.createInstruction('Start'),send]});editor.saveCurrentProject();await storage.loadOriginalLibrary();},{sender,id});
 const connection=page.waitForResponse(r=>r.url().includes('/api/original-lan/events?project='+id));await page.reload();await page.locator('.wedo-lobby-project-open').first().click();assert.equal((await connection).status(),200);
 await page.evaluate(async()=>{const {OriginalRuntime}=await import('/original-runtime.js');const original=OriginalRuntime.prototype.message;window.receivedMessages=[];OriginalRuntime.prototype.message=function(text){window.receivedMessages.push(text);return original.call(this,text);};});return page;
}
try{
 const sender=await setup(true,projectId),receiver=await setup(false,projectId),other=await setup(false,'11111111-1111-4111-8111-111111111111');
 await receiver.waitForTimeout(1100);await sender.getByRole('button',{name:'Inicio',exact:true}).click();
 await receiver.waitForFunction(()=>document.querySelector('.original-display output')?.textContent==='Network proof');
 await sender.waitForFunction(()=>document.querySelector('.original-display output')?.textContent==='Network proof');
 assert.deepEqual(await receiver.evaluate(()=>receivedMessages),['42']);assert.deepEqual(await sender.evaluate(()=>receivedMessages),['42'],'server echo does not trigger duplicate local message');assert.deepEqual(await other.evaluate(()=>receivedMessages),[],'another project cannot receive messages');
 await receiver.screenshot({path:directory+'/01-real-sse-receiver.png'});await sender.waitForFunction(()=>!document.querySelector('.original-block.executing'));
 await receiver.getByRole('button',{name:'Detener programas',exact:true}).click();await sender.getByRole('button',{name:'Inicio',exact:true}).click();
 await sender.waitForTimeout(650);assert.deepEqual(await receiver.evaluate(()=>receivedMessages),['42'],'stop suppresses messages for one second');
 await receiver.waitForTimeout(500);await sender.getByRole('button',{name:'Inicio',exact:true}).click();
 await receiver.waitForFunction(()=>receivedMessages.length===2);assert.deepEqual(errors,[]);
 await writeFile(directory+'/results.json',JSON.stringify({status:'PASS',transport:'Real HTTP POST and SSE over loopback, three isolated browser profiles',checks:['same project delivery','other project isolation','exactly one local delivery','stop suppresses for one second','delivery resumes'],udp:'not enabled',physicalDevices:'not used'},null,2));console.log('PASS real browser SSE/POST, same-project isolation, no local echo duplication and stop/resume.');
}finally{await browser.close();}
