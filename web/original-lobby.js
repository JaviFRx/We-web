// Geometry: Unity level1 Lobby + sharedassets1 LobbyProject, see asset catalog.geometry.
// Project thumbnails are supplied by the editor; native Unity used a canvas screenshot.
export const nativeLobbyImportExportAvailable=(language,platform)=>language==='japanese'&&/^win/i.test(platform);
export function showOriginalLobby(options){
 const {catalog,onOpen,onCreate,onRename,onDelete,onImport,onExport,onClose,onDuplicate,onTutorial,onActivities,onTeacher,onSettings}=options;
 const labels=(catalog.activeTranslations||catalog.translations?.ES)||{}, assets=catalog.ui.lobby;
 const previousFocus=document.activeElement;
 const nativeImportExport=nativeLobbyImportExportAvailable(localStorage.getItem('wedo-language')||'ES',navigator.userAgentData?.platform||navigator.platform);
 if(!document.querySelector('link[data-original-lobby]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/original-lobby.css';link.dataset.originalLobby='';document.head.append(link);}
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
 const image=(key,cls)=>{const img=make('img',cls);img.alt='';img.draggable=false;const s=catalog.sprites[assets[key]||key];if(s)img.src=s.url;return img;};
 const overlay=make('section','wedo-lobby');overlay.tabIndex=-1;overlay.role='dialog';overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',labels.LobbyUserProjectsAreaTitle||'Mis proyectos');
 const viewport=make('div','wedo-lobby-viewport'), board=make('div','wedo-lobby-board'), hero=make('div','wedo-lobby-hero'),gallery=make('section','wedo-lobby-gallery'),grid=make('div','wedo-lobby-grid'),status=make('div','wedo-lobby-status');status.role='status';
 let source=options.projects,closed=false;
 const close=()=>{if(closed)return;closed=true;overlay.remove();window.removeEventListener('resize',resize);previousFocus?.focus();onClose?.();};
 const run=async(action,exit=false)=>{try{status.textContent='';await action();if(exit)close();return true;}catch(e){status.textContent=e?.message||String(e);return false;}};
 const button=(key,label,fn,cls='')=>{const b=make('button',cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.append(image(key));b.onclick=fn;return b;};
 hero.append(image('circlesWhite','wedo-lobby-circles'),image('snail','wedo-lobby-snail'));
 hero.append(make('div','wedo-lobby-welcome',labels.LobbyQuickStartProjectTitle||'Nuevo en WeDo 2.0'));
 if(onTutorial){const b=button('quickstart',labels.LobbyQuickStartProjectButton,()=>run(onTutorial,true),'wedo-lobby-first');b.append(make('span','',labels.LobbyQuickStartProjectButton));hero.append(b);}
 for(const [cb,key,kind,title,subtitle] of [[onTeacher,'teacher','teacher','LobbyTeacherResourcesButtonTitle','LobbyTeacherResourcesButtonSubtitle'],[onActivities,'classroom','classroom','LobbyClassroomProjectsButtonTitle','LobbyClassroomProjectsButtonSubtitle']])if(cb){const b=button(key,labels[title],()=>run(cb,key!=='teacher'),'wedo-lobby-feature wedo-lobby-'+kind);b.append(make('strong','',labels[title]),make('span','',labels[subtitle]));hero.append(b);}
 const top=make('div','wedo-lobby-top');top.append(image('logo','wedo-lobby-logo'));if(onSettings)top.append(button('LobbyInfoButton','Ajustes',()=>run(onSettings),'wedo-lobby-settings'));top.append(button('close','Volver al programa',close,'wedo-lobby-close'));
 gallery.append(image('circlesGreen','wedo-lobby-green-circles'),make('h1','',labels.LobbyUserProjectsAreaTitle||'Mis proyectos'),grid);
 board.append(hero,gallery);viewport.append(board);overlay.append(viewport,top,status);document.body.append(overlay);
 const chooseFile=make('input');chooseFile.type='file';chooseFile.accept='.proj,.wedo,.json';chooseFile.hidden=true;chooseFile.style.display='none';chooseFile.setAttribute('aria-label','Importar proyecto');chooseFile.onchange=()=>{const file=chooseFile.files[0];chooseFile.value='';if(file&&onImport)run(()=>onImport(file),true);};overlay.append(chooseFile);
 // Browser file access is available without adding tiles absent in the native UI.
 overlay.addEventListener('dragover',e=>{if(onImport&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
 overlay.addEventListener('drop',e=>{const file=e.dataTransfer?.files[0];if(file&&onImport){e.preventDefault();e.stopPropagation();run(()=>onImport(file),true);}});
 function tile(key,label,action){const b=button(key,label,action,'wedo-lobby-tile wedo-lobby-new');b.prepend(image('projectBackground','wedo-lobby-card-bg'));return b;}
 async function confirmDelete(project,id,card){
  await run(async()=>{const {showOriginalConfirmation}=await import('/original-settings.js');const accepted=await showOriginalConfirmation({catalog,message:labels.LobbyDeleteSingleProjectsDialog,labels});if(accepted){await onDelete(id);card.remove();resize();}else{card.querySelector('.wedo-lobby-edit')?.remove();card.querySelector('.wedo-lobby-project-age').hidden=false;card.querySelector('.wedo-lobby-edit-button').hidden=false;card.querySelector('button')?.focus();}});
 }
 function render(){
  grid.replaceChildren();if(onCreate)grid.append(tile('create','Nuevo proyecto',()=>run(()=>onCreate(),true)));if(onImport&&nativeImportExport)grid.append(tile('import','Importar proyecto',()=>chooseFile.click()));
  const entries=Array.isArray(source)?source.map(p=>[p.id,p]):Object.entries(source||{});
  entries.sort((a,b)=>(new Date(b[1].lastOpenDate||b[1].updatedAt||0))-(new Date(a[1].lastOpenDate||a[1].updatedAt||0)));
  for(const [id,p] of entries){
   const card=make('article','wedo-lobby-tile');card.dataset.projectId=id;if(id===options.currentId)card.setAttribute('aria-current','true');card.append(image('projectBackground','wedo-lobby-card-bg'));
   const open=make('button','wedo-lobby-project-open');open.type='button';open.setAttribute('aria-label',p.name||labels.LobbyDefaultProjectName);open.onclick=()=>run(()=>onOpen(id),true);
   const preview=make('div','wedo-lobby-preview');if(p.previewUrl||p.thumbnail){const img=make('img');img.src=p.previewUrl||p.thumbnail;img.alt='';preview.append(img);}open.append(preview);card.append(open);
   const title=make('div','wedo-lobby-project-title',p.name||labels.LobbyDefaultProjectName),age=make('div','wedo-lobby-project-age');
   const timestamp=new Date(p.lastOpenDate||p.updatedAt||NaN).getTime();if(Number.isFinite(timestamp)){const hours=Math.max(0,Math.floor((Date.now()-timestamp)/3600000));age.textContent=(labels[hours>=24?'LobbyProjectAgeDays':'LobbyProjectAgeHours']||'').replace('_LOBBY_PROJECT_AGE_',String(hours>=24?Math.floor(hours/24):hours));}card.append(title,age);
   if(onRename||onDelete||onDuplicate||onExport){
    const edit=button('rename','Editar proyecto',()=>{
     if(card.querySelector('.wedo-lobby-edit'))return;
     const pane=make('div','wedo-lobby-edit'),actions=make('div','wedo-lobby-edit-actions');pane.append(actions);age.hidden=true;edit.hidden=true;
     for(const [cb,key,label]of [[onDuplicate,'duplicate','Duplicar proyecto'],[nativeImportExport&&onExport,'export','Exportar proyecto'],[onDelete,'delete','Eliminar proyecto']])if(cb)actions.append(button(key,label,()=>key==='delete'?confirmDelete(p,id,card):run(()=>cb(id))));
     const field=make('input','wedo-lobby-name');field.value=p.name||'';field.maxLength=43;field.setAttribute('aria-label','Nombre del proyecto');if(onRename){pane.append(image('renameBackground','wedo-lobby-name-bg'),field);field.focus();}
     const done=button('accept','Aceptar',async()=>{if(onRename&&!(await run(()=>onRename(id,field.value))))return;if(onRename){p.name=field.value;title.textContent=p.name;open.setAttribute('aria-label',p.name);}pane.remove();age.hidden=false;edit.hidden=false;edit.focus();},'wedo-lobby-accept');pane.append(done);field.onkeydown=e=>{if(e.key==='Enter')done.click();};card.append(pane);if(onRename)field.focus();
    },'wedo-lobby-edit-button');edit.style.setProperty('--rename-mask',`url("${catalog.sprites[assets.rename].url}")`);card.append(edit);
   }grid.append(card);
  }resize();
 }
 function resize(){const scale=Math.min(innerHeight/768,innerWidth/800),width=innerWidth/scale;overlay.style.setProperty('--lobby-scale',scale);board.style.width=width+'px';top.style.width=width+'px';const first=hero.querySelector('.wedo-lobby-first');if(first){const measure=document.createElement('canvas').getContext('2d');measure.font='700 36px WeDoLobby';const buttonWidth=Math.max(385,measure.measureText(first.textContent).width+100);first.style.width=buttonWidth+'px';first.style.left=`calc(50% + 25px - ${buttonWidth}px)`;const s=catalog.sprites[assets.quickstart];let frame=first.querySelector('.wedo-lobby-first-sliced');if(!frame){frame=make('i','wedo-lobby-first-sliced');first.prepend(frame);}frame.style.borderImageSource=`url("${s.url}")`;}const available=width-83;let columns=Math.max(1,Math.floor(available/221));let gap=(available-columns*221)/Math.max(1,columns-1);if(gap>0&&gap<18&&columns>1){columns--;gap=(available-columns*221)/Math.max(1,columns-1);}grid.style.gridTemplateColumns=`repeat(${columns},221px)`;grid.style.columnGap=gap+'px';}
 overlay.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'&&onImport){e.preventDefault();e.stopPropagation();chooseFile.click();return;}
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='s'&&onExport){e.preventDefault();e.stopPropagation();const id=document.activeElement?.closest('[data-project-id]')?.dataset.projectId||options.currentId;if(id)run(()=>onExport(id));return;}
  if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button,input')].filter(e=>!e.hidden&&e.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 window.addEventListener('resize',resize);render();document.fonts.ready.then(()=>{if(!closed)resize();});overlay.focus();return {close,refresh(projects){source=projects;render();}};
}

// Capture actual rendered block images at their current viewport positions. Native
// LobbyProject.CanvasPreview likewise contains a screenshot of the programming canvas.
export async function captureOriginalProgramPreview(element,{width,height,preserveViewport=false}={}){
 const bounds=element.getBoundingClientRect();if(!bounds.width||!bounds.height)return null;
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width??(preserveViewport?bounds.width:430)));canvas.height=Math.max(1,Math.round(height??(preserveViewport?bounds.height:234)));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 const nodes=[...element.querySelectorAll('.original-strip img,.original-parameter img')].filter(img=>img.getBoundingClientRect().width&&getComputedStyle(img).visibility!=='hidden');
 await Promise.all(nodes.map(img=>img.decode().catch(()=>{})));
 const shells=await Promise.all([...element.querySelectorAll('.original-comment-shell,.original-loop-shell')].map(async shell=>{const style=getComputedStyle(shell),src=style.borderImageSource.match(/^url\(["']?(.*?)["']?\)$/)?.[1];if(!src)return null;const img=new Image();img.src=src;await img.decode().catch(()=>{});return {shell,style,img};}));
 const boxes=nodes.map(img=>img.getBoundingClientRect());const allBoxes=[...boxes,...shells.filter(Boolean).map(s=>s.shell.getBoundingClientRect())];if(!allBoxes.length)return canvas.toDataURL('image/png');
 const left=preserveViewport?bounds.left:Math.min(...allBoxes.map(b=>b.left)),top=preserveViewport?bounds.top:Math.min(...allBoxes.map(b=>b.top)),right=preserveViewport?bounds.right:Math.max(...allBoxes.map(b=>b.right)),bottom=preserveViewport?bounds.bottom:Math.max(...allBoxes.map(b=>b.bottom));
 const margin=preserveViewport?0:20,scale=Math.min((canvas.width-margin)/Math.max(1,right-left),(canvas.height-margin)/Math.max(1,bottom-top),preserveViewport?Infinity:1),ox=(canvas.width-(right-left)*scale)/2,oy=(canvas.height-(bottom-top)*scale)/2;
 for(const item of shells.filter(Boolean)){const {img,shell,style}=item,b=shell.getBoundingClientRect();if(!img.naturalWidth)continue;const cuts=style.borderImageSlice.split(' ').map(parseFloat),sx=[0,cuts[3],img.naturalWidth-cuts[1],img.naturalWidth],sy=[0,cuts[0],img.naturalHeight-cuts[2],img.naturalHeight],factor=b.width/shell.offsetWidth,dx=[0,parseFloat(style.borderLeftWidth)*factor,b.width-parseFloat(style.borderRightWidth)*factor,b.width],dy=[0,parseFloat(style.borderTopWidth)*factor,b.height-parseFloat(style.borderBottomWidth)*factor,b.height];for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(sx[x+1]>sx[x]&&sy[y+1]>sy[y])ctx.drawImage(img,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],ox+(b.left-left+dx[x])*scale,oy+(b.top-top+dy[y])*scale,(dx[x+1]-dx[x])*scale,(dy[y+1]-dy[y])*scale);}
 nodes.forEach((img,i)=>{const b=boxes[i];if(!img.naturalWidth)return;let w=b.width,h=b.height,x=b.left,y=b.top;if(getComputedStyle(img).objectFit==='contain'){const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight);w=img.naturalWidth*fit;h=img.naturalHeight*fit;x+=(b.width-w)/2;y+=(b.height-h)/2;}ctx.drawImage(img,ox+(x-left)*scale,oy+(y-top)*scale,w*scale,h*scale);});
 for(const input of element.querySelectorAll('.original-strip input,.original-parameter input,.original-comment textarea')){const b=input.getBoundingClientRect(),style=getComputedStyle(input);if(!b.width)continue;ctx.save();ctx.beginPath();ctx.rect(ox+(b.left-left)*scale,oy+(b.top-top)*scale,b.width*scale,b.height*scale);ctx.clip();ctx.fillStyle=style.color;const fontSize=parseFloat(style.fontSize)*b.width/input.offsetWidth*scale;ctx.font=`${style.fontWeight} ${fontSize}px ${style.fontFamily}`;ctx.textAlign=input.tagName==='TEXTAREA'?'left':'center';ctx.textBaseline=input.tagName==='TEXTAREA'?'top':'middle';if(input.tagName==='TEXTAREA'){let y=oy+(b.top-top)*scale;for(const paragraph of input.value.split('\n')){let line='';for(const word of paragraph.split(' ')){if(line&&ctx.measureText(line+' '+word).width>b.width*scale){ctx.fillText(line,ox+(b.left-left)*scale,y);y+=fontSize*1.2;line=word;}else line+=(line?' ':'')+word;}ctx.fillText(line,ox+(b.left-left)*scale,y);y+=fontSize*1.2;}}else ctx.fillText(input.value,ox+(b.left+b.width/2-left)*scale,oy+(b.top+b.height/2-top)*scale);ctx.restore();}
 return canvas.toDataURL('image/png');
}
