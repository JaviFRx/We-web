import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stepOriginalOnboardingPose,prepareOriginalOnboardingTree,originalLocalizedText} from '../web/original-teacher-resources.js';
const catalog=JSON.parse(await readFile(new URL('../web/original-assets.json',import.meta.url),'utf8'));
const all=n=>[n,...n.children.flatMap(all)];
test('Arabic strings restore native trademark/URL substitutions and omit tashkeel',()=>{
 assert.equal(originalLocalizedText('ابنِ LEGO REPLACEWITHTRADEMARK REPLACEWITHHTTPSa REPLACEWITHHTTPb'),'ابن LEGO ® https://a http://b');
 assert.equal(originalLocalizedText('LEGO®'),'LEGO®');
});
test('native animation lerps current pose each frame, clamps boosted progress and preserves zero boost',()=>{
 const initial={Position:{x:0,y:0},Size:{x:20,y:20},Rotation:{x:0,y:0,z:0},Color:{r:1,g:1,b:1,a:0}};
 const target={Position:{x:100,y:40},Size:{x:100,y:100},Rotation:{x:0,y:0,z:90},Color:{r:1,g:1,b:1,a:1},AnimiationSpeedBoost:1};
 const first=stepOriginalOnboardingPose(initial,target,.25),second=stepOriginalOnboardingPose(first,target,.5);
 assert.equal(first.Position.x,25);assert.equal(second.Position.x,62.5);assert.equal(second.Color.a,.625);
 assert.equal(stepOriginalOnboardingPose(initial,{...target,AnimiationSpeedBoost:5},.25).Position.x,100);
 assert.deepEqual(stepOriginalOnboardingPose(initial,{...target,AnimiationSpeedBoost:0},1),initial);
 assert.equal(initial.Position.x,0);
});
test('Arabic source initialization mirrors authored positions and moves close anchor without mutating catalog',()=>{
 const source=catalog.geometry.Onboarding,serialized=JSON.stringify(source),result=prepareOriginalOnboardingTree(source,true);
 const owner=all(result).find(n=>n.name==='OnboardingManager'),originalOwner=all(source).find(n=>n.name==='OnboardingManager');
 const manager=owner.components.find(c=>c.script?.m_ClassName==='OnboardingManager').fields,originalManager=originalOwner.components.find(c=>c.script?.m_ClassName==='OnboardingManager').fields;
 for(let i=0;i<manager.States.length;i++)for(let j=0;j<manager.States[i].Objects.length;j++)assert.equal(manager.States[i].Objects[j].Position.x,-originalManager.States[i].Objects[j].Position.x);
 for(let i=0;i<owner.children.length;i++){const rect=owner.children[i].components.find(c=>c.type==='RectTransform').fields,originalRect=originalOwner.children[i].components.find(c=>c.type==='RectTransform').fields;assert.equal(rect.m_AnchoredPosition.x,-originalRect.m_AnchoredPosition.x);}
 const close=all(result).flatMap(n=>n.components).find(c=>c.path_id===manager.CloseButtonTransform.m_PathID).fields;
 assert.deepEqual(close.m_AnchorMin,{x:0,y:1});assert.deepEqual(close.m_AnchorMax,{x:0,y:1});
 assert.equal(JSON.stringify(source),serialized);
});
test('authored transition duration overrides C# default: all installed prefabs use 0.6 seconds',()=>{
 for(const tree of [catalog.geometry.Onboarding,catalog.layout.teacherResources,catalog.layout.teacherSlides]){const manager=all(tree).flatMap(n=>n.components).find(c=>/^(OnboardingManager|TeacherResourcesManager)$/.test(c.script?.m_ClassName));assert.ok(Math.abs(manager.fields.ScrollSnapTimeInSeconds-.6)<.000001);}
});
