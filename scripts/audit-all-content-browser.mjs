import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const base=process.env.WEDO_TEST_URL||'http://localhost:8080';
const directory='analysis/verification/all-content';await mkdir(directory,{recursive:true});
const entries=[],seen=new Set();
function add(items,kind){for(const item of items){if(!seen.has(item.id)){entries.push({id:item.id,name:item.name,kind});seen.add(item.id);}add(item.subProjects||[],kind);}}
const library=await(await fetch(base+'/original/library.json')).json();
for(const key of ['guided','open','getting.started','thinking.guided','thinking.open','activities.introduction'])add(library[key].flat(Infinity),'library');
for(const kind of ['models','programs'])add(await(await fetch(base+'/original/'+kind+'.json')).json(),kind);
const browser=await chromium.launch(browserOptions()),results=[],errors=[],httpErrors=[],resources=new Set();
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push({url:page.url(),error:e.message}));
 page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(base+'/original/#/library');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByRole('button',{name:'Biblioteca de proyectos',exact:true}).click();
 for(const entry of entries){
  const result={...entry,pages:[],status:'PASS'};results.push(result);
  try{
   await page.goto(`${base}/original/#/${entry.kind}/project/${entry.id}`);
   await page.waitForFunction(id=>angular.element(document.documentElement).injector().get('$route').current?.locals?.Project?.id===id,entry.id);
   await page.waitForTimeout(100);
   const pages=await page.evaluate(()=>angular.element(document.documentElement).injector().get('$route').current.locals.Project.sections.flatMap(s=>s.pages).map(p=>({id:p.GUID,template:p.template_id})));
   if(await page.locator('.page-ball-container').count()!==pages.length)throw Error('Navigation count differs from original project pages');
   for(let index=0;index<pages.length;index++){
    await page.locator('.page-ball-container').nth(index).click();
    await page.waitForFunction(i=>document.querySelectorAll('.page-ball-container')[i]?.querySelector('.current-page'),index);
    await page.waitForFunction(()=>document.querySelector('.template-container')?.children.length>0);
    await page.waitForFunction(()=>!document.querySelector('.templates .ng-enter,.templates .ng-leave,.templates .ng-animate'));
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    await page.waitForFunction(()=>[...document.querySelectorAll('.template-container img')].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0));
    const assets=await page.evaluate(async()=>{
     const elements=[...document.querySelectorAll('.template-container,.template-container *')];
     const backgrounds=[...new Set(elements.flatMap(e=>[getComputedStyle(e),getComputedStyle(e,'::before'),getComputedStyle(e,'::after')]).flatMap(style=>[...style.backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)].map(match=>new URL(match[1],location.href).href)))];
     await Promise.all(backgrounds.map(src=>new Promise((resolve,reject)=>{const img=new Image();const timer=setTimeout(()=>reject(Error('Background image timeout: '+src)),10000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Background image failed: '+src));};img.src=src;})));
     return [...new Set([...backgrounds,...elements.flatMap(e=>[e.src,e.poster,e.href]).filter(Boolean)])];
    });
    for(const url of assets)if(url.startsWith(base+'/'))resources.add(url);
    const capture=`${entry.kind}-${entry.id}-${String(index+1).padStart(2,'0')}.png`;
    await page.screenshot({path:directory+'/'+capture});result.pages.push({...pages[index],capture,assets:assets.length});
   }
  }catch(error){result.status='FAIL';result.error=error.message;await page.screenshot({path:directory+'/'+entry.id+'-FAIL.png'}).catch(()=>{});}
  await writeFile(directory+'/results.json',JSON.stringify({results,errors,httpErrors},null,2));
  if(results.length%10===0)console.log(`${results.length}/${entries.length} projects; ${results.reduce((n,r)=>n+r.pages.length,0)} pages; ${results.filter(r=>r.status==='FAIL').length} failures`);
 }
 const resourceFailures=[];for(const url of resources){const response=await fetch(url,{method:'HEAD'});if(!response.ok)resourceFailures.push({url,status:response.status});}
 const summary={projects:results.length,pages:results.reduce((n,r)=>n+r.pages.length,0),templates:[...new Set(results.flatMap(r=>r.pages.map(p=>p.template)))],resources:resources.size,failedProjects:results.filter(r=>r.status==='FAIL').length,errors,httpErrors,resourceFailures,limitations:['Screenshots are web captures, not proof of native equivalence.','Videos are not played; media URLs are checked without hardware.','Slideshow inner frames are not all traversed.']};
 await writeFile(directory+'/results.json',JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary));
 process.exitCode=summary.failedProjects||errors.length||httpErrors.length||resourceFailures.length?1:0;
}finally{await browser.close();}
