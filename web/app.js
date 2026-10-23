import {definitions,demo,validateProject,runProject} from './core.js';
import {Hub} from './bluetooth.js';
import {LIBRARY_KEY,initialLibrary,validateLibrary,entry} from './library.js';
import {activities} from './activities.js';
const $=id=>document.getElementById(id);
let project=demo(),controller=null,running=false,connecting=false,storageAvailable=true;
const status=text=>{$('status').textContent=text;};
let library,lastStored=null,storageBlocked=false;
function libraryNotice(text){$('library-status').hidden=!text;$('library-status').textContent=text;}
try{lastStored=localStorage.getItem(LIBRARY_KEY);library=lastStored?validateLibrary(JSON.parse(lastStored)):initialLibrary(localStorage.getItem('wedo-lab-v1'));project=library.projects.find(e=>e.id===library.activeId).project;}
catch{library=initialLibrary();project=library.projects[0].project;storageBlocked=true;libraryNotice('No se pudo leer la biblioteca. Los datos existentes se han conservado. Puedes descargar tu trabajo; no se sobrescribirá el almacenamiento.');}
function persist(){try{
 if(storageBlocked)throw Error('El almacenamiento está protegido. Descarga el proyecto antes de recargar.');
 if(localStorage.getItem(LIBRARY_KEY)!==lastStored){storageBlocked=true;throw Error('La biblioteca cambió en otra pestaña. Descarga tu trabajo y recarga para recuperar la última versión.');}
 const json=JSON.stringify(library);localStorage.setItem(LIBRARY_KEY,json);lastStored=json;storageAvailable=true;$('save-state').textContent='Guardado en este navegador';libraryNotice('');return true;
 }catch(e){storageAvailable=false;$('save-state').textContent='Sin guardar · descarga una copia';libraryNotice(e.message+' Los cambios permanecen solo en esta pestaña.');return false;}}
function save(){const current=library.projects.find(e=>e.id===library.activeId);current.project=project;current.updatedAt=new Date().toISOString();return persist();}
window.addEventListener('storage',event=>{if(event.key===LIBRARY_KEY||event.key===null){storageBlocked=true;libraryNotice('La biblioteca cambió en otra pestaña. Descarga el proyecto abierto y recarga antes de continuar.');}});
function displayMotor(power){$('power').replaceChildren(document.createTextNode(power+' '));const unit=document.createElement('small');unit.textContent='%';$('power').append(unit);$('meter').style.width=Math.abs(power)+'%';const wheel=$('wheel').firstElementChild;wheel.style.animationPlayState=power?'running':'paused';wheel.style.animationDirection=power<0?'reverse':'normal';wheel.style.animationDuration=(100/Math.max(10,Math.abs(power)))+'s';}
function displayLight(color){$('led').style.background=color;$('led').style.boxShadow=`0 0 14px ${color}`;}
const hub=new Hub(()=>{controller?.abort();displayMotor(0);$('connect').textContent='◎ Conectar hub';updateMode();status('Hub desconectado. La ejecución se ha detenido.');});
function updateMode(){const real=$('mode').value==='hub';$('connection-status').textContent=real?(hub.connected?'HUB CONECTADO':'HUB SIN CONECTAR'):'SIMULACIÓN · SIN HUB';$('preview-title').textContent=real?'Comandos del hub':'Tu banco de pruebas';}
function lock(){
 for(const el of document.querySelectorAll('#palette button,#blocks button,#blocks input,#name,#mode,#port,#new,#example,#import,#run,.tabs button,#project-list button,#activity-list button,#create-project,#notes,#activity-guide input'))el.disabled=running||connecting;
 $('connect').disabled=running||connecting;$('stop').disabled=!running;
}
function render(){
 $('name').value=project.name;$('count').textContent=project.blocks.length+' pasos';$('blocks').replaceChildren();$('empty').hidden=project.blocks.length>0;
 project.blocks.forEach((b,i)=>{
  const d=definitions[b.type],row=document.createElement('div');row.className='block '+d.kind;row.dataset.index=i;
  const icon=document.createElement('span');icon.className='symbol';icon.textContent=d.icon;
  const label=document.createElement('strong');label.textContent=d.label;row.append(icon,label);
  if(d.value!==undefined){const input=document.createElement('input');input.type=b.type==='light'?'color':'number';input.value=b.value;input.setAttribute('aria-label',d.label+' · valor');
   if(d.min!==undefined){input.min=d.min;input.max=d.max;input.step=b.type==='wait'?'.1':'1';}
   input.onchange=()=>{const value=b.type==='light'?input.value:Number(input.value);const next=structuredClone(project);next.blocks[i].value=value;try{project=validateProject(next);save();}catch(e){status(e.message);input.value=project.blocks[i].value;}};row.append(input);
   if(d.unit){const unit=document.createElement('small');unit.textContent=d.unit;row.append(unit);}
  }
  const actions=document.createElement('div');actions.className='block-tools';
  for(const [text,title,action] of [['↑','Subir bloque',()=>move(i,-1)],['↓','Bajar bloque',()=>move(i,1)],['×','Eliminar bloque',()=>{project.blocks.splice(i,1);save();render();}]]){
   const button=document.createElement('button');button.textContent=text;button.title=title;button.setAttribute('aria-label',title);button.onclick=action;actions.append(button);
  }
  row.append(actions);$('blocks').append(row);
 });renderNotebook();lock();
}
function move(i,delta){const n=i+delta;if(n<0||n>=project.blocks.length)return;const copy=structuredClone(project);[copy.blocks[i],copy.blocks[n]]=[copy.blocks[n],copy.blocks[i]];try{project=validateProject(copy);save();render();}catch(e){status(e.message);}}
for(const [type,d] of Object.entries(definitions)){
 const button=document.createElement('button');button.className='palette-button '+d.kind;const icon=document.createElement('span');icon.className='symbol';icon.textContent=d.icon;button.append(icon,document.createTextNode(d.label+' +'));
 button.onclick=()=>{if(project.blocks.length>=100){status('Máximo de 100 bloques por proyecto.');return;}if(type==='repeat'&&project.blocks.some(b=>b.type===type)){status('Ya tienes una repetición al final. Cambia su número de veces.');return;}
 const block=d.value===undefined?{type}:{type,value:d.value};const end=project.blocks.at(-1)?.type==='repeat'?project.blocks.length-1:project.blocks.length;project.blocks.splice(end,0,block);save();render();};$('palette').append(button);
}
$('name').oninput=()=>{project.name=$('name').value;save();};
$('mode').onchange=updateMode;
$('connect').onclick=async()=>{connecting=true;lock();try{
 if(hub.connected){await hub.disconnect();status('Hub desconectado.');}
 else{status('Enciende el hub y selecciónalo en la ventana Bluetooth.');await hub.connect();$('connect').textContent='◎ Desconectar hub';$('mode').value='hub';status('Hub conectado. Selecciona el puerto donde está el motor antes de iniciar.');}
 }catch(e){status(e.name==='NotFoundError'?'Conexión cancelada. Puedes seguir usando el simulador.':e.message);}finally{connecting=false;updateMode();lock();}};
$('run').onclick=async()=>{
 if(running||connecting)return;if(!project.blocks.length){status('Añade algún bloque antes de iniciar.');return;}
 const real=$('mode').value==='hub';if(real&&!hub.connected){status('Conecta el hub o selecciona Simulador.');return;}
 const port=Number($('port').value);controller=new AbortController();running=true;lock();const current=controller;
 const driver={motor:async p=>{if(real)await hub.motor(port,p);displayMotor(p);},light:async c=>{if(real)await hub.light(c);displayLight(c);},stop:async()=>{displayMotor(0);if(real)await hub.stop();}};
 const timeout=setTimeout(()=>current.abort(),60000);
 try{await runProject(structuredClone(project),driver,current.signal,(index,pass)=>{
  document.querySelectorAll('.block').forEach((el,i)=>el.classList.toggle('active',i===index));if(index>=0)status(`Paso ${index+1} · vuelta ${pass}${real?' · hub real':' · simulación'}`);
 });status('Programa terminado. Motor parado.');}
 catch(e){status(e.name==='AbortError'?'Programa detenido (botón de parada, pestaña oculta o límite de 60 s).':`No se pudo completar: ${e.message}`);}
 finally{clearTimeout(timeout);displayMotor(0);document.querySelectorAll('.active').forEach(el=>el.classList.remove('active'));running=false;controller=null;lock();}
};
$('stop').onclick=()=>{controller?.abort();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller?.abort();});
window.addEventListener('pagehide',()=>{controller?.abort();hub.stop().catch(()=>{});});
$('example').onclick=()=>addProject(demo());
$('new').onclick=()=>addProject({version:1,name:'Nuevo invento',blocks:[]});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^\p{L}\p{N}_-]/gu,'_')||'proyecto')+'.wedoweb.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Proyecto descargado. Puedes volver a abrirlo en este taller.');};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>100000)throw Error('El archivo supera el tamaño máximo (100 KB).');const next=validateProject(JSON.parse(await file.text()));if(running||connecting)throw Error('Detén la ejecución antes de abrir un archivo.');addProject(next);}catch(e){status('No se pudo abrir: '+e.message);}finally{$('file').value='';}};
function showView(view){if(running||connecting)return;for(const name of ['workshop','projects','activities'])$(name+'-view').hidden=name!==view;document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));if(view==='projects')renderProjects();if(view==='activities')renderActivities();}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function addProject(p){
 if(running||connecting)return;if(library.projects.length>=200){libraryNotice('Has alcanzado 200 proyectos. Descarga y elimina alguno para hacer espacio.');return;}
 if(!save())return;const next=entry(p);const before=structuredClone(library);library.projects.push(next);library.activeId=next.id;
 if(!persist()){library=before;return;}project=next.project;render();showView('workshop');status('Proyecto creado. Los anteriores siguen en Mis proyectos.');
}
$('create-project').onclick=$('new').onclick;
function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;return b;}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function renderProjects(){
 const list=$('project-list');list.replaceChildren();const query=$('project-search').value.toLocaleLowerCase('es');
 const items=library.projects.filter(e=>e.project.name.toLocaleLowerCase('es').includes(query)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 for(const e of items){const p=e.project,card=document.createElement('article');card.className='collection-card';
  card.append(text('span',p.activityId?'ACTIVIDAD':'INVENTO LIBRE','eyebrow'),text('h2',p.name||'Sin título'),text('p',`${p.blocks.length} bloques · ${new Date(e.updatedAt).toLocaleString('es-ES')}`));
  const a=activities.find(a=>a.id===p.activityId);if(a)card.append(text('p',`${a.title} · ${(p.completedSteps||[]).filter(i=>i<a.steps.length).length}/${a.steps.length} pasos completados`));
  const actions=document.createElement('div');actions.className='card-actions';actions.append(button(e.id===library.activeId?'Continuar':'Abrir',()=>{
   if(!save())return;const old=library.activeId;library.activeId=e.id;if(!persist()){library.activeId=old;return;}project=e.project;render();showView('workshop');
  }),button('Duplicar',()=>addProject({...structuredClone(p),name:(p.name+' · copia').slice(0,100)})),button('Renombrar',()=>{
   const name=prompt('Nombre del proyecto',p.name);if(name===null)return;if(!name.trim()||name.length>100){libraryNotice('Escribe un nombre de entre 1 y 100 caracteres.');return;}
   const before=structuredClone(library);p.name=name.trim();e.updatedAt=new Date().toISOString();if(!persist()){library=before;project=library.projects.find(e=>e.id===library.activeId).project;}else if(e.id===library.activeId)project=p;render();renderProjects();
  }),button('Eliminar',()=>{
   if(!confirm(`¿Eliminar «${p.name}»? Esta acción no se puede deshacer. Descarga antes una copia si quieres conservarlo.`))return;
   const before=structuredClone(library);library.projects=library.projects.filter(item=>item.id!==e.id);if(!library.projects.length)library.projects.push(entry({version:1,name:'Nuevo invento',blocks:[]}));if(e.id===library.activeId)library.activeId=library.projects[0].id;
   if(!persist())library=before;project=library.projects.find(item=>item.id===library.activeId).project;render();renderProjects();
  }));card.append(actions);list.append(card);
 }if(!items.length)list.append(text('p','No hay proyectos que coincidan con tu búsqueda.'));lock();
}
$('project-search').oninput=renderProjects;
function renderActivities(){const list=$('activity-list');list.replaceChildren();for(const a of activities.filter(a=>$('activity-filter').value==='all'||a.level===$('activity-filter').value)){
 const card=document.createElement('article');card.className='collection-card activity-card';card.append(text('div',a.icon,'activity-icon'),text('span',`${a.level.toUpperCase()} · ${a.minutes} MIN`,'eyebrow'),text('h2',a.title),text('p',a.description),text('p',a.materials,'materials'),button('Empezar actividad',()=>addProject({version:1,name:a.title,blocks:structuredClone(a.blocks),activityId:a.id,notes:'',completedSteps:[]})));list.append(card);
 }lock();}
$('activity-filter').onchange=renderActivities;
function renderNotebook(){const guide=$('activity-guide');guide.replaceChildren();$('notes').value=project.notes||'';const a=activities.find(a=>a.id===project.activityId);if(!a)return;
 guide.append(text('div',`${a.level.toUpperCase()} · GUÍA DE ACTIVIDAD`,'eyebrow'),text('h2',a.title),text('p',a.materials));
 a.steps.forEach((step,i)=>{const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=project.completedSteps?.includes(i)||false;check.onchange=()=>{const done=new Set(project.completedSteps||[]);check.checked?done.add(i):done.delete(i);project.completedSteps=[...done];save();};label.append(check,text('span',step));guide.append(label);});
}
$('notes').oninput=()=>{project.notes=$('notes').value;save();};
render();updateMode();if(!lastStored&&!storageBlocked)save();
