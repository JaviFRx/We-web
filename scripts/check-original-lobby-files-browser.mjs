import {chromium,browserOptions} from './browser-test-support.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch(browserOptions()),bytes=await readFile('analysis/verification/flows/project.wedo');
try{
 for(const method of ['shortcut','drop']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:8080/original/#/library');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).waitFor();
  assert.equal(await page.locator('.wedo-lobby').getByRole('button',{name:'Importar proyecto',exact:true}).count(),0);
  if(method==='shortcut'){const choosing=page.waitForEvent('filechooser');await page.keyboard.press('Control+O');const chooser=await choosing;await chooser.setFiles({name:'audit.wedo',mimeType:'application/zip',buffer:bytes});}
  else await page.locator('.wedo-lobby').evaluate((element,data)=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(data)],'audit.wedo',{type:'application/zip'}));element.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},[...bytes]);
  await page.locator('.wedo-lobby').waitFor({state:'detached'});assert.match(await page.evaluate(async()=>(await import('/original-editor.js')).getCurrentProject().native.StudentDocumentationToolProject),/Bundle proof/);assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage();await page.goto('http://localhost:8080/original/#/library');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).waitFor();
 await page.evaluate(async()=>{const catalog=await fetch('/original-assets.json').then(r=>r.json()),{showOriginalLobby}=await import('/original-lobby.js');window.exported=[];window.testLobby=showOriginalLobby({catalog,currentId:'a',projects:{a:{name:'Focused A'},b:{name:'Focused B'}},onExport:id=>exported.push(id)});});
 const lobby=page.locator('.wedo-lobby').last();await lobby.getByRole('button',{name:'Focused B',exact:true}).focus();await page.keyboard.press('Control+Shift+S');
 await lobby.focus();await page.keyboard.press('Control+Shift+S');assert.deepEqual(await page.evaluate(()=>exported),['b','a']);await page.close();
 console.log('PASS original Spanish lobby hides import tile; Ctrl+O and file drop each import an actual bundle with its documentation.');
}finally{await browser.close();}
