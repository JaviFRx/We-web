import test from 'node:test';
import assert from 'node:assert/strict';
import {canSnapInstruction,canSnapInsideLoop,canWrapWithLoop,attachmentDistance} from '../web/original-snapping.js';
test('attachment proximity uses both axes and follows viewport and zoom scale',()=>{
 const target={left:100,right:200,bottom:80};
 assert.ok(Number.isFinite(attachmentDistance({left:212,right:302,bottom:86},target,'after')));
 assert.equal(attachmentDistance({left:225,right:315,bottom:80},target,'after'),Infinity);
 assert.equal(attachmentDistance({left:200,right:290,bottom:113},target,'after'),Infinity);
 assert.ok(Number.isFinite(attachmentDistance({left:0,right:88,bottom:86},target,'before')));
 assert.ok(Number.isFinite(attachmentDistance({left:230,right:365,bottom:110},target,'after',1.5)));
});
const motor={id:'motor',type:'MotorPower'},start={id:'start',type:'Start'},repeat={id:'repeat',type:'Repeat',parameter:{type:'NumberInput',value:'2'},children:[]};
test('start belongs at strip beginning; before only allowed for first outside loop',()=>{
 assert.equal(canSnapInstruction({target:motor,incoming:start,side:'before'}),true);
 assert.equal(canSnapInstruction({target:motor,incoming:start,side:'after'}),false);
 assert.equal(canSnapInstruction({target:start,incoming:motor,side:'before'}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:start,side:'before',targetPrevious:{}}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:start,side:'before',targetInsideLoop:true}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:[start,{...repeat,parameter:null}],side:'before'}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:[{...repeat,parameter:null},{type:'Light'}],side:'before'}),true);
});
test('infinite loop terminates strip; empty loop cannot insert before existing continuation',()=>{
 assert.equal(canSnapInstruction({target:{...repeat,parameter:null},incoming:motor,side:'after'}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:repeat,side:'after',targetNext:{}}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:{...repeat,children:[motor]},side:'after',targetNext:{}}),true);
});
test('native editor prohibits nested loops including a loop later in dragged chain',()=>{
 assert.equal(canSnapInsideLoop({target:repeat,incoming:motor}),true);
 assert.equal(canSnapInsideLoop({target:repeat,incoming:start}),false);
 assert.equal(canSnapInsideLoop({target:repeat,incoming:[motor,{...repeat,id:'other'}]}),false);
 assert.equal(canSnapInstruction({target:motor,incoming:[{type:'WaitFor'},repeat],side:'after',targetInsideLoop:true}),false);
 assert.equal(canSnapInsideLoop({target:repeat,incoming:motor,incomingInsideLoop:true}),false);
});
test('empty loop wrapping uses native previous-block restrictions',()=>{
 assert.equal(canWrapWithLoop({target:motor,incomingLoop:repeat,targetPrevious:start}),true);
 assert.equal(canWrapWithLoop({target:motor,incomingLoop:repeat,targetPrevious:{type:'Light'}}),false);
 assert.equal(canWrapWithLoop({target:motor,incomingLoop:{...repeat,parameter:null},rightAdjacent:[repeat]}),false);
});
