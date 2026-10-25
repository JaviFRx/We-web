// Native geometry: level1 LeftContent; behavior: *TopBarGroup in Assembly-CSharp.dll.
export function createOriginalTopbar({catalog,onSelect,onAction}){
 if(!document.querySelector('style[data-original-topbar]')){const css=document.createElement('style');css.dataset.originalTopbar='';css.textContent=`
 .wedo-native-topbar{position:absolute;left:0;top:0;width:430px;height:79px;isolation:isolate;pointer-events:none;transition:width .333s linear}.wedo-native-topbar *{box-sizing:border-box}.wedo-native-topbar .topbar-shell{position:absolute;inset:0;border-style:solid;border-width:0 74px 0 4px;border-image-slice:0 148 0 8 fill;border-image-repeat:stretch;z-index:-1}.wedo-native-topbar .topbar-groups{height:60px;display:flex;align-items:center;padding-top:5px}.wedo-native-topbar .topbar-group{position:relative;width:60px;height:56px;flex:none;transition:width .333s linear;pointer-events:auto}.wedo-native-topbar button{border:0;margin:0;padding:0;background:none;cursor:pointer;position:relative}.wedo-native-topbar button:focus-visible{outline:2px solid #009ac7;outline-offset:-2px}.wedo-native-topbar img{display:block;object-fit:contain;pointer-events:none}.wedo-native-topbar .topbar-main{position:absolute;left:-3px;top:6px;width:65px;height:38px}.wedo-native-topbar [data-group=home] .topbar-main,.wedo-native-topbar [data-group=help] .topbar-main{left:0;width:60px}.wedo-native-topbar .topbar-main img{width:100%;height:100%}.wedo-native-topbar .topbar-divider{width:2px;height:40px;flex:none;object-fit:fill}.wedo-native-topbar .topbar-selected-bg{position:absolute;inset:0;border-style:solid;border-width:12.5px 8.5px 0 69px;border-image-slice:25 17 0 138 fill;border-image-repeat:stretch;pointer-events:none}.wedo-native-topbar [data-group=help] .topbar-selected-bg{border:0;background-position:center;background-size:100% 100%}.wedo-native-topbar .topbar-submenu{position:absolute;left:69px;top:15px;display:flex;align-items:center;gap:10px;height:34px}.wedo-native-topbar .topbar-submenu button{width:34px;height:34px;flex:none}.wedo-native-topbar .topbar-submenu button img{width:100%;height:100%}.wedo-native-topbar .topbar-doc-divider{height:30px;width:1px;flex:none}.wedo-native-topbar [hidden]{display:none!important}`;document.head.append(css);}
 const element=document.createElement('nav');element.className='wedo-native-topbar';element.setAttribute('aria-label','Herramientas WeDo');
 const stateStyle=document.createElement('style');stateStyle.textContent='.wedo-native-topbar [data-group=docs] .topbar-submenu{left:66px}.wedo-native-topbar button:disabled img{filter:brightness(.7843137383);opacity:.501960814}.wedo-native-topbar button:disabled{cursor:default}.wedo-native-topbar [data-group=docs] button:active:not(:disabled) img{filter:brightness(.7843137383)}';element.append(stateStyle);
 const create=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;return e;};
 const img=name=>{const e=create('img','');e.alt='';e.draggable=false;setImage(e,name);return e;};
 function setImage(e,name){const asset=catalog.sprites[name];if(!asset)throw Error(`Falta recurso original: ${name}`);e.src=asset.url;}
 const shell=create('span','topbar-shell');shell.style.borderImageSource=`url("${catalog.sprites.topBarBackgroundEndRounding.url}")`;const groups=create('div','topbar-groups');element.append(shell,groups);
 // TopBar.WebViewFrameImage is the stretched child of the WebView frame:
 // sizeDelta (4,4) expands it two logical pixels beyond the 61px top inset.
 const frame=create('span','topbar-webview-frame');frame.style.cssText=`display:none;position:absolute;left:-2px;top:59px;width:calc(100% - 66px);height:711px;border:3.5px solid transparent;border-image: url("${catalog.sprites.TopBarWebBG_PointFiltering.url}") 7 fill / 3.5px stretch;z-index:-1;pointer-events:none`;element.insertBefore(frame,groups);
 let selected=null,locked=false,modelMode='models-build',captureMode='camera-photo';
 const specs=[['home','Mis proyectos','TopBarHome'],['library','Biblioteca de proyectos','TopBarBooks'],['models','Biblioteca de modelos','TopBarSettings'],['camera','Capturar','TopBarCamera'],['docs','Documentación','TopBarNote'],['help','Ayuda','TopBarHelp']];
 const entries=new Map(),dividers=[];
 const button=(label,name,fn)=>{const b=create('button','');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.append(img(name));b.onclick=fn;return b;};
 function action(name){onAction?.(name);}
 for(const [key,label,icon] of specs){
  const group=create('div','topbar-group');group.dataset.group=key;const bg=create('span','topbar-selected-bg');bg.hidden=true;
  if(key==='help')bg.style.backgroundImage=`url("${catalog.sprites.TopBarBG_PointFilteringNoSubMenu.url}")`;else bg.style.borderImageSource=`url("${catalog.sprites.TopBarBG_PointFiltering.url}")`;
  const main=button(label,icon,()=>{const next=key==='home'?'home':selected===key?null:key;if(next!=='home')setSelected(next);onSelect?.(next);});main.className='topbar-main';main.setAttribute('aria-pressed','false');
  const submenu=create('div','topbar-submenu');submenu.hidden=true;group.append(bg,main,submenu);groups.append(group);entries.set(key,{group,bg,main,submenu,icon});
  if(key!=='help'){const divider=img('DividerIndent_PointFiltering');divider.className='topbar-divider';groups.append(divider);dividers.push(divider);}
 }
 const add=(group,label,normal,actionName,select)=>{const b=button(label,normal,()=>{select?.();action(actionName);});b.dataset.action=actionName;if(group==='docs'){const hover={AddDefault:'AddSelect',TabsDefault:'TabsSelect',Remove:'RemoveSelect',Export:'ExportSelect'}[normal];if(hover){b.addEventListener('pointerenter',()=>setImage(b.firstChild,hover));b.addEventListener('pointerleave',()=>setImage(b.firstChild,normal));}}entries.get(group).submenu.append(b);return b;};
 add('library','Todos los proyectos','TopBarBookActive','library-root');
 add('models','Modelos para construir','TopBarBlockActive','models-build',()=>{modelMode='models-build';render();});
 add('models','Ejemplos de programación','TopBarPlayNormal','models-program',()=>{modelMode='models-program';render();});
 add('camera','Fotografía','capture_toggle_icn_picture_on','camera-photo',()=>{captureMode='camera-photo';render();});
 add('camera','Vídeo','capture_toggle_icn_video','camera-video',()=>{captureMode='camera-video';render();});
 add('camera','Captura del programa','capture_toggle_icn_screenshot','camera-canvas',()=>{captureMode='camera-canvas';render();});
 const lock=button('Bloquear documentación','Unlock',()=>{locked=!locked;render();action(locked?'lock':'unlock');});lock.dataset.action='lock';entries.get('docs').submenu.append(lock);
 add('docs','Añadir página','AddDefault','addPage');add('docs','Plantilla de página','TabsDefault','templateselector');add('docs','Eliminar página','Remove','deletePage');
 const docDivider=img('TopBarButtonDivider_PointFiltering');docDivider.className='topbar-doc-divider';entries.get('docs').submenu.append(docDivider);add('docs','Exportar documentación','Export','export');
 function render(){
  const widths={library:120,models:162,camera:204,docs:locked?175:305,help:60};element.style.width=430+(selected?(widths[selected]||60)-60:0)+'px';
  for(const [key,entry]of entries){const active=selected===key;entry.group.style.width=(active?(widths[key]||60):60)+'px';entry.bg.hidden=!active;entry.submenu.hidden=!active||key==='home'||key==='help';entry.main.setAttribute('aria-pressed',String(active));setImage(entry.main.firstChild,entry.icon+(active?'Active':''));}
  specs.slice(0,-1).forEach(([key],i)=>dividers[i].style.visibility=selected===key||selected===specs[i+1][0]?'hidden':'visible');
  for(const [actionName,normal,active]of [['models-build','TopBarBlockNormal','TopBarBlockActive'],['models-program','TopBarPlayNormal','TopBarPlayActive']])setImage(element.querySelector(`[data-action="${actionName}"] img`),modelMode===actionName?active:normal);
  for(const [actionName,normal]of [['camera-photo','capture_toggle_icn_picture'],['camera-video','capture_toggle_icn_video'],['camera-canvas','capture_toggle_icn_screenshot']])setImage(element.querySelector(`[data-action="${actionName}"] img`),normal+(captureMode===actionName?'_on':''));
  setImage(lock.firstChild,locked?'Lock':'Unlock');lock.title=locked?'Desbloquear documentación':'Bloquear documentación';lock.setAttribute('aria-label',lock.title);lock.setAttribute('aria-pressed',String(locked));
  for(const name of ['addPage','templateselector','deletePage'])element.querySelector(`[data-action="${name}"]`).hidden=locked;
 }
 function setSelected(group){selected=entries.has(group)&&group!=='home'?group:null;render();}
 function setDocsLocked(value){locked=!!value;render();}
 render();return {element,setSelected,setDocsLocked,setModelMode(mode){modelMode=mode;render();},setCaptureMode(mode){captureMode=mode;render();}};
}
