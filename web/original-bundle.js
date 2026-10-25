import {parseOriginalProject,serializeOriginalProject} from './original-projects.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const maxBytes=150*1024*1024;
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function safeName(name){return name&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes(':')&&!name.split('/').includes('..');}
export async function importOriginalBundle(file,options){
 const buffer=file instanceof Uint8Array?file:new Uint8Array(await file.arrayBuffer());
 if(buffer.length>maxBytes)throw Error('El archivo .wedo supera 150 MB.');
 const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('No es un archivo .wedo ZIP válido.');
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('ZIP dividido no compatible.');
 const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true);let cursor=view.getUint32(end+16,true),total=0;
 if(count>10000||cursor+directorySize>end)throw Error('Directorio ZIP no válido.');
 const files=[],seen=new Set();
 for(let i=0;i<count;i++){
  if(cursor+46>buffer.length||view.getUint32(cursor,true)!==0x02014b50)throw Error('Entrada ZIP no válida.');
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),crc=view.getUint32(cursor+16,true),packed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
  if(flags&1)throw Error('Los archivos cifrados no son compatibles.');
  if(cursor+46+nameLength+extraLength+commentLength>buffer.length)throw Error('Nombre ZIP fuera del archivo.');
  const name=decoder.decode(buffer.slice(cursor+46,cursor+46+nameLength));cursor+=46+nameLength+extraLength+commentLength;
  if(!safeName(name)||seen.has(name))throw Error('Ruta ZIP no válida o duplicada.');seen.add(name);
  total+=size;if(total>maxBytes)throw Error('Contenido descomprimido demasiado grande.');
  if(local+30>buffer.length||view.getUint32(local,true)!==0x04034b50)throw Error('Cabecera ZIP no válida.');
  const localName=decoder.decode(buffer.slice(local+30,local+30+view.getUint16(local+26,true)));
  if(localName!==name||view.getUint16(local+8,true)!==method)throw Error('Cabeceras ZIP inconsistentes.');
  const begin=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
  if(begin+packed>buffer.length)throw Error('Datos ZIP truncados.');
  let data=buffer.slice(begin,begin+packed);
  if(method===8){
   const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   const reader=stream.getReader(),chunks=[];let actual=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;actual+=value.length;if(actual>size||actual>maxBytes)throw Error('Tamaño ZIP descomprimido no válido.');chunks.push(value);}}finally{await reader.cancel();}
   data=new Uint8Array(actual);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
  }else if(method!==0)throw Error('Compresión ZIP no compatible: '+method);
  if(data.length!==size||crc32(data)!==crc)throw Error('El archivo ZIP está dañado: '+name);
  if(!name.endsWith('/'))files.push({name,data});
 }
 const projects=files.filter(item=>item.name.endsWith('.proj'));
 if(projects.length!==1)throw Error('El archivo .wedo debe contener un único proyecto .proj.');
 const project=parseOriginalProject(decoder.decode(projects[0].data),options);
 project.bundleFiles=files.filter(item=>item!==projects[0]);
 return project;
}
export async function exportOriginalBundle(project,options){
 const id=String(project.id||'');if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))throw Error('El proyecto necesita un identificador UUID para exportar .wedo.');
 const entries=[{name:id+'.proj',data:encoder.encode(serializeOriginalProject(project,options))},...(project.bundleFiles||[])];
 if(entries.length>10000)throw Error('Demasiados archivos en el proyecto.');
 const body=[],central=[],seen=new Set();let offset=0,total=0;
 for(const entry of entries){
  if(!safeName(entry.name)||seen.has(entry.name))throw Error('Ruta de recurso no válida o duplicada.');seen.add(entry.name);
  const name=encoder.encode(entry.name);let data=entry.data;
  if(data instanceof Blob){if(data.size>maxBytes)throw Error('Proyecto demasiado grande.');data=new Uint8Array(await data.arrayBuffer());}
  else if(data instanceof ArrayBuffer)data=new Uint8Array(data);
  else if(ArrayBuffer.isView(data))data=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  else if(Array.isArray(data)&&data.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255))data=new Uint8Array(data);
  else throw Error('Contenido de recurso no válido: '+entry.name);
  total+=data.length;if(total>maxBytes||name.length>65535)throw Error('Proyecto demasiado grande.');
  const crc=crc32(data),header=new Uint8Array(30+name.length),local=new DataView(header.buffer);
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x800,true);local.setUint32(14,crc,true);local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);local.setUint16(26,name.length,true);header.set(name,30);
  const record=new Uint8Array(46+name.length),directory=new DataView(record.buffer);
  directory.setUint32(0,0x02014b50,true);directory.setUint16(4,20,true);directory.setUint16(6,20,true);directory.setUint16(8,0x800,true);directory.setUint32(16,crc,true);directory.setUint32(20,data.length,true);directory.setUint32(24,data.length,true);directory.setUint16(28,name.length,true);directory.setUint32(42,offset,true);record.set(name,46);
  body.push(header,data);central.push(record);offset+=header.length+data.length;
 }
 const directorySize=central.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),view=new DataView(end.buffer);
 view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,directorySize,true);view.setUint32(16,offset,true);
 return new Blob([...body,...central,end],{type:'application/zip'});
}
