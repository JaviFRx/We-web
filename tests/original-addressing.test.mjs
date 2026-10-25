import test from 'node:test';
import assert from 'node:assert/strict';
import {activateHardwareAddressing,toggleHardwareAddressing,hardwareAddressingMode} from '../web/original-addressing.js';
import {parseOriginalProject,serializeOriginalProject} from '../web/original-projects.js';
test('native addressing starts at left1, cycles hub-major through six ports, then all',()=>{
 const node={type:'MotorPower'};assert.deepEqual(activateHardwareAddressing(node),{PortNumber:1,ConnectorSide:0});
 for(const [hub,side]of [[1,1],[2,0],[2,1],[3,0],[3,1]])assert.deepEqual(toggleHardwareAddressing(node),{PortNumber:hub,ConnectorSide:side});
 assert.equal(toggleHardwareAddressing(node),null);assert.equal(node.port,null);assert.equal(node.unsupportedHardware,false);
});
test('light cycles internal hubs and only hardware sensor parameters support addressing',()=>{
 const node={type:'Light'};activateHardwareAddressing(node);
 assert.deepEqual(toggleHardwareAddressing(node),{PortNumber:2,ConnectorSide:2});
 assert.deepEqual(toggleHardwareAddressing(node),{PortNumber:3,ConnectorSide:2});assert.equal(toggleHardwareAddressing(node),null);
 for(const type of ['TiltSensorNeutral','MotionSensor'])assert.equal(hardwareAddressingMode({type}),'ByPort');
 for(const type of ['SoundSensorInput','DisplayInput','WaitFor','NumberInput'])assert.equal(hardwareAddressingMode({type}),'Unsupported');
});
test('selection serializes exact native multi-hub port and clears it at end of cycle',()=>{
 const node={type:'MotorPower',parameter:{type:'NumberInput',value:'8'}};activateHardwareAddressing(node);toggleHardwareAddressing(node);toggleHardwareAddressing(node);
 const project={id:'test',name:'test',strips:[{x:0,y:0,nodes:[node]}]};
 assert.deepEqual(parseOriginalProject(serializeOriginalProject(project)).strips[0].nodes[0].nativePort,{PortNumber:2,ConnectorSide:0});
 for(let i=0;i<4;i++)toggleHardwareAddressing(node);
 assert.equal(parseOriginalProject(serializeOriginalProject(project)).strips[0].nodes[0].nativePort,undefined);
});
