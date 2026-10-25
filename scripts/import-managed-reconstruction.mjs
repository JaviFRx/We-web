import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'analysis/managed-reconstruction');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'analysis/app-members.json'),'utf8').replace(/^\uFEFF/,''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(fs.readFileSync(evidence.subject.local_path))!==evidence.subject.digest.sha256)throw Error('Artifact differs from static REA evidence.');
const selections={
 'Hardware.Motors.MotorController':['RunMotorWithOptions','StopMotorOnPort','SetSpeed','SetOptions'],
 'Hardware.Motors.MotorOptions':['DefaultOptions','OptionsFromMerging','SpeedFromRawSpeed'],
 'Execution.InstructionInterpreter':['InterpretInstruction'],
 'Execution.ExecutionEngine':['ExecInstruction','OnDidStopExecutingInstruction'],
 'RGBLightController':['SetColorNumber','ProgramDidStopRunning'],
 'LEGODeviceUnitySDK.LEGORGBLight':['Color0','Color1','Color2','Color3','Color4','Color5','Color6','Color7','Color8','Color9','Color10'],
 'Views.PaletteViewFactory':['CreateViews'],
 'Model.InstructionFactory':['CreateInstructionTypeDefinition','CreateInstruction'],
 'Managers.SnapRuleManager':['Update','ValidateLeft','ValidateRight','ValidateLoopAround','ValidateLoopInner'],
};
const methods=[];
for(const [type,names] of Object.entries(selections)){
 const source=path.join(out,type+'.decompiled.cs');
 const text=fs.readFileSync(source,'utf8');
 for(const name of names){
  const observed=evidence.normalized_result.methods.filter(m=>m.declaring_type===type&&m.name===name);
  if(observed.length!==1)throw Error('Ambiguous method '+type+'.'+name);
  const match=new RegExp('^\\t(?:public|private|internal|protected)[^\\r\\n]*\\b'+name+'\\([^\\r\\n]*\\)\\r?\\n\\t\\{','m').exec(text);
  if(!match)throw Error('No declaration for '+type+'.'+name);
  const start=match.index;let cursor=text.indexOf('{',start),depth=0;
  do{if(text[cursor]==='{')depth++;if(text[cursor]==='}')depth--;cursor++;}while(depth&&cursor<text.length);
  if(depth!==0)throw Error('Unbalanced body');
  const snippet=text.slice(start,cursor),m=observed[0];
  methods.push({token:m.token,signature_sha256:m.signature.raw_sha256,normalized_il_sha256:m.body.normalized_il_sha256,reconstruction:{kind:'decompiled-csharp',language:'csharp',text:snippet,text_sha256:sha(snippet),source_path:source,start_line:text.slice(0,start).split('\n').length,end_line:text.slice(0,cursor).split('\n').length}});
 }
}
const exe=path.join(root,'tools/ilspy/ilspycmd.exe');
const input={static_members:evidence,decompiler:{name:'ILSpy command line',version:'11.1.0.9782',family:'ilspy',executable_sha256:sha(fs.readFileSync(exe)),options:['-t <exact type>','-o analysis/managed-reconstruction']},methods,notes:['C# is ILSpy reconstruction, not original source. Method identities are locked to canonical REA metadata/normalized IL.','No target assembly executed or loaded in the application runtime.','Selected source slices use balanced braces; all selected methods have uniquely named declarations.','Complete class files retain nested/lambda code reconstructed by ILSpy; generated closure bodies require separate verification if modifying behavior.']};
const inputPath=path.join(out,'import-input.json');fs.writeFileSync(inputPath,JSON.stringify(input,null,2));
const cli=spawnSync(path.join(root,'tools/rea/node_modules/node/bin/node.exe'),[path.join(root,'tools/rea/node_modules/rea-agents/scripts/rea.mjs'),'import-managed-reconstruction',inputPath,'--format','json'],{encoding:'utf8',maxBuffer:32*1024*1024});
if(cli.status!==0)throw Error(cli.stderr||cli.stdout);
const imported=JSON.parse(cli.stdout);fs.writeFileSync(path.join(out,'reconstruction.evidence.json'),cli.stdout);
const files=fs.readdirSync(out).filter(n=>n.endsWith('.cs')).map(n=>({path:n,sha256:sha(fs.readFileSync(path.join(out,n)))}));
const manifest={artifact:evidence.subject,static_evidence_id:evidence.evidence_id,reconstruction_evidence_id:imported.evidence_id,methods:methods.length,decompiler:input.decompiler,files,limitations:input.notes};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({evidence_id:imported.evidence_id,methods:methods.length,files:files.length}));
