import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProject,runProject,motorPacket,lightPacket} from '../web/core.js';
test('rechaza valores peligrosos, formato ajeno y repetición intermedia',()=>{
 for(const blocks of [[{type:'motor',value:101}],[{type:'wait',value:-1}],[{type:'repeat',value:2},{type:'stop'}],[{type:'light',value:'red'}]])assert.throws(()=>validateProject({version:1,name:'x',blocks}));
 assert.throws(()=>validateProject({Name:'proyecto original'}));
});
test('codifica el protocolo de motor con signo y RGB',()=>{
 assert.deepEqual([...motorPacket(2,-50)],[2,1,1,206]);assert.deepEqual([...motorPacket(1,0)],[1,1,1,0]);
 assert.deepEqual([...lightPacket('#12abff')],[6,4,3,18,171,255]);
});
test('repite la secuencia y para al terminar',async()=>{
 const calls=[];await runProject({version:1,name:'x',blocks:[{type:'motor',value:40},{type:'repeat',value:2}]},{motor:async n=>calls.push(n),stop:async()=>calls.push('stop')},new AbortController().signal);
 assert.deepEqual(calls,[40,40,'stop']);
});
test('la cancelación interrumpe una espera y siempre para',async()=>{
 const calls=[],ac=new AbortController();const run=runProject({version:1,name:'x',blocks:[{type:'wait',value:30},{type:'motor',value:100}]},{motor:async n=>calls.push(n),stop:async()=>calls.push('stop')},ac.signal);
 ac.abort();await assert.rejects(run,{name:'AbortError'});assert.deepEqual(calls,['stop']);
});
test('un error de transporte también intenta parar',async()=>{
 let stopped=false;await assert.rejects(runProject({version:1,name:'x',blocks:[{type:'motor',value:50}]},{motor:async()=>{throw Error('BLE');},stop:async()=>{stopped=true;}},new AbortController().signal),/BLE/);assert.equal(stopped,true);
});
