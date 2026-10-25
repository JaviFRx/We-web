import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('E:/CodeAdventur/node_modules/playwright-core');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
 await page.goto('http://localhost:8080/original/#/library');
 const docs=()=>page.getByRole('button',{name:'Documentación',exact:true}).click();
 const home=()=>page.getByRole('button',{name:'Mis proyectos',exact:true}).click();
 const addText=async text=>{await page.locator('.text-element').click();await page.locator('[contenteditable]').fill(text);await page.locator('[contenteditable]').press('Tab');await page.waitForFunction(async expected=>(await import('/original-editor.js')).getCurrentProject().native?.StudentDocumentationToolProject?.includes(expected),text);};
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await docs();await addText('DOC_A');await home();
 const keyA=await page.locator('.wedo-lobby-project-open').first().locator('..').getAttribute('data-project-id');
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();assert.equal(await page.locator('.wedo-original-editor.showing-content').count(),0);
 await docs();await page.locator('.text-element').waitFor();assert.equal(await page.locator('[contenteditable]').count(),0);await addText('DOC_B');await home();
 await page.locator(`[data-project-id="${keyA}"] .wedo-lobby-project-open`).click();await docs();await page.waitForFunction(()=>document.querySelector('[contenteditable]')?.textContent==='DOC_A');
 const imported=await page.evaluate(async()=>{
  const {getCurrentProject}=await import('/original-editor.js'),{serializeOriginalProject}=await import('/original-projects.js');
  const project=structuredClone(getCurrentProject());project.id=crypto.randomUUID();project.name='Imported C';
  project.native.StudentDocumentationToolProject=project.native.StudentDocumentationToolProject.replaceAll('DOC_A','DOC_C');
  return serializeOriginalProject(project);
 });
 await home();await page.locator('.wedo-lobby input[type=file]').setInputFiles({name:'C.proj',mimeType:'application/json',buffer:Buffer.from(imported)});
 await page.locator('.wedo-lobby').waitFor({state:'detached'});await docs();await page.waitForFunction(()=>document.querySelector('[contenteditable]')?.textContent==='DOC_C');
 await home();await page.locator(`[data-project-id="${keyA}"] .wedo-lobby-project-open`).click();await docs();await page.waitForFunction(()=>document.querySelector('[contenteditable]')?.textContent==='DOC_A');
 assert.deepEqual(errors,[]);console.log('Documentation ownership: new B, reopen A, import C, reopen A preserve separate native content.');
}finally{await browser.close();}
