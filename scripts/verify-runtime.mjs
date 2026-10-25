import {spawn} from 'node:child_process';
import {mkdir,readdir,writeFile,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
const baseDirectory=path.resolve('analysis/verification/runtime'),runId=new Date().toISOString().replace(/[:.]/g,'-'),directory=path.join(baseDirectory,runId);await mkdir(directory,{recursive:true});
const tests=(await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name);
const tasks=[
 {id:'local-bluetooth',script:'check-local-bluetooth-browser.mjs',scope:'Native loopback scan/connect/GATT/button/disconnect transport, no chooser, foreign-origin rejection',mock:'Worker simulated; real radio scan recorded separately',captures:[],captureDirectory:'verification/local-bluetooth'},
 {id:'loop-baseline',script:'check-loop-baseline-browser.mjs',scope:'Common bottom attachment line for start, taller loop, child and continuation; preview, stable position, reload, zoom and detach',mock:'No hardware',captures:[],captureDirectory:'verification/loop-baseline'},
 {id:'bluetooth-discovery',script:'check-bluetooth-discovery-fallback-browser.mjs',scope:'Missing, empty and rejected saved permissions; known IO service; explicit recovery and unfiltered chooser',mock:'Simulated navigator.bluetooth and GATT; no physical scan',captures:[],captureDirectory:'verification/bluetooth-discovery'},
 {id:'proximity-commands',script:'check-proximity-and-commands-browser.mjs',scope:'Attachment proximity and zoom, live edited color through editor/runtime/GATT, wait keeps LED color, display continuation and visible write failures',mock:'Strict peripheral checks characteristic UUIDs, mode and WriteWithoutResponse; no physical hub',captures:[],captureDirectory:'verification/proximity-commands'},
 {id:'unit',args:['--test',...tests],scope:'All unit tests: runtime, cancellation, hardware packets, disconnect, native media/project roundtrip and constrained legacy NRBF Single[] parser',mock:'Synthetic drivers and inputs; no physical devices',captures:[]},
 {id:'bluetooth',script:'check-bluetooth-browser.mjs',scope:'Chooser cancel/disabled, three hubs, reconnect, disconnect and mobile panel',mock:'navigator.bluetooth and GATT simulated',captures:['bluetooth-panel.png']},
 {id:'editor-runtime',script:'check-original-editor-browser.mjs',scope:'Drag, parameters, loops, persistence reload, runtime driver execution, sound previews',mock:'Hardware driver methods replaced before execution',captures:['original-editor-desktop.png','original-editor-mobile.png','original-parameter-audio.png']},
 {id:'camera',script:'check-original-camera-browser.mjs',scope:'Canvas capture, video recording, close releases tracks',mock:'getUserMedia, MediaStream, MediaRecorder, media play mocked; screenshot content marked CAPTURA SIMULADA',captures:['original-camera-mock.png']},
 {id:'failures',script:'check-runtime-failures-browser.mjs',scope:'Camera denied/error/late grant cleanup; microphone denied; IndexedDB aborted transaction/recovery',mock:'Media permissions, recorder error and IDB put quota failure injected; real transaction rollback',captures:['runtime-camera-failure.png','runtime-audio-denied.png']},
 {id:'user-audio',script:'check-user-audio-browser.mjs',scope:'Native recording panel, trim, WAV, delete cancellation',mock:'Fixture PCM; microphone never requested and audio never played',captures:['original-user-audio.png']},
 {id:'display',script:'check-display-browser.mjs',scope:'Native dimensions, label truncation, resize, drag/clamp/snap, close',mock:'No hardware involved',captures:['original-display-pane.png']},
 {id:'storage',script:'check-storage-browser.mjs',scope:'Invalid legacy, migration, queued snapshots, media8MiB, reload, Blob/typed bytes',mock:'Isolated browser profile; real IndexedDB and localStorage',captures:[]},
 {id:'split-webview',script:'check-webview-browser.mjs',scope:'Activity Full/Half, service Quarter, dimensions, canvas/palette hit testing',mock:'Actual original Angular activity; no hardware',captures:['original-webview-split.png']},
 {id:'gestures',script:'check-original-gestures-browser.mjs',scope:'Palette horizontal scroll, native offset, complete tail drag, selective stop and cancellation',mock:'Synthetic project and drivers; no hardware',captures:[],captureDirectory:'verification/gestures'},
 {id:'settings-integrated',script:'check-original-settings-integrated-browser.mjs',scope:'Integrated settings controls, persistence and return to editor',mock:'No hardware',captures:[]},
 {id:'introduction',script:'check-original-introduction-browser.mjs',scope:'Native introduction sequence and Arabic layout',mock:'No hardware',captures:[],captureDirectory:'verification/flows'},
 {id:'lobby-files',script:'check-original-lobby-files-browser.mjs',scope:'Native project import/export and file shortcuts',mock:'Synthetic local project files',captures:[]},
 {id:'flows',script:'audit-original-flows-browser.mjs',scope:'Documentation, teacher resources, lobby navigation and failure cases',mock:'Browser fixtures; no hardware',captures:[],captureDirectory:'verification/flows'},
 {id:'original-activities',script:'check-original-browser.mjs',scope:'Original Angular library and 32 activity routes',mock:'Original local content; no hardware',captures:['original-library.png']},
 {id:'documentation-transitions',script:'check-original-documentation-transitions-browser.mjs',scope:'Native documentation modal transitions and controls',mock:'No hardware',captures:[]},
 {id:'comparison-gallery',script:'check-comparison-gallery.mjs',scope:'Comparison gallery links and screenshot availability',mock:'Previously captured visual evidence; no desktop control',captures:[]},
 {id:'lan',script:'check-original-lan-browser.mjs',scope:'Three isolated browser profiles: same-project delivery, isolation, stop/resume and no echo duplicates',mock:'Real loopback HTTP POST/SSE; UDP disabled; no physical devices',captures:[],captureDirectory:'verification/lan'},
 {id:'comments',script:'check-original-comments-browser.mjs',scope:'Native comment offset, bubble size, text spotlight, multiline input, reload and drag deletion',mock:'Synthetic text; no hardware',captures:[],captureDirectory:'verification/comments'},
 {id:'documentation-toolbar',script:'check-original-documentation-toolbar-browser.mjs',scope:'Native documentation toolbar visibility and state transitions',mock:'No hardware',captures:[]},
];
const results=[];
for(const task of tasks){
 const started=Date.now(),args=task.args||['scripts/'+task.script];console.log('RUN '+task.id);
 const result=await new Promise(resolve=>{
  const child=spawn(process.execPath,args,{env:process.env,windowsHide:true});let stdout='',stderr='',timedOut=false;
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  const timeout=setTimeout(()=>{timedOut=true;child.kill();},180000);
  child.on('error',error=>{clearTimeout(timeout);resolve({exitCode:null,stdout,stderr:stderr+error.stack,timedOut});});
  child.on('close',exitCode=>{clearTimeout(timeout);resolve({exitCode,stdout,stderr,timedOut});});
 });
 const status=result.exitCode===0&&!result.timedOut?'PASS':'FAIL';
 await writeFile(path.join(directory,task.id+'.log'),result.stdout+'\n'+result.stderr);
 const candidates=[...task.captures];if(task.captureDirectory){for(const name of await readdir(path.resolve('analysis',task.captureDirectory)))if(/\.(png|json|md)$/.test(name))candidates.push(task.captureDirectory+'/'+name);}
 const captures=[];for(const name of candidates){const source=path.resolve('analysis',name);try{if((await stat(source)).mtimeMs>=started){await copyFile(source,path.join(directory,task.id+'-'+path.basename(name)));captures.push(task.id+'-'+path.basename(name));}}catch{}}
 results.push({id:task.id,status,scope:task.scope,mock:task.mock,seconds:(Date.now()-started)/1000,exitCode:result.exitCode,timedOut:result.timedOut,log:task.id+'.log',captures});
 console.log(status+' '+task.id+' '+results.at(-1).seconds.toFixed(1)+'s');
 // Persist incrementally so interruption never discards a failed check.
 await writeFile(path.join(directory,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2));
}
const untested=['Real LEGO hub discovery, motor actuation and sensor notifications','Physical microphone and camera capture','Native UDP LAN interoperability (browser transport tested over real loopback POST/SSE)','Pixel equivalence against native desktop at matching viewport/state (root owns native desktop verification)'];
await writeFile(path.join(directory,'matrix.md'),'# Runtime verification\n\n'+results.map(result=>`- **${result.status} ${result.id}** — ${result.scope}. ${result.mock}. [Log](${result.log})${result.captures.map(name=>` · [Capture](${name})`).join('')}`).join('\n')+'\n\n## Untested\n\n'+untested.map(item=>'- '+item).join('\n')+'\n');
await writeFile(path.join(directory,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),results,untested},null,2));
await writeFile(path.join(baseDirectory,'latest.json'),JSON.stringify({runId,directory,results,untested},null,2));
process.exitCode=results.some(result=>result.status==='FAIL')?1:0;
