// Unity Lobby/InfoPanel, SelectedInfoManager, SettingsScrollLayoutManager and
// LobbyLanguageButtonManager. Geometry and text come from the recovered prefab.
const flatten=n=>[n,...n.children.flatMap(flatten)];
const component=(n,name)=>n.components.find(c=>c.script?.m_ClassName===name);
const color=c=>`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a})`;
export function showOriginalConfirmation({catalog,message,labels=catalog.activeTranslations||catalog.translations.ES}={}){
 return new Promise(resolve=>{
  const shade=document.createElement('div');shade.className='wedo-original-confirmation';shade.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:12000;display:grid;place-items:center';
  const panel=document.createElement('div');panel.role='alertdialog';panel.setAttribute('aria-label',message);const scale=Math.min(innerHeight/768,innerWidth/1024);panel.style.cssText=`position:relative;width:400px;height:221px;transform:scale(${scale});font-family:WeDoSettings,WeDoRoboto,Arial,sans-serif`;shade.append(panel);
  const img=(parent,name)=>{const image=document.createElement('img');image.src=catalog.sprites[name].url;image.alt='';image.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';parent.append(image);};img(panel,'genericDialogBackground');
  const text=document.createElement('div');text.textContent=message;text.style.cssText='position:absolute;left:54px;top:41px;width:292px;height:60px;font-size:20px;font-weight:bold;line-height:1.2;text-align:center;color:#323232';panel.append(text);
  for(const yes of [true,false]){const button=document.createElement('button');button.type='button';button.style.cssText=`position:absolute;left:${yes?40:210}px;top:141px;width:150px;height:40px;border:0;background:none;padding:0;font:20px inherit;color:${yes?'#2cafe5':'white'};cursor:pointer`;img(button,yes?'genericDialogAcceptButton':'genericDialogCancelButton');const span=document.createElement('span');span.textContent=labels[yes?'ButtonYes':'ButtonNo'];span.style.cssText='position:relative;font-size:20px';button.append(span);button.onclick=()=>{shade.remove();resolve(yes);};panel.append(button);if(!yes)queueMicrotask(()=>button.focus());}
  document.body.append(shade);
 });
}
export function showOriginalSettings({catalog,onLanguage,onIntroduction,onDeleteAll,onClose}={}){
 if(!document.querySelector('style[data-original-settings-font]')){const style=document.createElement('style');style.dataset.originalSettingsFont='';style.textContent="@font-face{font-family:WeDoSettings;src:url('/original-assets/font-Roboto-Regular-With-Fallback.ttf')} .wedo-settings,.wedo-settings button{font-family:WeDoSettings,Arial,sans-serif!important}";document.head.append(style);}
 const nodes=flatten(catalog.geometry.Lobby),byId=new Map(nodes.map(n=>[n.path_id,n]));
 const tabs=nodes.filter(n=>component(n,'SettingsButtonViewEventHandler'));
 const languages=catalog.languages||component(catalog.geometry.LanguageManager,'LanguageManager')?.fields.Languages||[];
 languages.sort((a,b)=>a.UIDiplayPriority-b.UIDiplayPriority);
 let selected=162,closed=false,showTip=true,opened=false,language=localStorage.getItem('wedo-language')||'ES';
 const prior=document.activeElement,overlay=document.createElement('section');overlay.className='wedo-settings';overlay.role='dialog';overlay.setAttribute('aria-label','Ajustes');overlay.setAttribute('aria-modal','true');
 overlay.style.cssText='position:fixed;inset:0;background:white;z-index:11000;overflow:hidden;font-family:WeDoRoboto,Arial,sans-serif';
 const stage=document.createElement('div');stage.style.cssText='position:absolute;left:50%;top:50%;transform-origin:0 0';overlay.append(stage);
 const labels=()=>catalog.translations[language]||catalog.activeTranslations||catalog.translations.ES;
 const text=key=>labels()[key]??catalog.translations.ES[key]??key;
 const close=()=>{if(closed)return;closed=true;overlay.remove();window.removeEventListener('resize',render);prior?.focus?.();onClose?.();};
 function make(tag,parent,css){const e=document.createElement(tag);e.style.cssText=css||'';parent.append(e);return e;}
 function image(parent,name,css='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none') {const a=catalog.sprites[name];if(a){const img=make('img',parent,css);img.src=a.url;img.alt='';img.draggable=false;} }
 async function run(fn){try{await fn();}catch(e){let status=overlay.querySelector('[role=status]');if(!status){status=make('div',overlay,'position:absolute;bottom:0;left:0;right:0;background:white;color:#a11;padding:12px');status.role='status';}status.textContent=e.message||String(e);}}
 function confirmDelete(){run(async()=>{if(await showOriginalConfirmation({catalog,message:text('LobbyDeleteAllProjectsDialogLocal'),labels:labels()})){if(!onDeleteAll)throw Error('No se ha conectado el borrado de proyectos.');await onDeleteAll();}});}
 function action(node){if(node.name==='DeleteAllProjects')return confirmDelete;if(node.name==='RestartIntroduction')return ()=>run(async()=>{if(!onIntroduction)throw Error('La introducción original todavía no está disponible.');await onIntroduction();});}
 function url(node){if(node.name==='Privacy')return 'https://www.lego.com/en-us/legal/notices-and-policies/privacy-policy';if(node.name==='Cookie')return 'https://www.lego.com/en-us/legal/cookies/cookie-policy';if(!component(node,'TeacherGuideButton'))return undefined;const lang=languages.find(l=>l.LanguageCode===language);return lang?.[({TeacherGuide:'DefaultTeacherGuideURL',Introduction:'DefaultTeacherGuideIntroductionURL',TeacherGuideScience:'DefaultTeacherGuideScienceURL',TeacherGuideComputing:'DefaultTeacherGuideComputationalURL',Toolbox:'DefaultTeacherGuideToolboxURL'})[node.name]];}
 function build(node,parent,pw,ph,override){
  const r=node.components.find(c=>c.type==='RectTransform')?.fields;if(!r)return;
  const a=r.m_AnchorMin,b=r.m_AnchorMax,p=r.m_Pivot,s=r.m_SizeDelta,pos=r.m_AnchoredPosition;
  const w=override?.w??pw*(b.x-a.x)+s.x,h=override?.h??ph*(b.y-a.y)+s.y,x=override?.x??pw*(a.x+(b.x-a.x)*p.x)+pos.x-p.x*w,y=override?.y??ph-(ph*(a.y+(b.y-a.y)*p.y)+pos.y)-(1-p.y)*h;
  const handler=action(node),link=url(node),isToggle=node.name==='Toggle';
  const e=make(link?'a':handler?'button':isToggle?'label':'div',parent,`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;padding:0;margin:0;border:0;background:none;box-sizing:border-box;text-decoration:none;color:inherit;`);e.dataset.originalName=node.name;
  if(handler){e.type='button';e.onclick=handler;e.style.cursor='pointer';}
  if(link){e.href=link;e.target='_blank';e.rel='noopener noreferrer';e.style.cursor='pointer';}
  if(isToggle){const input=make('input',e,'position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:1');input.type='checkbox';input.setAttribute('aria-label',text('SettingsOnboardingOption'));input.checked=localStorage.getItem('wedo-show-introduction')!=='false';const paint=()=>{e.querySelectorAll('img').forEach(i=>i.remove());image(e,input.checked?'CheckmarkBackgroundEnabled':'CheckmarkBackgroundDisabled','position:absolute;left:10px;top:10px;width:40px;height:40px;pointer-events:none');if(input.checked)image(e,component(byId.get(228),'Image')?.sprite?.name,'position:absolute;left:18px;top:20px;width:24px;height:20px;pointer-events:none');};input.onchange=()=>{localStorage.setItem('wedo-show-introduction',String(input.checked));paint();};paint();return;}
  const im=component(node,'Image');if(im){if(im.sprite?.name)image(e,im.sprite.name);else e.style.background=color(im.fields.m_Color);}
  const t=component(node,'Text');if(t){const f=t.fields,fd=f.m_FontData,key=component(node,'TextLocalizer')?.fields.LocalizerKey; e.textContent=key?text(key):f.m_Text;e.style.fontSize=fd.m_FontSize+'px';e.style.fontWeight=fd.m_FontStyle===1?'bold':'normal';e.style.color=color(f.m_Color);e.style.whiteSpace='pre-wrap';e.style.lineHeight='1.2';e.style.textAlign=['left','center','right'][fd.m_Alignment%3];if(Math.floor(fd.m_Alignment/3)>0){e.style.display='flex';e.style.alignItems=Math.floor(fd.m_Alignment/3)===1?'center':'flex-end';}if(node.name==='TOU Text'){e.style.height='auto';e.style.position='relative';e.style.top=y+'px';}}
  if(node.name==='Selection Buttons'){renderLanguages(e);return;}
  let childNodes=node.children;
  if(node.name==='TeacherGuides'){
   const lang=languages.find(l=>l.LanguageCode===language);childNodes=childNodes.filter(n=>!component(n,'TeacherGuideButton')||Boolean(component(n,'TeacherGuideButton').fields.IsComputationalThinking)===Boolean(lang?.SupportsComputationalThinking));
   childNodes.forEach((n,i)=>build(n,e,w,h,{x:1,y:5+i*124,w:560,h:100}));return;
  }
  for(const child of childNodes)build(child,e,w,h);
  const guide=component(node,'TeacherGuideButton');if(guide){const target=e.querySelector('[data-original-name="Image"]');if(target)image(target,node.name);if(!link){e.tabIndex=0;e.role='button';e.onclick=()=>run(()=>{throw Error('Falta la dirección original de esta guía.');});}}
  if(['Privacy','Cookie'].includes(node.name)){const target=e.querySelector('[data-original-name="Image"]');if(target)image(target,node.name==='Privacy'?'lobbyprivacypolicy':'lobbycookiepolicy');}
 }
 function renderLanguages(parent){
  if(!languages.length){parent.textContent='No se ha recuperado la lista original de idiomas.';return;}
  const rows=Math.ceil(languages.length/2);languages.forEach((l,i)=>{const active=l.LanguageCode===language;const button=make('button',parent,`position:absolute;left:${Math.floor(i/rows)*326}px;top:${i%rows*52}px;width:300px;height:52px;background:white;border:${active?'2px solid #29abe2':'0'};border-radius:3px;text-align:left;padding:0 12px 0 75px;font:15px WeDoRoboto,Arial;color:${active?'#29abe2':'#333'};cursor:pointer`);button.textContent=l.LanguageName;image(button,l.ISOLanguageCode,'position:absolute;left:15px;top:0;width:42px;height:52px;object-fit:contain;pointer-events:none');button.setAttribute('aria-pressed',String(active));button.onclick=()=>run(async()=>{if(!onLanguage)throw Error('El cambio de idioma no está conectado.');await onLanguage(l.LanguageCode,l);language=l.LanguageCode;localStorage.setItem('wedo-language',language);render();});});
 }
 function render(){
  if(closed)return;stage.replaceChildren();const scale=Math.min(innerHeight/768,innerWidth/1024),width=innerWidth/scale;stage.style.width=width+'px';stage.style.height='768px';stage.style.transform=`scale(${scale}) translate(-50%,-50%)`;
  const logo=make('div',stage,'position:absolute;left:39px;top:21px;width:104px;height:38px');image(logo,'lobbylogo');
  const exit=make('button',stage,'position:absolute;right:110px;top:20px;width:40px;height:40px;background:none;border:0;cursor:pointer');exit.setAttribute('aria-label','Cerrar ajustes');exit.onclick=close;image(exit,'LobbyInfoButtonSelected');
  const infoBody=make('div',stage,'position:absolute;inset:0;pointer-events:none');
  const nav=make('nav',infoBody,'position:absolute;left:38px;top:160px;width:255px');let y=0;
  tabs.forEach(tab=>{const id=component(tab,'SettingsButtonViewEventHandler').fields.SettingsContentToShow.m_PathID,key=component(tab,'TextLocalizer').fields.LocalizerKey,b=make('button',nav,`display:block;width:255px;min-height:36.5px;padding:0;border:0;border-top:2px solid #999;background:white;text-align:left;font:bold 16px WeDoRoboto,Arial;color:${id===selected?'#29abe2':'#444'};cursor:pointer`);b.textContent=text(key);if(id===162){b.style.position='relative';const current=languages.find(l=>l.LanguageCode===language);if(current)image(b,current.ISOLanguageCode+'Sm','position:absolute;right:22px;top:10px;width:20px;height:16px;object-fit:contain;pointer-events:none');}b.onclick=()=>{selected=id;render();};y+=36.5;});
  const scroll=make('div',infoBody,`position:absolute;left:335px;top:90px;width:${width-350}px;height:676px;overflow:auto`);const panel=byId.get(selected),holder=make('div',scroll,'position:relative;min-height:670px');build(panel,holder,675,606,{x:0,y:70,w:625,h:521});
  const nativeExit=make('button',stage,'position:absolute;right:39px;top:20px;width:40px;height:40px;border:0;background:none;cursor:pointer');nativeExit.setAttribute('aria-label','Volver al inicio');nativeExit.onclick=close;image(nativeExit,catalog.ui.lobby.close);
  const version=make('div',infoBody,'position:absolute;left:38px;bottom:105px;color:#808080;font-size:17px');version.textContent='Adaptación web';const legal=make('div',infoBody,'position:absolute;left:38px;bottom:43px;width:255px;height:40px;font-size:13px;line-height:1.2;color:#777;overflow:hidden');legal.textContent=component(byId.get(98),'Text').fields.m_Text;
  if(showTip){const tip=make('div',infoBody,`position:absolute;left:0;bottom:0;width:${width}px;min-height:61px;background:#31afe5;color:white;display:flex;align-items:center;padding:12px 65px 12px 55px;box-sizing:border-box;font-size:18px;font-weight:bold`);tip.textContent=text('SettingsOnboardingLink');image(tip,'LobbySettingsTooltipIcon','position:absolute;left:15px;top:15px;width:30px;height:30px;object-fit:contain');const closeTip=make('button',tip,'position:absolute;right:23px;top:15px;border:0;background:white;border-radius:50%;font-size:23px;width:30px;height:30px;color:#31afe5;cursor:pointer');closeTip.textContent='×';closeTip.setAttribute('aria-label','Cerrar sugerencia');closeTip.onclick=()=>{showTip=false;render();};}
  for(const child of infoBody.children)child.style.pointerEvents='auto';
  if(!opened){opened=true;infoBody.animate([{transform:`translateX(${width}px)`},{transform:'translateX(0)'}],{duration:200,easing:'linear'});}
 }
 document.body.append(overlay);window.addEventListener('resize',render);render();return {close,element:overlay};
}
