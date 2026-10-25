import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/bluetooth-discovery';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions()),results=[];
try{
 for(const mode of ['missing','empty','rejected','known-io-service']){
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>{
   window.chooserCalls=0;window.discoveryOptions=[];const device=new EventTarget();device.id='grupo12';device.name='grupo 12';device.uuids=['00004f0e-1212-efde-1523-785feabcd123'];
   const characteristic={properties:{write:true},async writeValueWithResponse(){}};
   device.gatt={connected:false,async connect(){this.connected=true;return this;},async getPrimaryService(){return {async getCharacteristic(){return characteristic;}};},disconnect(){this.connected=false;device.dispatchEvent(new Event('gattserverdisconnected'));}};
   const bluetooth={async requestDevice(options){if(!navigator.userActivation.isActive)throw Error('Missing user activation');window.chooserCalls++;window.discoveryOptions.push(options);return device;}};
   if(mode!=='missing')bluetooth.getDevices=async()=>{if(mode==='rejected')throw Error('Permission list unavailable');return mode==='known-io-service'?[device]:[];};
   Object.defineProperty(navigator,'bluetooth',{configurable:true,value:bluetooth});
  },mode);
  await page.goto('http://localhost:8080/original/?bluetooth=web');await page.evaluate(async()=>{await (await import('/connection.js')).showConnectionCenter();});
  const panel=page.getByRole('dialog',{name:'Elige el hub inteligente'});await panel.waitFor();
  assert.equal(await page.evaluate(()=>window.chooserCalls),0,'opening the panel must not open a chooser');
  if(mode==='known-io-service'){
   await panel.getByRole('button',{name:'Actualizar hubs',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.chooserCalls),0,'known devices refresh directly');
   await panel.getByRole('button',{name:'grupo 12',exact:true}).click();
  }else{
   assert.equal(await panel.locator('[role=status]').isVisible(),true,'empty or failed permission restoration is explained');
   if(mode==='rejected')assert.match(await panel.locator('[role=status]').innerText(),/Permission list unavailable/);
   await panel.getByRole('button',{name:'Actualizar hubs',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.chooserCalls),1,'refresh recovers discovery when the saved list is unavailable');
  }
  await page.waitForFunction(()=>document.querySelector('.original-device[data-hub-index]'));
  assert.match(await panel.locator('[role=status]').innerText(),/Conectado a grupo 12/);
  await panel.getByRole('button',{name:'Desconectar grupo 12',exact:true}).click();
  await panel.getByRole('button',{name:'Buscar todos los dispositivos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.original-device[data-hub-index]'));
  const options=await page.evaluate(()=>window.discoveryOptions.at(-1));assert.equal(options.acceptAllDevices,true);assert.equal(options.filters,undefined);
  await page.screenshot({path:`${directory}/${mode}.png`});assert.deepEqual(errors,[]);results.push({mode,status:'PASS'});await page.close();
 }
 await writeFile(directory+'/results.json',JSON.stringify({results,hardware:'Simulated GATT; actual radio discovery not established by this test.'},null,2));console.log('PASS missing, empty, rejected and IO-only remembered permissions; chooser fallback, connection and unfiltered discovery.');
}finally{await browser.close();}
