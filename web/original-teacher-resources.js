// TeacherResourcesManager / OnboardingManager + recovered Unity prefab state geometry.
const script=(node,name)=>node.components.find(c=>c.script?.m_ClassName===name);
const flatten=node=>[node,...node.children.flatMap(flatten)];
const rgba=c=>`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a})`;
export function originalLocalizedText(value){return /[\u0600-\u06ff]/.test(value)?value.replaceAll('REPLACEWITHTRADEMARK','®').replaceAll('REPLACEWITHHTTPS','https://').replaceAll('REPLACEWITHHTTP','http://').replace(/[\u064b-\u0652]/g,''):value;}
// Unity lerps from the CURRENT pose on every frame, not from a fixed start pose.
export function stepOriginalOnboardingPose(current,target,progress){
 const factor=Math.max(0,Math.min(1,progress*target.AnimiationSpeedBoost)),next={};
 for(const key of ['Position','Size','Rotation','Color'])next[key]=Object.fromEntries(Object.keys(current[key]).map(axis=>[axis,current[key][axis]+(target[key][axis]-current[key][axis])*factor]));
 return next;
}
export function prepareOriginalOnboardingTree(source,rtl=false){
 const tree=structuredClone(source);if(!rtl)return tree;const nodes=flatten(tree),owner=nodes.find(n=>script(n,'OnboardingManager')||script(n,'TeacherResourcesManager'));
 const manager=(script(owner,'OnboardingManager')||script(owner,'TeacherResourcesManager')).fields;
 for(const child of owner.children){const r=child.components.find(c=>c.type==='RectTransform')?.fields;if(r)r.m_AnchoredPosition.x=-r.m_AnchoredPosition.x;}
 for(const state of manager.States||[manager.State])for(const target of state.Objects)target.Position.x=-target.Position.x;
 const close=nodes.flatMap(n=>n.components).find(c=>c.path_id===manager.CloseButtonTransform.m_PathID)?.fields;
 if(close){close.m_AnchorMin={x:0,y:1};close.m_AnchorMax={x:0,y:1};close.m_AnchoredPosition.x=-close.m_AnchoredPosition.x+close.m_SizeDelta.x;}
 return tree;
}
export const ORIGINAL_TEACHER_LINKS=Object.freeze({GuidesButton:'https://education.lego.com/en-us/support/wedo-2/teacher-guides',PlansButton:'https://education.lego.com/lessons',SupportButton:'https://education.lego.com/support'});
export function showOriginalIntroduction(options){return showOriginalTeacherResources({...options,introduction:true});}
export function showOriginalTeacherResources({catalog,introduction=false}={}){
 if(!catalog?.layout?.teacherResources||!catalog?.layout?.teacherSlides)throw Error('Faltan los paneles originales de recursos para profesores.');
 const labels=Object.fromEntries(Object.entries(catalog.activeTranslations||catalog.translations.ES).map(([key,value])=>[key,originalLocalizedText(value)])),previous=document.activeElement;
 const language=localStorage.getItem('wedo-language')||'ES',rtl=language==='arabic',trees=new Map(),poses=new Map();
 const overlay=document.createElement('section');overlay.className=introduction?'wedo-original-introduction':'wedo-teacher-resources';overlay.role='dialog';overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',introduction?labels.SettingsOnboardingTitle:labels.LobbyTeacherResourcesButtonTitle);
 overlay.style.cssText='position:fixed;inset:0;z-index:11000;overflow:hidden;background:white;font-family:WeDoRoboto,Arial,sans-serif';
 const stage=document.createElement('div');stage.style.cssText='position:absolute;left:50%;top:50%;transform-origin:0 0';overlay.append(stage);
 let mode=introduction?'slides':'menu',page=0,closed=false,animationFrame=0,motionFrame=0,dismissing=false,activeManagerNode;
 const close=()=>{if(closed)return;closed=true;cancelAnimationFrame(animationFrame);cancelAnimationFrame(motionFrame);overlay.remove();window.removeEventListener('resize',render);previous?.focus?.();};
 function dismiss(){
  if(dismissing||closed)return;dismissing=true;stage.style.pointerEvents='none';cancelAnimationFrame(animationFrame);cancelAnimationFrame(motionFrame);
  for(const name of ['LeftArrow','RightArrow','GetStarted','Close','PageTitleText','PageHint'])stage.querySelector(`[data-original-name="${name}"]`)?.style.setProperty('visibility','hidden');
  const children=[...stage.querySelector(`[data-node="${activeManagerNode.path_id}"]`).children],images=[...stage.querySelectorAll('img')],begun=performance.now();
  function fade(now){if(closed)return;const progress=Math.min(1,(now-begun)/250);for(const element of children){const node=activeManagerNode.children.find(n=>String(n.path_id)===element.dataset.node);if(!node)continue;const rect=node.components.find(c=>c.type==='RectTransform'),pose=poses.get(node.source+':'+rect.path_id);element.style.transform=`rotate(${-pose.Rotation.z}deg) scale(${1-progress})`;}for(const image of images)image.style.opacity=Math.floor((1-progress)*255)/255;if(progress<1)motionFrame=requestAnimationFrame(fade);else if(mode==='slides'&&!introduction){dismissing=false;mode='menu';render();}else close();}
  motionFrame=requestAnimationFrame(fade);
 }
 function spriteElement(name,fields){
  const asset=catalog.sprites[name];if(!asset)throw Error('Falta imagen original: '+name);
  const img=document.createElement('img');img.src=asset.url;img.alt='';img.draggable=false;img.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';img.style.objectFit=fields?.m_PreserveAspect?'contain':'fill';return img;
 }
 function render(){
  if(closed)return;stage.style.pointerEvents='auto';cancelAnimationFrame(animationFrame);cancelAnimationFrame(motionFrame);stage.replaceChildren();
  const scale=Math.min(innerHeight/768,innerWidth/1024),width=innerWidth/scale,height=innerHeight/scale;
  stage.style.width=width+'px';stage.style.height=height+'px';stage.style.transform=`scale(${scale}) translate(-50%,-50%)`;
  const source=introduction?catalog.geometry.Onboarding:mode==='menu'?catalog.layout.teacherResources:catalog.layout.teacherSlides;
  if(!trees.has(source))trees.set(source,prepareOriginalOnboardingTree(source,rtl));
  const tree=trees.get(source),nodes=flatten(tree),records=[];
  const managerNode=nodes.find(n=>script(n,mode==='menu'?'TeacherResourcesManager':'OnboardingManager'));
  if(!managerNode)throw Error('Falta el estado original de las diapositivas.');
  activeManagerNode=managerNode;
  const manager=script(managerNode,mode==='menu'?'TeacherResourcesManager':'OnboardingManager').fields;
  const state=mode==='menu'?manager.State:manager.States[page],targets=new Map(state.Objects.map(x=>[x.Transform.m_PathID,x]));
  const componentNames=new Map([[manager.GetStartedButtonImage?.m_PathID,'onboardingGetStartedButton'],[manager.CloseButtonImage?.m_PathID,'onboardingCloseButton']]);
  const title=mode==='menu'?labels.LobbyTeacherResourcesButtonTitle:labels[manager.pageTitleTranslationKeys[page]];
  const actionFor=node=>{
   if(node.name==='Close'||node.name==='GetStarted')return dismiss;
   if(node.name==='TipsButton')return ()=>{mode='slides';page=0;render();};
   if(node.name==='LeftArrow')return ()=>{page=Math.max(0,Math.min(manager.States.length-1,page+(rtl?1:-1)));render();};
   if(node.name==='RightArrow')return ()=>{page=Math.max(0,Math.min(manager.States.length-1,page+(rtl?-1:1)));render();};
  };
  function build(node,parent,pw,ph,isRoot=false){
   const rectComponent=node.components.find(c=>c.type==='RectTransform'),r=rectComponent?.fields;
   if(!r)return;
   const target=targets.get(rectComponent.path_id);
   if(parent.dataset.node===String(managerNode.path_id)&&!target)return;
   if(mode==='slides'&&((node.name===(rtl?'RightArrow':'LeftArrow')&&page===0)||(node.name===(rtl?'LeftArrow':'RightArrow')&&page===manager.States.length-1)))return;
   const poseKey=node.source+':'+rectComponent.path_id;
   if(!poses.has(poseKey))poses.set(poseKey,{Position:{...r.m_AnchoredPosition},Size:{...r.m_SizeDelta},Rotation:{x:0,y:0,z:2*Math.atan2(r.m_LocalRotation?.z||0,r.m_LocalRotation?.w??1)*180/Math.PI},Color:{...(script(node,'Image')?.fields.m_Color||{r:1,g:1,b:1,a:1})}});
   const pose=poses.get(poseKey);
   if(target?.AutoControlFullsize){target.Size={x:1024*Math.max(1,innerWidth/innerHeight),y:768*Math.max(1,innerWidth/innerHeight)};pose.Size={...target.Size};}
   const size=target?pose.Size:r.m_SizeDelta,pos=target?pose.Position:r.m_AnchoredPosition,min=r.m_AnchorMin,max=r.m_AnchorMax,pivot=r.m_Pivot;
   const w=isRoot?pw:pw*(max.x-min.x)+size.x,h=isRoot?ph:ph*(max.y-min.y)+size.y;
   const x=isRoot?0:pw*(min.x+(max.x-min.x)*pivot.x)+pos.x-pivot.x*w;
   const y=isRoot?0:ph-(ph*(min.y+(max.y-min.y)*pivot.y)+pos.y)-(1-pivot.y)*h;
   const action=actionFor(node),url=mode==='menu'?ORIGINAL_TEACHER_LINKS[node.name]:null;
   const element=document.createElement(url?'a':action?'button':'div');element.dataset.node=node.path_id;element.dataset.originalName=node.name;
   element.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;margin:0;padding:0;border:0;background:none;overflow:visible;color:inherit;text-decoration:none;`;
   const localScale=r.m_LocalScale||{x:1,y:1},rotation=target?pose.Rotation.z:(2*Math.atan2(r.m_LocalRotation?.z||0,r.m_LocalRotation?.w??1)*180/Math.PI);
   element.style.transformOrigin=`${pivot.x*100}% ${(1-pivot.y)*100}%`;element.style.transform=`rotate(${-rotation}deg) scale(${localScale.x},${localScale.y})`;
   if(action){element.type='button';element.onclick=action;}
   if(url){element.href=url;element.target='_blank';element.rel='noopener noreferrer';}
   if(action||url){element.style.cursor='pointer';const local=flatten(node).map(n=>script(n,'TextLocalizer')?.fields.LocalizerKey).find(Boolean);element.setAttribute('aria-label',labels[local]||({Close:'Cerrar recursos',GetStarted:labels.OnboardingGetStarted,LeftArrow:'Página anterior',RightArrow:'Página siguiente'}[node.name])||node.name);}
   const image=script(node,'Image');
   if(image){const name=componentNames.get(image.path_id)||image.sprite?.name,color=target?pose.Color:image.fields.m_Color;
    if(name){const img=spriteElement(name,image.fields);img.style.opacity=color?.a??1;element.append(img);}
    else if(color?.a)element.style.background=rgba(color);
   }
   const text=script(node,'Text');if(text){const f=text.fields,local=script(node,'TextLocalizer')?.fields.LocalizerKey;
    element.textContent=node.name==='PageTitleText'?title:node.name==='PageHint'?labels.TeacherResourcesPage6Title:text.path_id===manager.GetStartedButtonText?.m_PathID?(page===manager.States.length-1?labels.OnboardingGetStarted:''):labels[local]||f.m_Text||'';
    const font=f.m_FontData,arabic=/[\u0600-\u06ff]/.test(element.textContent),align=font.m_Alignment+(arabic&&font.m_Alignment%3===0?2:0);Object.assign(element.style,{fontSize:font.m_FontSize+'px',fontWeight:font.m_FontStyle===1?'bold':'normal',color:rgba(node.name==='PageTitleText'&&mode==='slides'?state.Color:f.m_Color),textAlign:['left','center','right'][align%3],direction:arabic?'rtl':'ltr',lineHeight:'1.15',whiteSpace:'pre-wrap',display:'flex',alignItems:['flex-start','center','flex-end'][Math.floor(align/3)],justifyContent:['flex-start','center','flex-end'][align%3]});
   }
   parent.append(element);
   if(node.name==='PageTitleText'||node.name==='PageHint')element.style.opacity='0';
   records.push({node,element,parent,pw,ph,r,target,poseKey,isRoot,localScale});
   for(const child of node.children)build(child,element,w,h);
   if(mode==='slides'&&script(node,'PagePositionIndicator')){
    element.style.display='flex';element.style.justifyContent='center';element.style.gap='8px';element.style.flexDirection=rtl?'row-reverse':'row';
    for(let i=0;i<manager.States.length;i++){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Página '+(i+1));b.setAttribute('aria-current',i===page?'page':'false');b.style.cssText='position:relative;width:12px;height:12px;flex:none;margin:0;padding:0;border:0;background:none';b.append(spriteElement(i===page?'teacherOnboardingToggleActive':'onboardingpassive'));b.onclick=()=>{page=i;render();};element.append(b);}
   }
  }
  build(tree,stage,width,height,true);
  if(introduction)startOriginalAnimations(nodes,targets);
  let progress=0,last=performance.now();overlay.dataset.transition='running';
  function animate(now){
   progress=Math.min(1,progress+(now-last)/1000/manager.ScrollSnapTimeInSeconds);last=now;
   for(const record of records){const {element,parent,r,target,poseKey,isRoot,localScale}=record;let pose=poses.get(poseKey);if(target){pose=stepOriginalOnboardingPose(pose,target,progress);poses.set(poseKey,pose);}
    const pw=parent===stage?width:parseFloat(parent.style.width),ph=parent===stage?height:parseFloat(parent.style.height),size=target?pose.Size:r.m_SizeDelta,pos=target?pose.Position:r.m_AnchoredPosition,min=r.m_AnchorMin,max=r.m_AnchorMax,pivot=r.m_Pivot;
    const w=isRoot?pw:pw*(max.x-min.x)+size.x,h=isRoot?ph:ph*(max.y-min.y)+size.y,x=isRoot?0:pw*(min.x+(max.x-min.x)*pivot.x)+pos.x-pivot.x*w,y=isRoot?0:ph-(ph*(min.y+(max.y-min.y)*pivot.y)+pos.y)-(1-pivot.y)*h;
    Object.assign(element.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    if(target){element.style.transform=`rotate(${-pose.Rotation.z}deg) scale(${localScale.x},${localScale.y})`;const img=element.querySelector(':scope>img');if(img)img.style.opacity=pose.Color.a;else if(script(record.node,'Image'))element.style.background=rgba(pose.Color);}
    if(record.node.name==='PageTitleText'||record.node.name==='PageHint')element.style.opacity=Math.min(1,progress*2);
   }
   if(progress<1)motionFrame=requestAnimationFrame(animate);else overlay.dataset.transition='complete';
  }
  motionFrame=requestAnimationFrame(animate);
 }
 function startOriginalAnimations(nodes,targets){
  const sprites=Object.entries(catalog.sprites),animations=[],signals=[];
  for(const node of nodes){const element=stage.querySelector(`[data-node="${node.path_id}"]`);if(!element)continue;const gif=script(node,'GifAnimator'),rect=node.components.find(c=>c.type==='RectTransform');if(gif){const frames=gif.fields.GifImages.map(ref=>sprites.find(([,s])=>s.source?.file===node.source&&s.source?.pathId===ref.m_PathID)).filter(Boolean).sort(([a],[b])=>a.localeCompare(b));let img=element.querySelector(':scope>img');if(!img&&frames.length){img=spriteElement(frames[0][0],{m_PreserveAspect:true});element.style.background='none';element.append(img);}if(img&&frames.length){img.src=frames[0][1].url;animations.push({id:gif.path_id,fields:gif.fields,frames,img,running:!!targets.get(rect.path_id)?.StartGif,start:performance.now()});}}
   const signal=script(node,'ConnectionSignalAnimator');if(signal)signals.push(signal.fields.bars.map(ref=>{const owner=nodes.find(n=>n.components.some(c=>c.path_id===ref.m_PathID));return owner&&stage.querySelector(`[data-node="${owner.path_id}"]>img`);}));
  }
  const begun=performance.now();function tick(now){if(closed)return;for(const a of animations){if(!a.running)continue;const elapsed=(now-a.start)/1000,interval=Math.max(.03,a.fields.AnimationIntervalInSeconds),total=a.fields.StartDelay+a.fields.ResetDelay+interval*a.frames.length,index=Math.max(0,Math.min(a.frames.length-1,Math.floor((elapsed-a.fields.StartDelay)/interval)));a.img.src=a.frames[index][1].url;if(elapsed>total){a.start=now;for(const b of animations)if(b.fields.ResetTrigger.m_PathID===a.id){b.start=now;b.running=true;}}}for(const bars of signals)bars.forEach((img,i)=>{if(img)img.style.opacity=Math.max(0,Math.sin(((now-begun)/1000-i/4.5)*2*Math.PI));});animationFrame=requestAnimationFrame(tick);}animationFrame=requestAnimationFrame(tick);
 }
 overlay.addEventListener('keydown',e=>{if(dismissing)return;if(e.key==='Escape'){e.preventDefault();dismiss();}if(mode==='slides'&&['ArrowLeft','ArrowRight'].includes(e.key)){page=Math.max(0,Math.min(4,page+(e.key===(rtl?'ArrowLeft':'ArrowRight')?1:-1)));render();}});
 document.body.append(overlay);window.addEventListener('resize',render);render();overlay.querySelector('button,a')?.focus();return {close,element:overlay};
}
