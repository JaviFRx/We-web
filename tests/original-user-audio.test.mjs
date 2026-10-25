import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOriginalClipData,loadOriginalUserClip,cropOriginalUserClip,resolveOriginalUserAudio,saveOriginalUserClip,nextOriginalUserAudioReference,createOriginalAudioRecorder} from '../web/original-user-audio.js';
import {exportOriginalBundle,importOriginalBundle} from '../web/original-bundle.js';
const makeProject=()=>({id:'a5fcf0aa-594d-4ca5-9cae-83f742789a1e',name:'Audio',strips:[],bundleFiles:[]});
test('native clipdata uses UTF8 line Singles, including comma decimal locale',()=>{
 assert.deepEqual([...parseOriginalClipData(new TextEncoder().encode('\uFEFF0\r\n0,5\r\n-1e-1\r\n'))],[0,.5,Math.fround(-.1)]);
 assert.throws(()=>parseOriginalClipData(new TextEncoder().encode('no binary')),/válida/);
});
test('native recording trim, WAV PCM and .wedo media roundtrip',async()=>{
 const project=makeProject(),clip={Samples:new Float32Array([0,.25,.5,-.5,1,-1,0,0]),Frequency:4,Channels:1,ClipBeginTime:.5,ClipEndTime:1.5};
 assert.equal(nextOriginalUserAudioReference(project),'@A');saveOriginalUserClip(project,'@A',clip);assert.equal(nextOriginalUserAudioReference(project),'@B');
 const roundtrip=await importOriginalBundle(await exportOriginalBundle(project)),loaded=await loadOriginalUserClip(roundtrip,'A');assert.deepEqual(loaded.Samples,clip.Samples);
 const resolved=await resolveOriginalUserAudio(roundtrip,'UserClip_00');assert.deepEqual([...resolved.Samples],[.5,-.5,1,-1]);assert.equal(resolved.duration,1);
 const wav=new DataView(await resolved.blob.arrayBuffer());assert.equal(wav.getUint32(24,true),4);assert.equal(wav.getInt16(44,true),16384);assert.equal(wav.getInt16(50,true),-32768);
 loaded.ClipBeginTime=2;assert.throws(()=>cropOriginalUserClip(loaded),/Recorte/);await assert.rejects(()=>loadOriginalUserClip(project,'@Z'),/encuentra/);
});
test('recorder captures mono six seconds and releases simulated microphone without hardware',async()=>{
 let process,stopped=0,closed=0,completed;const node=()=>({connect(){},disconnect(){}});
 class AudioContext{constructor(){this.sampleRate=8;this.destination={};}async resume(){}async close(){closed++;}createMediaStreamSource(){return node();}createScriptProcessor(){process=node();return process;}createGain(){return {...node(),gain:{value:1}};}}
 const environment={AudioContext,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}}};
 const recorder=createOriginalAudioRecorder({environment,onComplete:clip=>{completed=clip;}});await recorder.start();assert.equal(recorder.recording,true);
 process.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(48).fill(.5)}});
 const clip=await recorder.stop();assert.equal(clip.Samples.length,168000);assert.equal(clip.Samples[0],.5);assert.equal(clip.Samples.at(-1),.5);assert.equal(clip,completed);assert.equal(stopped,1);assert.equal(closed,1);assert.equal(recorder.recording,false);
});
test('cancel while permission pending releases granted stream and does not capture',async()=>{
 let grant,stopped=0;const environment={navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>grant=resolve)}}};
 const recorder=createOriginalAudioRecorder({environment}),pending=recorder.start();await recorder.cancel();grant({getTracks:()=>[{stop(){stopped++;}}]});await pending;assert.equal(stopped,1);assert.equal(recorder.recording,false);
});
test('unexpected microphone loss reports error, releases resources and never saves incomplete recording',async()=>{
 const track=new EventTarget();let stops=0,closed=0,saves=0,error;track.stop=()=>stops++;
 const node=()=>({connect(){},disconnect(){}});
 class AudioContext{constructor(){this.sampleRate=28000;this.destination={};}async resume(){}async close(){closed++;}createMediaStreamSource(){return node();}createScriptProcessor(){return node();}createGain(){return {...node(),gain:{value:1}};}}
 const recorder=createOriginalAudioRecorder({environment:{AudioContext,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}}},onComplete:()=>saves++,onError:e=>error=e});
 await recorder.start();track.dispatchEvent(new Event('ended'));await new Promise(resolve=>setImmediate(resolve));assert.equal(recorder.recording,false);assert.equal(saves,0);assert.equal(stops,1);assert.equal(closed,1);assert.match(error.message,/desconectado/);
});

// Generated locally by .NET BinaryFormatter.Serialize(single[]{0,.25,-.5,1});
// no untrusted payload is ever passed to a .NET deserializer.
const legacyFixture=()=>Uint8Array.from(Buffer.from('AAEAAAD/////AQAAAAAAAAAPAQAAAAQAAAALAAAAAAAAgD4AAAC/AACAPws=','base64'));
test('legacy Single[] NRBF loads with nonzero byteOffset and survives native bundle roundtrip',async()=>{
 const raw=legacyFixture(),padded=new Uint8Array(raw.length+6);padded.set(raw,3);
 assert.deepEqual([...parseOriginalClipData(padded.subarray(3,-3))],[0,.25,-.5,1]);
 const project=makeProject();saveOriginalUserClip(project,'@A',{Samples:new Float32Array([0,.25,-.5,1]),Frequency:4,Channels:1,ClipBeginTime:0,ClipEndTime:1});
 project.bundleFiles.find(f=>f.name.endsWith('.clipdata')).data=raw;
 const restored=await importOriginalBundle(await exportOriginalBundle(project));
 assert.deepEqual([...(await loadOriginalUserClip(restored,'@A')).Samples],[0,.25,-.5,1]);
 assert.equal((await resolveOriginalUserAudio(restored,'@A')).duration,1);
});

test('legacy NRBF rejects every truncation, foreign records, mismatched root, excess allocation and invalid samples',()=>{
 const fixture=legacyFixture();
 for(let length=1;length<fixture.length;length++)assert.throws(()=>parseOriginalClipData(fixture.slice(0,length)));
 const changed=(offset,value)=>{const raw=legacyFixture();raw[offset]=value;return raw;};
 for(const record of [1,4,5,6,8,9,12,16,17,21,22])assert.throws(()=>parseOriginalClipData(changed(17,record)));
 assert.throws(()=>parseOriginalClipData(changed(18,2)));assert.throws(()=>parseOriginalClipData(changed(26,6)));
 assert.throws(()=>parseOriginalClipData(changed(fixture.length-1,0)));
 assert.throws(()=>parseOriginalClipData(new Uint8Array([...fixture,0])));
 for(const length of [-1,0,2_000_001,2147483647]){const raw=legacyFixture();new DataView(raw.buffer).setInt32(22,length,true);assert.throws(()=>parseOriginalClipData(raw));}
 for(const value of [NaN,Infinity,-Infinity,1.1]){const raw=legacyFixture();new DataView(raw.buffer).setFloat32(27,value,true);assert.throws(()=>parseOriginalClipData(raw),/rango/);}
});

test('legacy BinaryArray accepts only rank-one zero-based Single primitive arrays',()=>{
 const base=legacyFixture(),data=new Uint8Array(base.length+6);data.set(base.subarray(0,17));data[17]=7;
 const view=new DataView(data.buffer);view.setInt32(18,1,true);data[22]=0;view.setInt32(23,1,true);view.setInt32(27,4,true);data[31]=0;data[32]=11;data.set(base.subarray(27),33);
 assert.deepEqual([...parseOriginalClipData(data)],[0,.25,-.5,1]);
 for(const [offset,value]of [[22,3],[23,2],[31,2],[32,6]]){const bad=data.slice();bad[offset]=value;assert.throws(()=>parseOriginalClipData(bad));}
});
