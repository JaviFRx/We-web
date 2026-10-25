import {spawn} from 'node:child_process';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const videos=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file);else if(/\.mp4$/i.test(file))videos.push(file);}}
await walk('content/wedo');
const results=[];
for(const file of videos){
 const result=await new Promise(resolve=>{
  const child=spawn(process.env.FFMPEG_PATH||'ffmpeg',['-nostdin','-v','error','-xerror','-i',file,'-map','0:v?','-map','0:a?','-f','null','-'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-12000);});
  child.once('error',error=>{clearTimeout(timer);resolve({file,status:'FAIL',error:error.message});});
  child.once('close',code=>{clearTimeout(timer);resolve({file,status:code===0&&!timedOut?'PASS':'FAIL',code,...(stderr?{stderr}:{}),...(timedOut?{error:'Decode timeout'}:{})});});
 });results.push(result);console.log(`${results.length}/${videos.length} ${result.status} ${path.basename(file)}`);
}
const summary={videos:videos.length,failures:results.filter(r=>r.status==='FAIL').length,method:'FFmpeg full video and audio stream decode to null output, with -xerror; no playback.',limits:'Verifies stream decoding, not visual equivalence or browser rendering of every frame.'};
await mkdir('analysis/verification/media',{recursive:true});await writeFile('analysis/verification/media/video-integrity.json',JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary));process.exitCode=summary.failures?1:0;
