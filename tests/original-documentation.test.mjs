import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentationProject,handleDocumentationMessage,saveDocumentation,releaseDocumentation} from '../web/original-documentation.js';
test('original documentation handshake, getter and native project persistence',async()=>{
 const project={native:{},name:'Test'};let loaded,locked,path,saved=0;
 const w={loadProject:value=>loaded=value,setLockedStatus:value=>locked=value,setSDTPath:value=>path=value};
 const options={getProject:()=>project,onSave:()=>saved++};
 assert.equal(await handleDocumentationMessage('LoadProject?',w,options),true);
 assert.deepEqual(loaded,createDocumentationProject());
 loaded.sections[0].pages.push({GUID:'test',template_id:0,elements:{text:{type:'TEXT',html:'<b>Hello</b>'}}});
 w.getProject=token=>'SAVEDATA_'+token+'@'+JSON.stringify(loaded);
 assert.equal(saveDocumentation(w),true);assert.equal(saved,1);assert.equal(saveDocumentation(w),false);
 assert.deepEqual(JSON.parse(project.native.StudentDocumentationToolProject),loaded);
 project.native.SDTLockedState=true;
 await handleDocumentationMessage('LockedStatus?',w,options);await handleDocumentationMessage('ApplicationDataPath?',w,options);
 assert.equal(locked,true);assert.equal(path,'');
});
test('switching owner flushes previous project and cannot write stale getter into next project',async()=>{
 const a={native:{}},b={native:{}};let current=a;
 const w={loadProject(){}};const options={getProject:()=>current};
 await handleDocumentationMessage('LoadProject?',w,options);const value=createDocumentationProject();value.marker='a';
 w.getProject=token=>'SAVEDATA_'+token+'@'+JSON.stringify(value);current=b;
 await handleDocumentationMessage('LoadProject?',w,options);
 assert.equal(JSON.parse(a.native.StudentDocumentationToolProject).marker,'a');assert.equal(b.native.StudentDocumentationToolProject,undefined);assert.equal(saveDocumentation(w),false);
});
test('malformed documentation is rejected without replacing native source',async()=>{
 const project={native:{StudentDocumentationToolProject:'{"sections":null}'}};
 await assert.rejects(handleDocumentationMessage('LoadProject?',{loadProject(){}},{getProject:()=>project}),/secciones/);
 assert.equal(project.native.StudentDocumentationToolProject,'{"sections":null}');
});
test('original export getter is consumed and completion acknowledged',async()=>{
 let clicked=0,done=0;const link={click(){clicked++},remove(){}};
 const w={setTimeout,document:{createElement:()=>link,body:{append(){}}},getExportPDF:()=> 'data:application/pdf;base64,AA==',ExportDone(){done++}};
 assert.equal(await handleDocumentationMessage('Export?Type=PDF',w,{getProject:()=>({name:'Notes'})}),true);
 assert.equal(clicked,1);assert.equal(done,1);assert.equal(link.download,'Notes.pdf');
});
test('original JPEG export keeps its actual file extension',async()=>{
 const link={click(){},remove(){}};
 const w={setTimeout,document:{createElement:()=>link,body:{append(){}}},getExportImage:()=> 'data:image/jpeg;base64,/9j/',ExportDone(){}};
 await handleDocumentationMessage('Export?Type=Image',w,{getProject:()=>({name:'Notes'})});assert.equal(link.download,'Notes.jpg');
});
test('bundled media uses absolute URL in original view and retains original path in native save',async()=>{
 const value=createDocumentationProject();value.sections[0].pages=[{elements:{image:{type:'IMAGE',path:'pic.png'}}}];
 const project={id:'project',native:{StudentDocumentationToolProject:JSON.stringify(value)},bundleFiles:[{name:'project/pic.png',data:[1,2,3]}]};let loaded;
 const w={Blob,URL:{createObjectURL:()=> 'blob:test'},loadProject:value=>loaded=value};
 await handleDocumentationMessage('LoadProject?',w,{getProject:()=>project});assert.equal(loaded.sections[0].pages[0].elements.image.path,'blob:test');
 w.getProject=token=>'SAVEDATA_'+token+'@'+JSON.stringify(loaded);saveDocumentation(w);
 assert.equal(JSON.parse(project.native.StudentDocumentationToolProject).sections[0].pages[0].elements.image.path,'pic.png');
});
test('release flushes A, removes its watcher/media/getter and leaves B route callback intact',async()=>{
 const a={native:{}},b={native:{}};let current=a,loaded,unwatched=0,saved=0;
 const w={document:{body:{}},angular:{element:()=>({injector:()=>({get:()=>({$watch:()=>()=>unwatched++})})})},loadProject:value=>loaded=value};
 const options={getProject:()=>current,onSave:()=>saved++};
 await handleDocumentationMessage('LoadProject?',w,options);loaded.marker='A';w.getProject=token=>'SAVEDATA_'+token+'@'+JSON.stringify(loaded);
 const pendingLoad=value=>loaded=value;w.loadProject=pendingLoad;
 assert.equal(releaseDocumentation(w),true);assert.equal(unwatched,1);assert.equal(saved,1);assert.equal(w.getProject,undefined);assert.equal(w.loadProject,pendingLoad);
 assert.equal(JSON.parse(a.native.StudentDocumentationToolProject).marker,'A');assert.equal(releaseDocumentation(w),false);
 current=b;await handleDocumentationMessage('LoadProject?',w,options);assert.equal(loaded.marker,undefined);
 loaded.marker='B';w.getProject=token=>'SAVEDATA_'+token+'@'+JSON.stringify(loaded);saveDocumentation(w);
 assert.equal(JSON.parse(b.native.StudentDocumentationToolProject).marker,'B');assert.equal(JSON.parse(a.native.StudentDocumentationToolProject).marker,'A');
});
