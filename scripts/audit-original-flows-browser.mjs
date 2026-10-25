import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/flows';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions()),results=[];
const base=process.env.WEDO_TEST_URL||'http://localhost:8080';
async function scenario(id,title,fn,viewport={width:1366,height:768}){
 const page=await browser.newPage({viewport}),errors=[];page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{errors.push(dialog.message());await dialog.dismiss();});
 const shot=async name=>{if(await page.locator('.wedo-teacher-resources').count())await page.waitForFunction(()=>document.querySelector('.wedo-teacher-resources')?.dataset.transition==='complete');await page.screenshot({path:`${directory}/${id}-${name}.png`});};
 try{await page.goto(base+'/original/#/library');const detail=await fn(page,shot);assert.deepEqual(errors,[]);results.push({id,title,status:'PASS',detail});}
 catch(error){await shot('FAIL').catch(()=>{});results.push({id,title,status:'FAIL',error:error.message,errors});}
 finally{await page.close();await writeFile(directory+'/matrix.json',JSON.stringify(results,null,2));}
}
const create=page=>page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
const home=page=>page.getByRole('button',{name:'Mis proyectos',exact:true}).click();
const docs=page=>page.getByRole('button',{name:'Documentación',exact:true}).click();
const current=page=>page.evaluate(async()=>structuredClone((await import('/original-editor.js')).getCurrentProject()));
const waitSaved=(page,text)=>page.waitForFunction(async expected=>(await import('/original-editor.js')).getCurrentProject()?.native?.StudentDocumentationToolProject?.includes(expected),text);
try{
 await scenario('01','Project rename, duplicate, cancel/delete, reload persistence',async(page,shot)=>{
  await create(page);const source=await page.locator('.original-palette-block[data-type=Display]').boundingBox(),start=await page.locator('.original-block').first().boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(start.x+start.width-2,start.y+35,{steps:16});await page.mouse.up();
  await page.locator('.original-block input').fill('741');await page.locator('.original-block input').press('Tab');
  const original=await current(page);await home(page);let card=page.locator('.wedo-lobby-tile[aria-current=true]');
  await card.getByRole('button',{name:'Editar proyecto'}).click();await card.getByRole('textbox',{name:'Nombre del proyecto'}).fill('Audit A');await card.getByRole('button',{name:'Aceptar',exact:true}).click();
  await card.getByRole('button',{name:'Editar proyecto'}).click();await card.getByRole('button',{name:'Duplicar proyecto'}).click();
  await page.getByRole('button',{name:'Audit A (2)',exact:true}).waitFor();await shot('duplicated');
  await page.getByRole('button',{name:'Audit A (2)',exact:true}).click();const copy=await current(page);
  assert.notEqual(copy.id,original.id);assert.equal(copy.strips.flatMap(s=>s.nodes).find(n=>n.type==='Display').parameter.value,'741');
  await home(page);card=page.locator('.wedo-lobby-tile').filter({has:page.getByRole('button',{name:'Audit A (2)',exact:true})});
  await card.getByRole('button',{name:'Editar proyecto'}).click();await card.getByRole('button',{name:'Eliminar proyecto'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'No',exact:true}).click();assert.equal(await card.locator('.wedo-lobby-edit').count(),0);
  await card.getByRole('button',{name:'Editar proyecto'}).click();await card.getByRole('button',{name:'Eliminar proyecto'}).click();await shot('delete-confirm');await page.getByRole('alertdialog').getByRole('button',{name:'Sí',exact:true}).click();
  await page.getByRole('button',{name:'Audit A (2)',exact:true}).waitFor({state:'detached'});await page.reload();await page.getByRole('button',{name:'Audit A',exact:true}).click();
  assert.equal((await current(page)).strips.flatMap(s=>s.nodes).find(n=>n.type==='Display').parameter.value,'741');await shot('reloaded');return {renamed:'Audit A',copyHasDistinctId:true,valueAfterReload:'741'};
 });
 await scenario('02','Documentation text/font, lock/unlock, save/reload',async(page,shot)=>{
  await create(page);await docs(page);await page.locator('.text-element').click();await page.locator('[contenteditable]').fill('Texto independiente 42');await page.locator('[contenteditable]').press('Control+A');await page.locator('.wysiwyg-format-pane.active .font-5').click();await page.locator('[contenteditable]').press('Tab');await waitSaved(page,'Texto independiente 42');
  assert.match((await current(page)).native.StudentDocumentationToolProject,/size=\\"5\\"/);await page.getByRole('button',{name:'Bloquear documentación'}).click();await page.locator('[contenteditable]').waitFor({state:'detached'});assert.equal((await current(page)).native.SDTLockedState,true);await shot('locked');
  await page.getByRole('button',{name:'Desbloquear documentación'}).click();await page.locator('[contenteditable]').waitFor();assert.equal(await page.locator('[contenteditable]').innerText(),'Texto independiente 42');await page.reload();await page.waitForFunction(()=>document.querySelector('[contenteditable]')?.textContent==='Texto independiente 42');await shot('restored');return {text:'Texto independiente 42',size:5,lockPersists:true};
 });
 await scenario('03','Documentation original templates, media and independent pages',async(page,shot)=>{
  await create(page);await docs(page);await page.getByRole('button',{name:'Plantilla de página'}).click();assert.equal(await page.locator('.template-thumb').count(),6);await page.locator('.template-thumb').nth(1).click();await page.locator('.template-selector .close').click();
  await page.locator('.text-element').first().click();await page.locator('[contenteditable]').fill('Page one');await page.locator('[contenteditable]').press('Tab');
  const chooser=page.waitForEvent('filechooser');await page.locator('.image-element').last().click();await(await chooser).setFiles({name:'pixel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64')});await waitSaved(page,'data:image/png');
  await page.getByRole('button',{name:'Añadir página'}).click();await page.locator('.text-element').first().click();await page.locator('[contenteditable]').fill('Page two');await page.locator('[contenteditable]').press('Tab');await waitSaved(page,'Page two');
  const saved=JSON.parse((await current(page)).native.StudentDocumentationToolProject);assert.equal(saved.sections[0].pages.length,2);assert.match(JSON.stringify(saved.sections[0].pages[0]),/Page one/);assert.match(JSON.stringify(saved.sections[0].pages[0]),/data:image\/png/);assert.match(JSON.stringify(saved.sections[0].pages[1]),/Page two/);await shot('page2');return {templates:6,pages:2,imageSaved:true};
 });
 await scenario('04','Original documentation JPEG and PDF export content',async(page,shot)=>{
  await create(page);await docs(page);await page.locator('.text-element').click();await page.locator('[contenteditable]').fill('Exportable documentation');await page.locator('[contenteditable]').press('Tab');
  const sizes={};for(const type of ['image','pdf']){
   await page.getByRole('button',{name:'Exportar documentación'}).click();const downloading=page.waitForEvent('download',{timeout:20000});await page.locator('.export-'+type).click();const download=await downloading;const file=`${directory}/export-documentation.${type==='image'?'jpg':'pdf'}`;await download.saveAs(file);const data=await readFile(file);sizes[type]=data.length;assert.ok(data.length>100);if(type==='pdf')assert.equal(data.subarray(0,4).toString(),'%PDF');else{assert.equal(data.subarray(0,3).toString('hex'),'ffd8ff');assert.match(download.suggestedFilename(),/\.jpg$/);
    const pixel=await page.evaluate(async uri=>{const image=new Image();image.src=uri;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return [...context.getImageData(image.width/2,image.height-3,1,1).data];},'data:image/jpeg;base64,'+data.toString('base64'));assert.ok(pixel.slice(0,3).every(channel=>channel>240),'exported blank page bottom must remain white, not clipped black');
   }await page.locator('.modal').waitFor({state:'detached'});
  }await shot('exported');return sizes;
 });
 await scenario('05','Native project bundle download/import preserves documentation',async(page,shot)=>{
  await create(page);await docs(page);await page.locator('.text-element').click();await page.locator('[contenteditable]').fill('Bundle proof');await page.locator('[contenteditable]').press('Tab');await waitSaved(page,'Bundle proof');await home(page);
  const card=page.locator('.wedo-lobby-tile[aria-current=true]');await card.getByRole('button',{name:'Editar proyecto'}).click();assert.equal(await card.getByRole('button',{name:'Exportar proyecto'}).count(),0);const downloading=page.waitForEvent('download');await page.keyboard.press('Control+Shift+S');const download=await downloading,file=directory+'/project.wedo';await download.saveAs(file);const bytes=await readFile(file);assert.equal(bytes.subarray(0,2).toString(),'PK');
  await page.locator('.wedo-lobby input[type=file]').setInputFiles(file);await page.locator('.wedo-lobby').waitFor({state:'detached'});await docs(page);await page.waitForFunction(()=>document.querySelector('[contenteditable]')?.textContent==='Bundle proof');await shot('imported');return {bundleBytes:bytes.length,restoredText:'Bundle proof'};
 });
 await scenario('06','Teacher original menu and all five slides',async(page,shot)=>{
  await page.getByRole('button',{name:'Recursos para el profesor',exact:true}).click();const dialog=page.locator('.wedo-teacher-resources');await dialog.waitFor({state:'visible'});assert.equal(await dialog.getByRole('link').count(),3);await shot('menu');await dialog.getByRole('button',{name:'Sugerencias y consejos para la clase'}).click();
  const titles=[];for(let i=1;i<=5;i++){await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));titles.push(await dialog.locator('[data-original-name=PageTitleText]').innerText());await shot('slide'+i);if(i<5)await dialog.getByRole('button',{name:'Página siguiente'}).click();}assert.equal(new Set(titles).size,5);await dialog.getByRole('button',{name:'Cerrar recursos'}).click();await dialog.getByRole('button',{name:'Cerrar recursos'}).click();await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).waitFor();return {pages:5,externalLinksOpened:false,titles};
 });
 results.push({id:'07',title:'Physical Bluetooth, camera and microphone',status:'UNTESTED',reason:'No physical hardware permitted in this audit; separate mocked tests do not establish device behavior.'});
}finally{
 await browser.close();await writeFile(directory+'/matrix.json',JSON.stringify(results,null,2));
 await writeFile(directory+'/matrix.md',results.map(r=>`- ${r.status} ${r.id}: ${r.title}${r.error?' — '+r.error.split('\n')[0]:''}`).join('\n')+'\n');console.log(JSON.stringify(results,null,2));
}
