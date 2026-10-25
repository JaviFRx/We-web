import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage(),errors=[];
 // Isolate the original Angular documentation + real adapter from hardware/editor initialization.
 const integrated=process.argv.includes('--integrated');
 if(!integrated)await page.route('**/original-editor.js',r=>r.fulfill({contentType:'text/javascript',body:'const project={native:{},name:"test"};export const getCurrentProject=()=>project;export const saveCurrentProject=()=>{window.saved=project};export const openProgramming=()=>{};'}));
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
 await page.goto('http://localhost:8080/original/#/'+(integrated?'library':'documentation'));
 if(integrated){await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByRole('button',{name:'Documentación',exact:true}).click();}
 await page.waitForFunction(()=>typeof getProject==='function');
 await page.locator('.text-element').click();await page.locator('[contenteditable]').fill('Texto de prueba original');
 await page.locator('[contenteditable]').press('Control+A');
 await page.locator('.wysiwyg-format-pane.active .font-5').click();
 assert.match(await page.locator('[contenteditable]').innerHTML(),/size="5"/);
 await page.locator('[contenteditable]').press('Tab');
 await page.waitForFunction(async()=>{const e=await import('/original-editor.js');return e.getCurrentProject()?.native?.StudentDocumentationToolProject?.includes('Texto de prueba original');});
 await page.evaluate(()=>unityEmitMessage('templateselector'));assert.equal(await page.locator('.template-thumb').count(),6);
 await page.locator('.template-thumb').nth(1).click();
 await page.evaluate(()=>unityEmitMessage('addPage'));
 await page.waitForFunction(()=>JSON.parse(getProject('t').slice('SAVEDATA_t@'.length)).sections[0].pages.length===2);
 await page.evaluate(()=>unityEmitMessage('deletePage'));
 await page.waitForTimeout(300);
 await page.screenshot({path:'analysis/documentation/browser-tested.png'});
 assert.deepEqual(errors,[]);console.log('Original documentation: text edit persisted, six native templates, page creation, no JS errors.');
}finally{await browser.close();}
