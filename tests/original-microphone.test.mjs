import test from 'node:test';
import assert from 'node:assert/strict';
import {OriginalMicrophone,SOUND_THRESHOLDS,soundLevelFromDecibels,soundLevelFromSamples,programNeedsMicrophone} from '../web/original-microphone.js';
test('original strict dB thresholds and positive peak calculation',()=>{
 SOUND_THRESHOLDS.forEach((threshold,index)=>{assert.equal(soundLevelFromDecibels(threshold),index);assert.equal(soundLevelFromDecibels(threshold+0.001),index+1);});
 assert.equal(soundLevelFromSamples([0,0]),0);assert.equal(soundLevelFromSamples([-1,-0.5]),0);assert.equal(soundLevelFromSamples([-1,0.01]),3);assert.equal(soundLevelFromSamples([1]),10);
});
test('nested programs detect sound input without granting permissions for other sensors',()=>{
 assert.equal(programNeedsMicrophone([{nodes:[{children:[{parameter:{type:'SoundSensorInput'}}]}]}]),true);
 assert.equal(programNeedsMicrophone([{parameter:{type:'MotionSensor'}}]),false);
});
function mocked(){
 let requested=0,stopped=0,closed=0,disconnected=0,tick,fft;
 const track={readyState:'live',stop(){this.readyState='ended';stopped++;}},stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
 const env={navigator:{mediaDevices:{getUserMedia:async()=>{requested++;return stream;}}},setInterval(fn,ms){assert.equal(ms,200);tick=fn;return 1;},clearInterval(){tick=null;},AudioContext:class{
  sampleRate=44100;state='running';resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
  createMediaStreamSource(){return{connect(){},disconnect(){disconnected++;}};}
  createAnalyser(){return{set fftSize(value){fft=value;},getFloatTimeDomainData(samples){samples.fill(0.3);}};}
 }};
 return {env,stream,get:()=>({requested,stopped,closed,disconnected,fft}),tick:()=>tick()};
}
test('preflight permission is explicit, samples two levels, stop releases every resource',async()=>{
 const mock=mocked(),mic=new OriginalMicrophone(mock.env);
 assert.throws(()=>mic.readLevel(),/no está preparado/);assert.equal(mock.get().requested,0);
 assert.equal(await mic.prepareForProgram([{type:'Start'}]),false);assert.equal(mock.get().requested,0);
 const nodes=[{parameter:{type:'SoundSensorInput'}}];await Promise.all([mic.prepareForProgram(nodes),mic.prepareForProgram(nodes)]);
 assert.equal(mock.get().requested,1);assert.equal(mock.get().fft,16384);assert.equal(mic.readLevel(),0);
 mock.tick();assert.equal(mic.readLevel(),8);mic.addMeasurement(3);assert.equal(mic.readLevel(),5);mic.addMeasurement(1);assert.equal(mic.readLevel(),2);
 mic.stop();assert.deepEqual(mock.get(),{requested:1,stopped:1,closed:1,disconnected:1,fft:16384});assert.throws(()=>mic.readLevel(),/no está preparado/);
});
test('stopping while permission is pending closes the late stream',async()=>{
 const mock=mocked();let resolve;mock.env.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);
 const mic=new OriginalMicrophone(mock.env),pending=mic.prepareForProgram([{parameter:{type:'SoundSensorInput'}}]);mic.stop();resolve(mock.stream);
 await assert.rejects(pending,/canceló/);assert.equal(mock.get().stopped,1);
});
