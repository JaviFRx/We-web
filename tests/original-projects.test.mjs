import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseOriginalProject,serializeOriginalProject,duplicateOriginalProject} from '../web/original-projects.js';
import {importOriginalBundle,exportOriginalBundle} from '../web/original-bundle.js';
const native={Name:'Programa original',Id:'df4b1939-c381-4aad-9cc2-8154a6ace3d1',CreationDate:'/Date(1447156619203+0100)/',LastOpenDate:'/Date(1447156619231+0100)/',StudentDocumentationToolProject:'documentación',CustomMetadata:{preserve:true},CanvasJson:JSON.stringify({Strips:[{Strip:{'Strip Position X':0.777132034,'Strip Position Y':2.876258,'Strip Instructions':[{Instruction:{InstructionType:1,Mode:''}},{Instruction:{InstructionType:17,Mode:'','Loop Inner Instructions':[{Instruction:{InstructionType:3,Mode:'',Parameter:{ParameterType:3,Mode:'',RawValue:'2'},Port:{PortNumber:1,ConnectorSide:0}}}]}}]}}],DetachedParameters:[{DetachedParameter:{'Strip Position X':1,'Strip Position Y':2,Parameter:{ParameterType:4,Mode:'',RawValue:'abc'}}}],Comments:[{Comment:{'Strip Position X':3,'Strip Position Y':4,CommentValue:'texto'}}],UnknownCanvasField:'keep'})};
test('reads the installed original Default.proj fixture without inventing a format',async()=>{
 const text=await readFile(new URL('./fixtures/wedo-default.proj',import.meta.url),'utf8'),raw=JSON.parse(text);
 const parsed=parseOriginalProject(text),exported=JSON.parse(serializeOriginalProject(parsed));
 assert.equal(parsed.name,'WeDo1');assert.equal(parsed.strips[0].nodes[0].type,'Start');
 assert.deepEqual(JSON.parse(exported.CanvasJson),JSON.parse(raw.CanvasJson));
});
test('native .proj roundtrip retains original shape, nested loops, parameters and metadata',()=>{
 const project=parseOriginalProject(JSON.stringify(native));
 assert.equal(project.strips[0].nodes[1].type,'Repeat');
 assert.equal(project.strips[0].nodes[1].children[0].port,1);
 assert.equal(project.detachedParameters[0].parameter.value,'abc');
 const exported=JSON.parse(serializeOriginalProject(project));
 assert.deepEqual(JSON.parse(exported.CanvasJson),JSON.parse(native.CanvasJson));
 assert.deepEqual(exported.CustomMetadata,native.CustomMetadata);
 assert.equal(exported.CreationDate,native.CreationDate);
});
test('coordinate conversion is explicit and reversible; edits export into original fields',()=>{
 const project=parseOriginalProject(JSON.stringify(native),{toCanvasPosition:({x,y})=>({x:x*100,y:768-y*100})});
 project.name='Editado';project.comments[0].text='nuevo';
 const exported=JSON.parse(serializeOriginalProject(project,{fromCanvasPosition:({x,y})=>({x:x/100,y:(768-y)/100})}));
 const canvas=JSON.parse(exported.CanvasJson);
 assert.equal(exported.Name,'Editado');assert.equal(canvas.Comments[0].Comment.CommentValue,'nuevo');
 assert.ok(Math.abs(canvas.Strips[0].Strip['Strip Position X']-0.777132034)<1e-10);
});
test('multi-hub ports are preserved and flagged; malformed input is rejected',()=>{
 const source=structuredClone(native),canvas=JSON.parse(source.CanvasJson);canvas.Strips[0].Strip['Strip Instructions'][0].Instruction.Port={PortNumber:2,ConnectorSide:1};source.CanvasJson=JSON.stringify(canvas);
 const project=parseOriginalProject(JSON.stringify(source));assert.equal(project.strips[0].nodes[0].unsupportedHardware,true);
 const exported=JSON.parse(JSON.parse(serializeOriginalProject(project)).CanvasJson);
 assert.deepEqual(exported.Strips[0].Strip['Strip Instructions'][0].Instruction.Port,{PortNumber:2,ConnectorSide:1});
 assert.throws(()=>parseOriginalProject('{}'),/proyecto/);
 assert.throws(()=>parseOriginalProject(JSON.stringify({...native,CanvasJson:'{}'})),/CanvasJson/);
});
test('.wedo ZIP preserves original project and media bytes; corrupt media is rejected',async()=>{
 const project=parseOriginalProject(JSON.stringify(native));
 project.bundleFiles=[{name:project.id+'/media/sound.clipdata',data:new Uint8Array([0,1,2,3,255])}];
 const blob=await exportOriginalBundle(project),imported=await importOriginalBundle(blob);
 assert.equal(imported.name,project.name);assert.deepEqual(imported.bundleFiles,project.bundleFiles);
 const data=new Uint8Array(await blob.arrayBuffer());data[35]^=1;
 await assert.rejects(()=>importOriginalBundle(data));
 project.bundleFiles=[{name:'../outside',data:new Uint8Array()}];
 await assert.rejects(()=>exportOriginalBundle(project),/Ruta/);
});
test('duplicate relocates media and documentation paths without rewriting text',async()=>{
 const project=parseOriginalProject(JSON.stringify(native)),oldId=project.id,newId='e74d3db3-a73b-4fba-a36a-f31fd0d22347';
 project.native.StudentDocumentationToolProject=JSON.stringify({sections:[{pages:[{elements:[{path:oldId+'/media/image.png',poster:oldId+'/media/poster.png',text:'Keep '+oldId+'/media/image.png'},{path:'media/relative.png'},{path:'https://example.test/'+oldId+'/media/image.png'}]}]}]});
 project.bundleFiles=[{name:oldId+'/media/image.png',data:new Blob([new Uint8Array([1,2,255])])},{name:oldId+'/media/poster.png',data:new Uint8Array([4])}];
 const copy=duplicateOriginalProject(project,newId),docs=JSON.parse(copy.native.StudentDocumentationToolProject),elements=docs.sections[0].pages[0].elements;
 assert.equal(elements[0].path,newId+'/media/image.png');assert.equal(elements[0].poster,newId+'/media/poster.png');assert.equal(elements[0].text,'Keep '+oldId+'/media/image.png');
 assert.equal(elements[1].path,'media/relative.png');assert.equal(elements[2].path,'https://example.test/'+oldId+'/media/image.png');assert.equal(project.bundleFiles[0].name,oldId+'/media/image.png');
 const imported=await importOriginalBundle(await exportOriginalBundle(copy));
 assert.equal(imported.id,newId);assert.equal(imported.bundleFiles[0].name,newId+'/media/image.png');assert.deepEqual([...imported.bundleFiles[0].data],[1,2,255]);
 assert.equal(imported.native.StudentDocumentationToolProject,copy.native.StudentDocumentationToolProject);
 assert.equal(imported.native.LastOpenDate,copy.lastOpenDate);assert.equal(imported.native.CreationDate,copy.creationDate);
 copy.lastOpenDate='2026-10-24T18:00:00.000Z';assert.equal(JSON.parse(serializeOriginalProject(copy)).LastOpenDate,copy.lastOpenDate);
 copy.bundleFiles[0].data={};await assert.rejects(()=>exportOriginalBundle(copy),/Contenido/);
});
