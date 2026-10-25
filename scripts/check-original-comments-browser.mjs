import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions} from './browser-test-support.mjs';
const directory='analysis/verification/comments';await mkdir(directory,{recursive:true});
const browser=await chromium.launch(browserOptions());
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/');await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 const source=page.locator('.original-palette-block[data-type=CommentBlock]');await source.scrollIntoViewIfNeeded();const box=await source.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(1320,700,{steps:16});await page.mouse.up();
 const comment=page.locator('.original-comment'),field=comment.locator('textarea'),rect=await comment.boundingBox();
 assert.ok(Math.abs(rect.x-1176)<1);assert.ok(Math.abs(rect.y-631.375)<1);assert.ok(Math.abs(rect.width-281.25)<1);
 await page.screenshot({path:directory+'/43-comment-web.png'});
 await field.click();await field.fill('Prueba de comentario');await page.waitForTimeout(300);
 assert.equal(await page.locator('.wedo-original-selection-highlighter').count(),1);assert.equal(await page.locator('.wedo-native-parameter-editor').isVisible(),false,'text editing does not display a numeric keyboard');
 await page.screenshot({path:directory+'/45-comment-web.png'});
 await field.press('Enter');await field.press('B');assert.match(await field.inputValue(),/\nB$/,'comment keeps multiline text');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.wedo-original-selection-highlighter').count(),0);
 await page.reload();await page.locator('.wedo-lobby-project-open').first().click();assert.equal(await field.inputValue(),'Prueba de comentario\nB');
 const bounds=await comment.boundingBox();await page.mouse.move(bounds.x+3,bounds.y+20);await page.mouse.down();await page.mouse.move(600,1000,{steps:12});await page.mouse.up();assert.equal(await comment.count(),0,'dropping in palette removes comment');
 assert.deepEqual(errors,[]);await writeFile(directory+'/results.json',JSON.stringify({status:'PASS',checks:['native initial offset','native bubble size','text spotlight without numeric keys','multiline input','persistence','drag deletion'],hardware:'not used'},null,2));console.log('PASS native comment geometry, spotlight, multiline text, persistence and drag deletion.');
}finally{await browser.close();}
