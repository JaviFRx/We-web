// Recovered: Model.MicrophoneModel, UI.MicrophoneController.Update, UI.Consts.SoundLevel.
// Native samples 0.2 seconds, uses the positive peak (NOT absolute peak/RMS), and averages two levels.
export const SOUND_THRESHOLDS=Object.freeze([-60,-57,-47,-38,-30,-23,-17,-12,-8,-5]);
export function soundLevelFromDecibels(value){return SOUND_THRESHOLDS.reduce((level,threshold,index)=>value>threshold?index+1:level,0);}
export function soundLevelFromSamples(samples){let peak=-3.4028234663852886e38;for(const sample of samples)if(sample>peak)peak=sample;return soundLevelFromDecibels(20*Math.log10(peak));}
export function programNeedsMicrophone(nodes){
 if(!Array.isArray(nodes))return false;
 return nodes.some(node=>Array.isArray(node)?programNeedsMicrophone(node):node?.parameter?.type==='SoundSensorInput'||programNeedsMicrophone(node?.children)||programNeedsMicrophone(node?.nodes));
}
export class OriginalMicrophone {
 constructor(env=globalThis){this.env=env;this.stream=null;this.context=null;this.source=null;this.analyser=null;this.timer=null;this.pending=null;this.generation=0;this.measures=[];this.disposeOnHide=()=>this.stop();}
 async prepareForProgram(nodes){
  if(!programNeedsMicrophone(nodes))return false;
  if(this.stream&&this.stream.getAudioTracks().some(track=>track.readyState==='live')){await this.context.resume();return true;}
  if(this.pending)return this.pending;
  if(this.stream||this.context)this.stop();
  const env=this.env,AudioContext=env.AudioContext||env.webkitAudioContext;
  if(!env.navigator?.mediaDevices?.getUserMedia||!AudioContext)throw Error('El sensor de sonido necesita micrófono y un navegador con audio web en HTTPS o localhost.');
  const generation=this.generation;
  // Call only from the explicit Start preflight. Reading the sensor never prompts for permission.
  const promise=(async()=>{
   const stream=await env.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());throw Error('La preparación del micrófono se canceló.');}
   this.stream=stream;
   try{
    this.context=new AudioContext();await this.context.resume();
    if(generation!==this.generation)throw Error('La preparación del micrófono se canceló.');
    this.source=this.context.createMediaStreamSource(stream);this.analyser=this.context.createAnalyser();
    const count=Math.round(this.context.sampleRate*0.2),fft=2**Math.ceil(Math.log2(Math.max(32,count)));
    if(fft>32768)throw Error('La frecuencia del micrófono supera la ventana de análisis compatible.');
    this.analyser.fftSize=fft;this.analyser.smoothingTimeConstant=0;this.source.connect(this.analyser);
    // Deliberately no connection to audio destination: listening must not produce feedback.
    const samples=new Float32Array(fft);this.measures=[];
    this.timer=env.setInterval(()=>{if(!this.analyser)return;this.analyser.getFloatTimeDomainData(samples);this.addMeasurement(soundLevelFromSamples(samples.subarray(fft-count)));},200);
    env.addEventListener?.('pagehide',this.disposeOnHide);return true;
   }catch(error){this.stop();throw error;}
  })();
  this.pending=promise;try{return await promise;}finally{if(this.pending===promise)this.pending=null;}
 }
 addMeasurement(value){if(this.measures.length>1.25)this.measures.shift();this.measures.push(value);}
 readLevel(){
  if(!this.stream||!this.analyser||!this.stream.getAudioTracks().some(track=>track.readyState==='live'))throw Error('El micrófono no está preparado. Inicia el programa para autorizar el sensor de sonido.');
  let sum=0;for(const value of this.measures)sum=Math.fround(sum+Math.fround(value/this.measures.length));return Math.trunc(sum);
 }
 stop(){
  this.generation++;this.env.clearInterval(this.timer);this.timer=null;this.source?.disconnect();this.source=null;this.analyser=null;
  this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
  const context=this.context;this.context=null;if(context&&context.state!=='closed')void context.close().catch(()=>{});
  this.measures=[];this.env.removeEventListener?.('pagehide',this.disposeOnHide);
 }
}
const microphone=new OriginalMicrophone();
export const prepareForProgram=nodes=>microphone.prepareForProgram(nodes);
export const readLevel=()=>microphone.readLevel();
export const stop=()=>microphone.stop();
