import {chromium,browserOptions} from './browser-test-support.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.goto('http://localhost:8080/original/#/library');
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 await page.getByRole('button',{name:'Documentación',exact:true}).click();
 await page.waitForFunction(()=>typeof getProject==='function');
 await page.locator('.text-element').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
 await mkdir('analysis/verification/comparisons',{recursive:true});
 await page.screenshot({path:'analysis/verification/comparisons/34-documentation-web.png'});
 const metrics=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
  const selectors=['.base-frame','.documentation-tool','.project-view','.templates','.template','.text-element','.image-element','.video-element','.page-navigation','.pagination','.original-topbar','.wedo-original-topbar'];
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},selectors:Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].map(e=>({class:e.className,rect:rect(e),display:getComputedStyle(e).display,padding:getComputedStyle(e).padding,margin:getComputedStyle(e).margin}))])),buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().top<100).map(e=>({name:e.getAttribute('aria-label')||e.textContent,disabled:e.disabled,sprite:e.querySelector('img')?.getAttribute('src'),rect:rect(e)})),documentationElements:[...document.querySelectorAll('.documentation-tool *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e=>({tag:e.tagName,class:e.className,rect:rect(e)}))};
 });
 await writeFile('analysis/verification/comparisons/34-documentation-web-metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics.selectors,null,2));
}finally{await browser.close();}
