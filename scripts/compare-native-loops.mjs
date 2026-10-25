import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/runtime/loop-comparison';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions()),measurements=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto((process.env.WEDO_TEST_URL||'http://localhost:8080')+'/');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 for(const state of ['empty','child','count']){
  await page.evaluate(async state=>{const editor=await import('/original-editor.js'),r=await import('/original-runtime.js'),p=editor.getCurrentProject();const loop=r.createInstruction('Repeat');if(state!=='empty')loop.children=[r.createInstruction('WaitFor')];if(state==='count')loop.parameter=r.createParameter('NumberInput');p.name='Native loop comparison';p.strips=[{id:crypto.randomUUID(),x:1378/1.40625,y:147/1.40625,nodes:[loop]}];editor.saveCurrentProject();},state);
  await page.reload();await page.locator('.wedo-lobby-project-open').first().click();await page.waitForTimeout(450);await page.evaluate(()=>document.fonts.ready);
  const geometry=await page.evaluate(()=>Object.fromEntries(['.original-loop','.original-loop-shell','.original-loop-icon','.original-loop-inner','.original-loop .original-parameter'].map(selector=>[selector,[...document.querySelectorAll(selector)].map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};})])));
  measurements.push({state,geometry});await page.screenshot({path:`${directory}/web-loop-${state}.png`});
 }
 await writeFile(directory+'/web-measurements.json',JSON.stringify(measurements,null,2));console.log(JSON.stringify(measurements));
}finally{await browser.close();}
