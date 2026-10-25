import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINAL_DISPLAY,displaySnapPoints,snapOriginalDisplay,clampOriginalDisplay} from '../web/original-display.js';
test('display sizes and nine snap locations match recovered code and serialized topbar65',()=>{
 assert.equal(ORIGINAL_DISPLAY.small.width,440.8);assert.equal(ORIGINAL_DISPLAY.large.height,551);
 const points=displaySnapPoints(1024,768);assert.equal(points.length,9);assert.deepEqual(snapOriginalDisplay({x:0,y:0},1024,768),{x:0,y:30});
 const bounds=clampOriginalDisplay({x:-1000,y:1000},1024,768);assert.deepEqual(bounds,points[0]);
 assert.equal(384-bounds.y-275.5/2,75);assert.ok(Math.abs(512+bounds.x-440.8/2-10)<1e-8);
});
