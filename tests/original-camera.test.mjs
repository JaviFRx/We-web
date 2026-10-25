import test from 'node:test';
import assert from 'node:assert/strict';
import {storeCameraMedia} from '../web/original-camera.js';
test('captured media is stored in project bundle without silently inserting a documentation page',async()=>{
 const project={id:'project',native:{StudentDocumentationToolProject:'original'}};let saves=0;
 const result=await storeCameraMedia(new Blob([new Uint8Array([1,2,3])],{type:'image/jpeg'}),{project,onSave:()=>saves++});
 assert.match(result.path,/^project\/.*\.jpg$/);assert.deepEqual(Array.from(project.bundleFiles[0].data),[1,2,3]);assert.equal(saves,1);
 assert.equal(project.native.StudentDocumentationToolProject,'original');assert.equal(project.capturedMedia[0].kind,'photo');
});
test('empty capture does not create a media entry',async()=>{
 const project={id:'p'};await assert.rejects(storeCameraMedia(new Blob([]),{project}),/vacía/);assert.equal(project.bundleFiles,undefined);
});
