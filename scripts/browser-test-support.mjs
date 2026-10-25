import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
let implementation;
for(const candidate of [process.env.PLAYWRIGHT_MODULE,'playwright','playwright-core','../tools/rea/node_modules/playwright-core'].filter(Boolean)){
 try{implementation=require(candidate);break;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
}
if(!implementation)throw Error('Install Playwright for browser tests, or set PLAYWRIGHT_MODULE to its location.');
export const chromium=implementation.chromium;
export function browserOptions(){
 const candidates=[process.env.PLAYWRIGHT_EXECUTABLE_PATH];
 if(process.platform==='win32')for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean)){
  candidates.push(path.join(base,'Google/Chrome/Application/chrome.exe'),path.join(base,'Microsoft/Edge/Application/msedge.exe'));
 }
 const executablePath=candidates.find(candidate=>candidate&&existsSync(candidate));
 return {headless:true,...(executablePath?{executablePath}:{})};
}
