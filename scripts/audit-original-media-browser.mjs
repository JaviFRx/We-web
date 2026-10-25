import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,browserOptions} from './browser-test-support.mjs';
const base=process.env.WEDO_TEST_URL||'http://localhost:8080',videos=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(file.endsWith('.mp4'))videos.push('/original/'+path.relative('content/wedo',file).split(path.sep).map(encodeURIComponent).join('/'));}}
await walk('content/wedo');const catalog=await(await fetch(base+'/original-assets.json')).json();
const browser=await chromium.launch(browserOptions()),results=[];
try{
 const page=await browser.newPage();await page.goto(base+'/original/');
 for(const [id,sound] of Object.entries(catalog.sounds))results.push(await page.evaluate(async({id,url})=>{
  const ctx=new OfflineAudioContext(1,1,44100);try{const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);const buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(!(buffer.duration>0))throw Error('Empty audio');return {kind:'audio',id,url,status:'PASS',duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate};}catch(e){return {kind:'audio',id,url,status:'FAIL',error:e.message};}
 },{id,url:sound.url||sound}));
 for(const url of videos)results.push(await page.evaluate(url=>new Promise(resolve=>{
  const video=document.createElement('video');video.muted=true;video.preload='metadata';let timer;
  function finish(result){clearTimeout(timer);video.onloadedmetadata=video.onerror=null;video.removeAttribute('src');video.load();resolve({kind:'video',url,...result});}
  video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.videoWidth>0?{status:'PASS',duration:video.duration,width:video.videoWidth,height:video.videoHeight}:{status:'FAIL',error:'Invalid metadata'});
  video.onerror=()=>finish({status:'FAIL',error:video.error?.message||'Media decode failed'});timer=setTimeout(()=>finish({status:'FAIL',error:'Metadata timeout'}),10000);video.src=url;
 }),url));
 const summary={audio:results.filter(r=>r.kind==='audio').length,video:videos.length,failures:results.filter(r=>r.status==='FAIL'),method:'Offline audio decoding and muted video metadata; no playback, microphone, camera or hub used.',limits:'Does not validate every video frame or physical audio output.'};
 await mkdir('analysis/verification/media',{recursive:true});await writeFile('analysis/verification/media/results.json',JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary));process.exitCode=summary.failures.length?1:0;
}finally{await browser.close();}
