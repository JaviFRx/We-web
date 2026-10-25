// Native bridge contracts from content/wedo/build/js/build.min.js:
// DocumentationToolController, PathService, ExportHandler.default and BlockPageElementController.
const sessions=new WeakMap();
export const createDocumentationProject=()=>({sections:[{type:'',position:0,pages:[],pageLimit:10}]});
function parseDocumentation(raw){
 const value=raw?typeof raw==='string'?JSON.parse(raw):structuredClone(raw):createDocumentationProject();
 if(!Array.isArray(value.sections)||!value.sections.length||value.sections.some(section=>!Array.isArray(section.pages)))throw Error('La documentación original no contiene secciones y páginas válidas.');
 return value;
}
const mediaType=name=>/\.png$/i.test(name)?'image/png':/\.jpe?g$/i.test(name)?'image/jpeg':/\.gif$/i.test(name)?'image/gif':/\.mp4$/i.test(name)?'video/mp4':'application/octet-stream';
function mediaUrls(w,project,value){
 const reverse=new Map();
 const visit=node=>{if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){
  if((key==='path'||key==='poster')&&typeof node[key]==='string'){
   const file=project.bundleFiles?.find(file=>file.name===node[key]||file.name===project.id+'/'+node[key]);
   if(file){const url=w.URL.createObjectURL(new w.Blob([new Uint8Array(file.data)],{type:mediaType(file.name)}));reverse.set(url,node[key]);node[key]=url;}
  }else visit(node[key]);
 }};visit(value);return reverse;
}
export function saveDocumentation(w){
 const session=sessions.get(w);if(!session||typeof w.getProject!=='function')return false;
 const prefix='SAVEDATA_web@',result=w.getProject('web');
 if(typeof result!=='string'||!result.startsWith(prefix))throw Error('La documentación original no devolvió datos de guardado.');
 const value=parseDocumentation(result.slice(prefix.length));
 const visit=node=>{if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){if((key==='path'||key==='poster')&&session.reverse.has(node[key]))node[key]=session.reverse.get(node[key]);else visit(node[key]);}};visit(value);
 const data=JSON.stringify(value);session.project.native??={};
 if(session.project.native.StudentDocumentationToolProject===data)return false;
 session.project.native.StudentDocumentationToolProject=data;
 session.onSave?.(session.project);return true;
}
export function releaseDocumentation(w){
 const session=sessions.get(w);if(!session)return false;
 // Flush the owner before detaching its Angular getter; never consume a pending
 // route resolver's loadProject callback, which belongs to the next view.
 saveDocumentation(w);session.unwatch?.();
 for(const url of session.reverse.keys())w.URL.revokeObjectURL(url);
 sessions.delete(w);delete w.getProject;return true;
}
function watch(w,session){
 const injector=w.angular?.element(w.document).injector?.()||w.angular?.element(w.document.body).injector?.();
 if(!injector)return;
 session.unwatch=injector.get('$rootScope').$watch(()=>typeof w.getProject==='function'?w.getProject('web'):null,()=>saveDocumentation(w));
}
function pickMedia(w,type,elementId){
 return new Promise((resolve,reject)=>{
  const input=w.document.createElement('input');input.type='file';input.accept=type==='Image'?'image/*':'video/mp4,video/webm';input.style.display='none';w.document.body.append(input);
  const cancel=()=>{input.remove();w.unityEmitMessage('mediaPickerAbortFail',elementId);resolve();};input.addEventListener('cancel',cancel,{once:true});
  input.onchange=async()=>{try{const file=input.files[0];if(!file)return cancel();if(file.size>20*1024*1024)throw Error('El medio supera 20 MB.');
   const reader=new w.FileReader();const data=await new Promise((ok,fail)=>{reader.onload=()=>ok(reader.result);reader.onerror=()=>fail(reader.error);reader.readAsDataURL(file);});
   if(type==='Image')w.unityEmitMessage('imagePath',data,0,elementId);else w.unityEmitMessage('videoPath',data,'',elementId);resolve();
  }catch(error){w.unityEmitMessage('mediaPickerAbortFail',elementId);reject(error);}finally{input.remove();}};input.click();
 });
}
export async function handleDocumentationMessage(message,w,{getProject,onSave}={}){
 const [command,query='']=message.split('?'),params=new URLSearchParams(query);
 if(command==='LoadProject'){
  // Language initialization can reload the route while native requests are queued.
  if(typeof w.loadProject!=='function')return true;
  releaseDocumentation(w);
  const project=getProject?.();if(!project)throw Error('No hay proyecto abierto para documentar.');
  const value=parseDocumentation(project.native?.StudentDocumentationToolProject),reverse=mediaUrls(w,project,value);
  const session={project,onSave,reverse};sessions.set(w,session);delete w.getProject;w.loadProject(value);watch(w,session);return true;
 }
 if(command==='LockedStatus'){w.setLockedStatus?.(Boolean(getProject?.()?.native?.SDTLockedState));return true;}
 // Original image/movie controllers concatenate this path; absolute blob/data URLs need an empty base.
 if(command==='ApplicationDataPath'){w.setSDTPath('');return true;}
 if(command==='ViewLoadingComplete'&&sessions.has(w)){saveDocumentation(w);return false;}
 if(command==='ShowMediaPicker'){const type=params.get('Type');if(!['Image','Video'].includes(type))throw Error('Selector de medios no reconocido.');await pickMedia(w,type,params.get('ElementID'));return true;}
 if(command==='DeleteMedia'){return true;} // Original content model owns references; shared bundle files remain intact.
 if(command==='Export'){
  const type=params.get('Type');if(!['Image','PDF'].includes(type))return false;
  await new Promise(resolve=>w.setTimeout(resolve,0));
  const getter=w[type==='Image'?'getExportImage':'getExportPDF'];if(typeof getter!=='function')throw Error('El exportador original todavía no ha generado el archivo.');
  try{const data=getter();if(typeof data!=='string'||!data.startsWith('data:'))throw Error('El exportador original devolvió un archivo no válido.');
   const extension=type==='PDF'?'.pdf':/^data:image\/jpe?g[;,]/i.test(data)?'.jpg':'.png';
   const anchor=w.document.createElement('a');anchor.href=data;anchor.download=(getProject?.()?.name||'WeDo')+extension;w.document.body.append(anchor);anchor.click();anchor.remove();
  }finally{w.ExportDone?.();}return true;
 }
 return false;
}
