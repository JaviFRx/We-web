import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLobbyImportExportAvailable} from '../web/original-lobby.js';
test('original import/export controls require Japanese and Windows together',()=>{
 for(const language of ['ES','ENUS','arabic','japanese'])for(const platform of ['Windows','Win32','MacIntel','Darwin','Linux x86_64'])assert.equal(nativeLobbyImportExportAvailable(language,platform),language==='japanese'&&['Windows','Win32'].includes(platform));
});
