export const definitions = {
 motor:{label:'Mover motor',icon:'↻',kind:'motion',value:50,min:-100,max:100,unit:'% potencia'},
 wait:{label:'Esperar',icon:'◷',kind:'control',value:1,min:0.1,max:30,unit:'segundos'},
 stop:{label:'Parar motor',icon:'■',kind:'motion'},
 light:{label:'Cambiar luz',icon:'✳',kind:'light',value:'#16ba9b'},
 repeat:{label:'Repetir secuencia',icon:'⤾',kind:'control',value:2,min:1,max:20,unit:'veces en total'}
};
export const demo = ()=>({version:1,name:'Mi primera máquina',blocks:[{type:'light',value:'#16ba9b'},{type:'motor',value:50},{type:'wait',value:2},{type:'motor',value:-50},{type:'wait',value:2},{type:'stop'},{type:'repeat',value:2}]});
export function validateProject(p){
 if(!p || p.version!==1 || typeof p.name!=='string' || p.name.length>100 || !Array.isArray(p.blocks) || p.blocks.length>100)throw Error('Proyecto no válido. Usa un archivo .wedoweb.json de esta aplicación.');
 let repeat=false;
 const blocks=p.blocks.map((b,i)=>{
  const d=definitions[b?.type];if(!d)throw Error('Bloque desconocido.');
  if(b.type==='repeat'){if(repeat||i!==p.blocks.length-1)throw Error('Repetir debe estar una sola vez, al final.');repeat=true;}
  if(d.min!==undefined && (!Number.isFinite(b.value)||b.value<d.min||b.value>d.max||(b.type==='repeat'&&!Number.isInteger(b.value))))throw Error('Valor de bloque fuera de rango.');
  if(b.type==='light' && !/^#[\da-f]{6}$/i.test(b.value))throw Error('Color no válido.');
  return d.value===undefined?{type:b.type}:{type:b.type,value:b.value};
 });
 const result={version:1,name:p.name,blocks};
 if(p.activityId!==undefined){if(typeof p.activityId!=='string'||p.activityId.length>80)throw Error('Actividad no válida.');result.activityId=p.activityId;}
 if(p.notes!==undefined){if(typeof p.notes!=='string'||p.notes.length>10000)throw Error('Notas demasiado largas.');result.notes=p.notes;}
 if(p.completedSteps!==undefined){if(!Array.isArray(p.completedSteps)||p.completedSteps.length>50||p.completedSteps.some(n=>!Number.isInteger(n)||n<0||n>49))throw Error('Progreso no válido.');result.completedSteps=[...new Set(p.completedSteps)];}
 return result;
}
export function motorPacket(port,power){
 if(![1,2].includes(port)||!Number.isFinite(power)||power< -100||power>100)throw Error('Motor no válido.');
 return new Uint8Array([port,1,1,Math.round(power)]);
}
export function lightPacket(hex){
 if(!/^#[\da-f]{6}$/i.test(hex))throw Error('Color no válido.');
 return new Uint8Array([6,4,3,...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))]);
}
export function delay(ms,signal){return new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);reject(new DOMException('Detenido','AbortError'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
});}
export async function runProject(project,driver,signal,onStep=()=>{}){
 const p=validateProject(project);const last=p.blocks.at(-1);const count=last?.type==='repeat'?last.value:1;
 try{for(let pass=0;pass<count;pass++)for(let i=0;i<p.blocks.length;i++){
  signal.throwIfAborted();const b=p.blocks[i];onStep(i,pass+1);
  if(b.type==='motor')await driver.motor(b.value);
  if(b.type==='stop')await driver.motor(0);
  if(b.type==='light')await driver.light(b.value);
  await delay(b.type==='wait'?b.value*1000:100,signal);
 }}finally{await driver.stop();onStep(-1,0);}
}
