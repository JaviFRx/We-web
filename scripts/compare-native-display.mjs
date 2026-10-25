import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/runtime/display-comparison';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 await page.evaluate(async()=>{const editor=await import('/original-editor.js'),runtime=await import('/original-runtime.js'),storage=await import('/original-storage.js');const project=editor.getCurrentProject();project.name='Native display comparison';project.strips=[{id:crypto.randomUUID(),x:228/1.40625,y:229/1.40625,nodes:[runtime.createInstruction('Start'),runtime.createInstruction('Display')]}];editor.saveCurrentProject();await storage.loadOriginalLibrary();});
 await page.reload();await page.locator('.wedo-lobby-project-open').first().click();await page.getByRole('button',{name:'Inicio',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.original-display output')?.textContent==='123');await page.waitForTimeout(500);
 await page.evaluate(()=>{document.querySelector('.original-palette').scrollLeft=68.5;});
 const measurement=await page.locator('.original-display').evaluate(element=>{const rect=element.getBoundingClientRect(),output=element.querySelector('output'),label=output.firstChild.getBoundingClientRect();return {display:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},label:{x:label.x,y:label.y,width:label.width,height:label.height},font:getComputedStyle(output).fontFamily,fontSize:getComputedStyle(output).fontSize,labelText:output.textContent};});
 await page.screenshot({path:directory+'/web-display-123.png'});await writeFile(directory+'/web-measurements.json',JSON.stringify(measurement,null,2));console.log(JSON.stringify(measurement));
 await page.getByRole('button',{name:'Ampliar pantalla',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:directory+'/web-display-large-123.png'});
}finally{await browser.close();}
