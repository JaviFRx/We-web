import test from 'node:test';
import assert from 'node:assert/strict';
import {OriginalRuntime,ORIGINAL_DEFINITIONS,ORIGINAL_PARAMETERS,createInstruction,createParameter} from '../web/original-runtime.js';
const node=(type,value,extra={})=>{const n=createInstruction(type);if(value!==undefined)n.parameter={...createParameter('NumberInput'),value:String(value)};return Object.assign(n,extra);};
const setup=(overrides={})=>{
 const commands=[],display=[],states=[];
 const driver={motor:async(...args)=>commands.push(['motor',...args]),brake:async(...args)=>commands.push(['brake',...args]),lightIndex:async(...args)=>commands.push(['light',...args]),...overrides.driver};
 const runtime=new OriginalRuntime({driver,onDisplay:s=>display.push(s),onState:s=>states.push(s),minBlockMs:0,pollMs:1,...overrides});
 return {runtime,commands,display,states};
};

test('sound duration mode re-evaluates random independently and does not await playback end',async()=>{
 const calls=[],values=[1/29,20/29];let draws=0;
 const {runtime}=setup({random:()=>{draws++;return values.shift();},onSound:async(value,options)=>{calls.push(['play',value,options.wait]);},onSoundDuration:async value=>{calls.push(['duration',value]);return 0;}});
 const sound=node('PlaySound',undefined,{parameter:createParameter('RandomInput')});
 await runtime.run([sound,node('Display','after')]);
 assert.equal(draws,2);assert.deepEqual(calls,[['play','1',false],['duration','20']]);assert.equal(runtime.display.label,'after');
});

test('missing sound zero duration continues and sound fallback still awaits its callback',async()=>{
 let played;const {runtime}=setup({onSound:async value=>{played=value;},onSoundDuration:async()=>0});
 await runtime.run([node('PlaySound',0),node('Display','continued')]);assert.equal(played,'0');assert.equal(runtime.display.label,'continued');
 let finish;const fallback=setup({onSound:()=>new Promise(resolve=>{finish=resolve;})}).runtime;
 const running=fallback.run([node('PlaySound',1),node('Display','finished')]);
 while(!finish)await new Promise(resolve=>setTimeout(resolve,0));assert.notEqual(fallback.display.label,'finished');finish();await running;assert.equal(fallback.display.label,'finished');
});

test('sound duration wait is stoppable and independent of playback-ended events',async()=>{
 let lookedUp=false;const {runtime}=setup({onSound:async(_value,{wait})=>assert.equal(wait,false),onSoundDuration:()=>{lookedUp=true;return 60;}});
 const running=runtime.run([node('PlaySound',1),node('Display','never')]);
 const rejected=assert.rejects(running,{name:'AbortError'});
 while(!lookedUp)await new Promise(resolve=>setTimeout(resolve,0));await runtime.stop();await rejected;assert.notEqual(runtime.display.label,'never');
});

test('REA InstructionFactory defaults and parameter modes are retained',()=>{
 assert.equal(Object.keys(ORIGINAL_DEFINITIONS).length,17);
 assert.equal(Object.keys(ORIGINAL_PARAMETERS).length,7);
 assert.equal(createInstruction('MotorPower').parameter.value,'8');
 assert.equal(createInstruction('Light').parameter.value,'1');
 assert.equal(createInstruction('Repeat').parameter,null);
 assert.equal(createInstruction('StartOnKeyPress').key,'A');
 assert.equal(createParameter('MotionSensor').mode,'DistanceSensorChange');
 assert.equal(createInstruction('MotorThisWay').mode,'MotorCounterClockwise');
});

test('power anticipates the first forward direction and settings persist by port',async()=>{
 const {runtime,commands}=setup();
 await runtime.run([node('MotorPower',3,{port:1}),node('MotorThatWay',undefined,{port:1})]);
 assert.deepEqual(commands,[['motor',1,30],['motor',1,30]]);
 commands.length=0;
 await runtime.run([node('MotorThisWay',undefined,{port:1})]);
 assert.deepEqual(commands,[['motor',1,-30]]);
 commands.length=0;
 await runtime.run([node('MotorThatWay',undefined,{port:2})]);
 assert.deepEqual(commands,[['motor',2,80]]);
});

test('unspecified port addresses both motors; timed block brakes, natural end does not',async()=>{
 const {runtime,commands}=setup();
 await runtime.run([node('MotorOnFor',0)]);
 assert.deepEqual(commands,[['motor',1,-80],['motor',2,-80],['brake',1],['brake',2]]);
 commands.length=0;
 await runtime.run([node('MotorPower',4)]);
 assert.deepEqual(commands,[['motor',1,-40],['motor',2,-40]]);
 await runtime.stop();
 assert.deepEqual(commands.slice(-2),[['brake',1],['brake',2]]);
});

test('nested counted loops run the original count; empty unlimited loops complete',async()=>{
 const {runtime,commands}=setup();
 const inner=node('Repeat',3,{children:[node('Light',2)]});
 await runtime.run([node('Repeat',2,{children:[inner]})]);
 assert.equal(commands.length,6);
 await runtime.run([node('Repeat')]);
});

test('stop interrupts unlimited loop and pending wait without completing its tail',async()=>{
 const {runtime,commands}=setup();
 const run=runtime.run([node('Repeat',undefined,{children:[node('MotorPower',2,{port:1}),node('WaitFor',60)]}),node('Light',9)]);
 const rejection=assert.rejects(run,{name:'AbortError'});
 while(!commands.length)await new Promise(resolve=>setTimeout(resolve,1));
 await runtime.stop();await rejection;
 assert.equal(commands.some(c=>c[0]==='light'),false);
 assert.deepEqual(commands.slice(-2),[['brake',1],['brake',2]]);
});

test('display arithmetic and resize follow recovered semantics including nonnumeric baseline',async()=>{
 const {runtime,display}=setup();
 await runtime.run([node('Display','hello'),node('DisplayAdd',2,{mode:'DisplaySubtract'}),node('DisplayAdd',3,{mode:'DisplayMultiplication'}),node('DisplayResize',undefined,{mode:'DisplayLarger'})]);
 assert.equal(runtime.display.label,'-6');assert.equal(runtime.display.fullscreen,true);
 await runtime.run([node('Display','abc'),node('DisplayAdd',4,{mode:'DisplayDivide'})]);
 assert.equal(runtime.display.label,'4');
 await runtime.run([node('DisplayResize',undefined,{mode:'DisplayHide'})]);
 assert.equal(display.at(-1).shown,false);
});

test('random range differs for sound/background and ordinary parameters',async()=>{
 const {runtime}=setup({random:()=>0.999999});
 assert.equal(await runtime.parameter(createParameter('RandomInput'),node('Light')),'9');
 assert.equal(await runtime.parameter(createParameter('RandomInput'),node('PlaySound')),'28');
});

test('message dispatch works locally and keyboard compares the original key field',async()=>{
 const {runtime,commands}=setup();
 runtime.registerStrips([[node('StartOnMessage',undefined,{parameter:{...createParameter('TextInput'),value:'go'}}),node('Light',4)],[node('StartOnKeyPress',undefined,{key:'B'}),node('Light',5)]]);
 await runtime.message('go');await runtime.key('b');await runtime.key('B');
 assert.deepEqual(commands,[['light',4,null],['light',5,null]]);
 commands.length=0;await runtime.run([node('SendMessage',undefined,{parameter:{...createParameter('TextInput'),value:'go'}})]);
 while(runtime.running)await new Promise(resolve=>setTimeout(resolve,1));
 assert.deepEqual(commands,[['light',4,null]]);
 assert.equal(runtime.capabilities.lan,false);
});

test('sensor wait modes and loop thresholds use original comparison values',async()=>{
 let samples=[8,7,6];const calls=[];
 const {runtime}=setup({driver:{readSensor:async(type,port)=>{calls.push([type,port]);return samples.shift()??6;}}});
 await runtime.run([node('WaitFor',undefined,{parameter:{type:'MotionSensor',mode:'DistanceSensorCloser',port:2,value:''}})]);
 assert.deepEqual(calls,[['MotionSensor',2],['MotionSensor',2]]);
 samples=[0,7];
 await runtime.run([node('WaitFor',undefined,{parameter:{type:'TiltSensorNeutral',mode:'TiltSensorLeft',port:1,value:''}})]);
});

test('missing sensor/sound support is explicit, not simulated success',async()=>{
 const {runtime}=setup();
 await assert.rejects(runtime.run([node('PlaySound',1)]),/sonidos originales/);
 await assert.rejects(runtime.run([node('WaitFor',undefined,{parameter:createParameter('MotionSensor')})]),/readSensor/);
});

test('light uses discrete index capped to 10, and quiet completion restores default',async()=>{
 let resets=0;const {runtime}=setup({settleMs:1,driver:{lightIndex:async index=>assert.equal(index,10),resetLights:async()=>resets++}});
 await runtime.run([node('Light',12)]);
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(resets,1);
});

test('invalid topology fails before commands and independent strips can run concurrently',async()=>{
 const {runtime,commands}=setup();const cycle=node('Repeat');cycle.children.push(cycle);
 await assert.rejects(runtime.run([cycle]),/circulares/);
 await Promise.all([runtime.run([node('WaitFor',0.01),node('Light',3)]),runtime.run([node('Light',4)])]);
 assert.deepEqual(commands,[['light',4,null],['light',3,null]]);
});

test('unsupported multi-hub programs remain inspectable but cannot send commands',async()=>{
 const {runtime,commands}=setup();const strip=[node('MotorPower',8,{unsupportedHardware:true})];
 assert.doesNotThrow(()=>runtime.registerStrips([strip]));
 await assert.rejects(runtime.run(strip),/otro hub/);assert.deepEqual(commands,[]);
});

test('sound callback is awaited and receives cancellation signal',async()=>{
 let soundStarted=false;
 const {runtime,commands}=setup({onSound:async(id,{signal})=>{
  assert.equal(id,'1');soundStarted=true;
  await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));
 }});
 const run=runtime.run([node('PlaySound',1),node('Light',8)]),rejection=assert.rejects(run,{name:'AbortError'});
 while(!soundStarted)await new Promise(resolve=>setTimeout(resolve,1));
 await runtime.stop();await rejection;assert.deepEqual(commands,[]);
});

test('repeat sensor reads once at entry and stops when threshold is reached',async()=>{
 let readings=[0,9],lights=0;
 const {runtime}=setup({driver:{readSensor:async()=>readings.shift()??9,lightIndex:async()=>lights++}});
 await runtime.run([node('Repeat',undefined,{parameter:createParameter('SoundSensorInput'),children:[node('Light',2)]})]);
 assert.equal(lights,1);
});

test('drag stops only matching executors, preserving timed motor brake and other strips',async()=>{
 const {runtime,commands}=setup();
 const timed=node('MotorOnFor',0.08,{port:1}),tail=node('Display','never');
 const run=runtime.run([timed,tail]);const stopped=assert.rejects(run,{name:'AbortError'});
 const other=runtime.run([node('WaitFor',0.03),node('Display','other')]);
 while(!commands.length)await new Promise(r=>setTimeout(r,1));
 assert.equal(runtime.stopForDraggedInstructions([tail]),0);
 assert.equal(runtime.stopForDraggedInstructions([timed,tail]),1);await stopped;
 assert.equal(commands.some(c=>c[0]==='brake'),false);
 await other;assert.equal(runtime.display.label,'other');
 while(runtime.pendingActions.size)await new Promise(r=>setTimeout(r,5));
 assert.deepEqual(commands,[['motor',1,-80],['brake',1]]);
});

test('live wait value edits and parameter removal release the waiter',async()=>{
 const {runtime}=setup();const wait=node('WaitFor',60);
 const run=runtime.run([wait,node('Display','edited')]);
 await new Promise(r=>setTimeout(r,5));wait.parameter.value='0';await run;
 assert.equal(runtime.display.label,'edited');
 wait.parameter.value='60';const second=runtime.run([wait,node('Display','detached')]);
 await new Promise(r=>setTimeout(r,5));wait.parameter=null;await second;
 assert.equal(runtime.display.label,'detached');
});

test('live list continuation survives removal before current index and uses newly appended tail',async()=>{
 const {runtime}=setup();const wait=node('WaitFor',60),prior=node('Start'),old=node('Display','old');
 const list=[prior,wait,old];const run=runtime.run(list,{startIndex:1});
 await new Promise(r=>setTimeout(r,5));list.splice(0,1);list.splice(1,1,node('Display','new'));wait.parameter.value='0';
 await run;assert.equal(runtime.display.label,'new');
});

test('dragging a loop ancestor stops its pending child, but does not stop sound playback signal',async()=>{
 let soundSignal;const {runtime}=setup({onSound:async(_v,{signal})=>{soundSignal=signal;},onSoundDuration:()=>0.04});
 const sound=node('PlaySound',1),loop=node('Repeat',2,{children:[sound]});
 const run=runtime.run([loop,node('Display','never')]);const stopped=assert.rejects(run,{name:'AbortError'});
 while(!soundSignal)await new Promise(r=>setTimeout(r,1));
 assert.equal(runtime.stopForDraggedInstructions([loop]),1);await stopped;
 assert.equal(soundSignal.aborted,false);
 await runtime.stop();assert.equal(soundSignal.aborted,true);
});

test('active child follows live destination tail and restarts its new containing loop',async()=>{
 const {runtime,display}=setup();const wait=node('WaitFor',60);
 const source=node('Repeat',3,{children:[wait]}),destination=node('Repeat',1,{children:[]});
 const a=[source,node('Display','old tail')],b=[destination,node('Display','new tail')];runtime.registerStrips([a,b]);
 const run=runtime.run(a);await new Promise(r=>setTimeout(r,5));
 source.children.splice(0,1);destination.children.push(wait,node('DisplayAdd',1));wait.parameter.value='0';
 await run;
 assert.deepEqual(display.map(s=>s.label),['1','2','new tail']);
});

test('child detached into a top-level strip finishes its new tail without resuming former loop',async()=>{
 const {runtime,display}=setup();const wait=node('WaitFor',60);
 const loop=node('Repeat',3,{children:[wait]}),a=[loop,node('Display','old tail')],b=[];
 runtime.registerStrips([a,b]);const run=runtime.run(a);await new Promise(r=>setTimeout(r,5));
 loop.children.splice(0,1);b.push(wait,node('Display','detached tail'));wait.parameter.value='0';
 await run;assert.deepEqual(display.map(s=>s.label),['detached tail']);
});
