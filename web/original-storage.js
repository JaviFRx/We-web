// Structured cloning preserves project media (Uint8Array, ArrayBuffer and Blob)
// without the JSON expansion and small quota of localStorage.
export const ORIGINAL_STORAGE_DATABASE='wedo-original-library';
const storeName='libraries',recordKey='current';
let pending=Promise.resolve();
function validLibrary(value){
 if(!value||typeof value!=='object'||!value.projects||typeof value.projects!=='object'||Array.isArray(value.projects))throw Error('La biblioteca guardada tiene un formato no válido.');
 return value;
}
function failure(error,action){return new Error(`${action}: ${error?.message||error?.name||'error desconocido'}`,{cause:error});}
function openDatabase(){return new Promise((resolve,reject)=>{
 if(!globalThis.indexedDB){reject(Error('Este navegador no permite guardar la biblioteca con IndexedDB.'));return;}
 let request,failed=false;
 try{request=indexedDB.open(ORIGINAL_STORAGE_DATABASE,1);}catch(error){reject(error);return;}
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName);};
 request.onerror=()=>reject(request.error);
 request.onblocked=()=>{failed=true;reject(Error('Otra pestaña bloquea el almacenamiento. Cierra las otras pestañas de WeDo y vuelve a intentarlo.'));};
 request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>db.close();resolve(db);};
});}
async function transaction(mode,operation){
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,mode);let result;
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('La escritura de la biblioteca fue cancelada.'));
  tx.onerror=()=>{}; // onabort reports the final transaction outcome.
  try{operation(tx.objectStore(storeName),value=>{result=value;});}catch(error){tx.abort();reject(error);}
 });}finally{db.close();}
}
function enqueue(operation){const result=pending.then(operation);pending=result.catch(()=>{});return result;}
export function saveOriginalLibrary(library){
 // Snapshot before queuing: edits made while a previous transaction commits
 // cannot accidentally alter this write or reverse the sequence of writes.
 let snapshot;try{snapshot=structuredClone(validLibrary(library));}catch(error){return Promise.reject(failure(error,'No se pudo preparar la biblioteca para guardar'));}
 return enqueue(async()=>{try{await transaction('readwrite',store=>store.put(snapshot,recordKey));}catch(error){throw failure(error,'No se pudo guardar la biblioteca');}});
}
export function loadOriginalLibrary(fallbackLocalStorageKey){
 return enqueue(async()=>{
  try{
   const stored=await transaction('readonly',(store,done)=>{const request=store.get(recordKey);request.onsuccess=()=>done(request.result);});
   if(stored!==undefined)return validLibrary(stored);
   const legacy=fallbackLocalStorageKey?localStorage.getItem(fallbackLocalStorageKey):null;
   const migrated=legacy===null?{projects:{}}:validLibrary(JSON.parse(legacy));
   // A second tab may have saved while legacy JSON was being read. Never
   // overwrite that newer library during migration. Keep legacy JSON intact.
   return await transaction('readwrite',(store,done)=>{
    const request=store.get(recordKey);request.onsuccess=()=>{
     if(request.result!==undefined){done(request.result);return;}
     store.put(migrated,recordKey);done(migrated);
    };
   }).then(validLibrary);
  }catch(error){throw failure(error,'No se pudo leer o migrar la biblioteca');}
 });
}
