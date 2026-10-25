// Project retained REA metadata; do not load or execute the target assembly.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const members=await readJson(path.join(base,'analysis/app-members.json'));
const artifactPath=members.normalized_result.artifact.path;
const digest=createHash('sha256').update(await readFile(artifactPath)).digest('hex');
if(digest!==members.normalized_result.artifact.sha256)throw Error('Target changed: refresh REA evidence before projecting.');
const input=path.join(base,'analysis/managed-graph-input.json');
await writeFile(input,JSON.stringify({managed_members:members}));
const result=spawnSync(path.join(base,'tools/rea/node_modules/node/bin/node.exe'),[
 path.join(base,'tools/rea/node_modules/rea-agents/scripts/rea.mjs'),
 'project-managed-application-graph',input,'--format','json'
],{encoding:'utf8',maxBuffer:128*1024*1024});
if(result.status!==0)throw Error(result.stderr||'REA projection failed');
const evidence=JSON.parse(result.stdout);
if(!evidence.evidence_id)throw Error('REA did not return Evidence');
await writeFile(path.join(base,'analysis/managed-graph.json'),result.stdout);
console.log(JSON.stringify({evidence_id:evidence.evidence_id,summary:evidence.normalized_result.summary,limitations:evidence.limitations},null,2));
