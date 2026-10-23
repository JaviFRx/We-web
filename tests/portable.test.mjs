import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

test('serves bundled activities and video without an installation or content override', {timeout:20000}, async () => {
  const env={...process.env,PORT:'0'};
  delete env.WEDO_CONTENT_ROOT;
  const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{
    cwd:tmpdir(),env,stdio:['ignore','pipe','pipe']
  });
  const exited=once(child,'exit');
  let output='';
  try {
    const base=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Server startup timed out: '+output)),10000);
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.stderr.on('data',data=>{output+=data;});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error(output));});
      child.stdout.on('data',data=>{
        output+=data;
        const match=output.match(/http:\/\/localhost:\d+/);
        if(match){clearTimeout(timer);resolve(match[0]);}
      });
    });
    const home=await fetch(base);
    assert.equal(home.status,200);
    assert.match(await home.text(),/\/original\/bridge.js/);
    const catalog=await (await fetch(base+'/original/library.json')).json();
    assert.equal(['guided','open','getting.started','thinking.guided','thinking.open','activities.introduction']
      .flatMap(key=>catalog[key].flat(Infinity)).length,32);
    const video=await fetch(base+'/original/projects/5a6d599b/movies/35d599bf/small.raw.mp4.mp4',{
      headers:{Range:'bytes=0-31'}
    });
    assert.equal(video.status,206);
    assert.equal(video.headers.get('content-type'),'video/mp4');
    assert.equal((await video.arrayBuffer()).byteLength,32);
    assert.equal((await fetch(base+'/original/%2e%2e%5cserver.mjs')).status,403);
    assert.equal((await fetch(base+'/lab/')).status,200);
  } finally {
    child.kill();
    await exited;
  }
});
