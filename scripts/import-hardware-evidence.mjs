import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),directory=path.join(root,'analysis/hardware-projects');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const groups={
 palettedrag:{evidence:'app-members.json',selections:{
  'UI.CustomScrollRect':['OnBeginDrag','OnDrag','OnEndDrag'],
  'UI.PalettePanel':['OnPointerDown','OnPointerUp'],
  'Managers.ViewManager':['InitiateItemDrag','InitiateInstructionDrag'],
  'UI.DragAndDrop':['Start','OnBeginDrag','OnDrag','Update'],
  'Views.InstructionView':['LiftStrip','LiftUpRecursive']
 }},
 liveediting:{evidence:'app-members.json',selections:{
  'UI.DragAndDrop':['OnBeginDrag','OnEndDrag','HaltInstructionExecutionForDraggedStrip'],
  'Execution.Execution':['ExecutionWasStoppedForStrip'],
  'Execution.ExecutionEngine':['ExecInstruction','FindContainingLoopFromInstruction'],
  'Hardware.Motors.MotorController':['StopAllMotors','RunMotorWithOptions'],
  'Model.WaitForController':['InitWithInstruction','Tick'],
  'Views.ParameterBlockView':['SetParameterValue']
 }},
 display:{evidence:'app-members.json',selections:{
  'Content.DisplayPane':['OnDisplayPaneModelChange','NearestSnappingPosition','OnDrag','OnEndDrag','OnToggle','OnHide']
 }},
 useraudio:{evidence:'app-members.json',selections:{
  'UI.MicrophoneController':['AddUserSoundClip','GetUserRecordedClipCroppedForPlayback','GetSerializedUserClip','SetUserRecordedClips'],
  'Model.Project.PersisterUtilities':['GetUserClipPathForProjectID','GetUserClipDataPathForProjectID','WriteSamplesToBinaryFile','ReadSamplesFromBinaryFile'],
  'UserSoundClip':['Initialize','CropClip']
 }},
 webview:{evidence:'app-members.json',selections:{
  'Content.WebViewManager':['Initialize'],
  'Content.WebViewMessageHandler':['Handle'],
  'TopBar':['UpdateBackgroundSize','AnimateWebFrameStep','AnimateWebFrame','ShouldChangeTopBackgroundSize','GetFullWidthTopBarLength'],
  'LibraryTopBarGroup':['Initialize','OnClick','OnSubContentLibrary','SetButtonImage']
 }},
 addressing:{evidence:'app-members.json',selections:{
  'Hardware.HardwareAddressing':['ListOfAllHardwarePortsForAddressingMode'],
  'Views.HardwareAddressingView':['Start','MoveIndexImage','OnPointerDown'],
  'Views.InstructionBlockView':['OnLongPress','ActivateInstructionHardwareAddressingView','HardwareAddressingViewWasSingleTapped'],
  'Views.ParameterBlockView':['OnLongPress','ActivateParameterHardwareAddressingView','HardwareAddressingViewWasSingleTapped'],
  'Model.Instruction':['TogglePort'],
  'Model.Parameter':['TogglePort']
 }},
 connection:{evidence:'app-members.json',selections:{
  'UI.DetectedDevice':['Start','ConnectDisconnectButtonPressed','EnableConnectionDependentGraphics']
 }},
 sdk:{evidence:'sdk-members.json',selections:{
  'LegoDeviceSDK.Bluetooth.Services.BluetoothMotor':['RunInDirection','Brake','SendPower','ConvertUnsignedMotorPowerToSigned'],
  'LegoDeviceSDK.Bluetooth.BluetoothIo':['HandleUpdatedInputValue','WriteColorIndex'],
  'LegoDeviceSDK.IO.InputFormat':['InputFormatFromByteArray','InputFormatToByteArray'],
  'LegoDeviceSDK.IO.ConnectInfo':['FromByteArray'],
  'LegoDeviceSDK.IO.OutputCommand':['WriteMotorPowerCommand','WriteRgbLightIndex'],
 }},
 projects:{evidence:'app-members.json',selections:{
  'Model.Persistence.Persister':['ReadSceneFromJson','WriteViewsToJson','ReadInstructionObject','CreateParameterView'],
  'Model.Project.PersisterUtilities':['SaveProjectFileAs','ImportProject','ExportProject'],
  'Hardware.HardwarePort':['ToJson','ReadPortObject']
 }}
};
const results=[];
for(const [name,group]of Object.entries(groups)){
 const staticEvidence=readJson(path.join(root,'analysis',group.evidence));
 if(sha(fs.readFileSync(staticEvidence.subject.local_path))!==staticEvidence.subject.digest.sha256)throw Error('Evidence target changed');
 const methods=[];
 for(const [type,names]of Object.entries(group.selections)){
  const source=path.join(directory,type+'.decompiled.cs'),text=fs.readFileSync(source,'utf8');
  for(const methodName of names){
   const matches=staticEvidence.normalized_result.methods.filter(method=>method.declaring_type===type&&method.name===methodName);
   if(matches.length!==1)throw Error('Ambiguous metadata method '+type+'.'+methodName);
   const match=new RegExp('^\\t(?:public|private|internal|protected)[^\\r\\n]*\\b'+methodName+'\\([^\\r\\n]*\\)\\r?\\n\\t\\{','m').exec(text);
   if(!match)throw Error('Source method absent '+methodName);
   const start=match.index;let cursor=text.indexOf('{',start),depth=0;
   do{if(text[cursor]==='{')depth++;if(text[cursor]==='}')depth--;cursor++;}while(depth&&cursor<text.length);
   if(depth)throw Error('Unbalanced method body');
   const sourceText=text.slice(start,cursor),method=matches[0];
   methods.push({token:method.token,signature_sha256:method.signature.raw_sha256,normalized_il_sha256:method.body.normalized_il_sha256,reconstruction:{kind:'decompiled-csharp',language:'csharp',text:sourceText,text_sha256:sha(sourceText),source_path:source,start_line:text.slice(0,start).split('\n').length,end_line:text.slice(0,cursor).split('\n').length}});
  }
 }
 const input={static_members:staticEvidence,decompiler:{name:'ILSpy command line',version:'11.1.0.9782',family:'ilspy',executable_sha256:sha(fs.readFileSync(path.join(root,'tools/ilspy/ilspycmd.exe'))),options:['-t <exact type>','-o analysis/hardware-projects']},methods,notes:['Static decompilation only; no target code executed.','Native BLE notifications and .proj roundtrip verified with synthetic tests, not physical sensors or native-app import.']};
 const inputPath=path.join(directory,name+'-input.json');fs.writeFileSync(inputPath,JSON.stringify(input));
 const result=spawnSync(path.join(root,'tools/rea/node_modules/node/bin/node.exe'),[path.join(root,'tools/rea/node_modules/rea-agents/scripts/rea.mjs'),'import-managed-reconstruction',inputPath,'--format','json'],{encoding:'utf8',maxBuffer:64*1024*1024});
 if(result.status!==0)throw Error(result.stderr||'REA failed');
 const imported=JSON.parse(result.stdout);if(!imported.evidence_id)throw Error('No Evidence returned');
 fs.writeFileSync(path.join(directory,name+'-reconstruction.evidence.json'),result.stdout);
 results.push({group:name,source_evidence_id:staticEvidence.evidence_id,evidence_id:imported.evidence_id,methods:methods.length,artifact_sha256:staticEvidence.subject.digest.sha256});
}
const manifest={results,files:fs.readdirSync(directory).filter(file=>file.endsWith('.cs')).map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(directory,file)))}))};
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(results,null,2));
