import {validateProject,demo} from './core.js';
export const LIBRARY_KEY='wedo-lab-library-v2';
export function entry(project){return {id:crypto.randomUUID(),updatedAt:new Date().toISOString(),project:validateProject(project)};}
export function initialLibrary(legacy){const first=entry(legacy?validateProject(JSON.parse(legacy)):demo());return {version:2,activeId:first.id,projects:[first]};}
export function validateLibrary(value){
 if(value?.version!==2||!Array.isArray(value.projects)||!value.projects.length||value.projects.length>200)throw Error('Biblioteca no válida.');
 const ids=new Set();const projects=value.projects.map(e=>{if(typeof e.id!=='string'||ids.has(e.id)||!e.id||e.id.length>100||!Number.isFinite(Date.parse(e.updatedAt)))throw Error('Identidad de proyecto no válida.');ids.add(e.id);return {id:e.id,updatedAt:e.updatedAt,project:validateProject(e.project)};});
 if(!ids.has(value.activeId))throw Error('Proyecto activo no válido.');return {version:2,activeId:value.activeId,projects};
}
