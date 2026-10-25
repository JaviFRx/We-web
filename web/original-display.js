import {sprite,spriteImage} from './original-art.js';
export const ORIGINAL_DISPLAY={small:{width:440.8,height:275.5},large:{width:881.6,height:551},top:65,palette:120,margin:10,center:{x:0,y:30}};
export function displaySnapPoints(width,height,size=ORIGINAL_DISPLAY.small){
 const left=-width/2+size.width/2+10,right=width/2-size.width/2-10,top=height/2-65-size.height/2-10,bottom=-height/2+120+size.height/2+10;
 return [{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:0,y:30},{x:right,y:bottom},{x:0,y:top},{x:0,y:bottom},{x:right,y:30},{x:left,y:30}];
}
export function snapOriginalDisplay(position,width,height){return displaySnapPoints(width,height).map((point,index)=>({point,index,distance:Math.hypot(position.x-point.x,position.y-point.y)})).sort((a,b)=>a.distance-b.distance||a.index-b.index)[0].point;}
export function clampOriginalDisplay(position,width,height){const points=displaySnapPoints(width,height);return{x:Math.max(points[0].x,Math.min(points[1].x,position.x)),y:Math.max(points[2].y,Math.min(points[0].y,position.y))};}
export function createOriginalDisplay({catalog,onModeChange=()=>{}}){
 const fontSource=catalog.fonts?.['Roboto-Regular-With-Fallback']?.url;
 if(fontSource&&!document.getElementById('wedo-display-font')){const style=document.createElement('style');style.id='wedo-display-font';style.textContent=`@font-face{font-family:WeDoDisplay;src:url("${fontSource}")}`;document.head.append(style);}
 const element=document.createElement('section');element.className='original-display';element.hidden=true;element.setAttribute('aria-label','Pantalla del programa');
 Object.assign(element.style,{position:'absolute',right:'auto',bottom:'auto',border:'0',borderRadius:'0',background:'#b8b8b8',padding:'0',boxSizing:'border-box',touchAction:'none',overflow:'hidden',zIndex:'4',transition:'width .2s linear,height .2s linear,left .2s linear,top .2s linear'});
 const background=document.createElement('img');background.alt='';background.draggable=false;Object.assign(background.style,{position:'absolute',left:'2px',top:'2px',width:'calc(100% - 4px)',height:'calc(100% - 4px)',pointerEvents:'none'});
 const output=document.createElement('output'),text=document.createElement('span');output.append(text);
 // Unity uses the font hhea line metrics (1900 - -500) / 2048.
 Object.assign(output.style,{position:'absolute',left:'10px',right:'15px',top:'20px',bottom:'10px',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',color:'#000',fontFamily:'WeDoDisplay,Arial,sans-serif',textAlign:'center',lineHeight:String(2400/2048),pointerEvents:'none',maxWidth:'none'});
 // Unity Text baseline differs from the browser line box; the 5 logical-pixel
 // correction matches both native small/large captures (reference15/reference16).
 Object.assign(text.style,{display:'block',maxWidth:'100%',overflowWrap:'break-word',whiteSpace:'pre-wrap',transform:'translateY(-5px)'});
 element.append(background,output);
 let value={shown:false,fullscreen:false,label:'',background:'0'},position={x:0,y:30},size=ORIGINAL_DISPLAY.small,drag;
 const canvasSize=()=>({width:element.parentElement?.clientWidth||innerWidth/(innerHeight/768),height:element.parentElement?.clientHeight||768});
 function fit(){let low=16,high=250,best=16;while(low<=high){const candidate=Math.floor((low+high)/2);output.style.fontSize=candidate+'px';if(text.scrollHeight<=output.clientHeight&&text.scrollWidth<=output.clientWidth){best=candidate;low=candidate+1;}else high=candidate-1;}output.style.fontSize=best+'px';}
 function place(){const canvas=canvasSize();element.style.width=size.width+'px';element.style.height=size.height+'px';element.style.left=canvas.width/2+position.x-size.width/2+'px';element.style.top=canvas.height/2-position.y-size.height/2+'px';element.style.setProperty('--display-top',element.style.top);}
 const button=(label,name,left,action)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);Object.assign(b.style,{position:'absolute',left:left+'px',right:'auto',top:'18px',width:'50px',height:'50px',padding:'0',border:'0',background:'transparent',cursor:'pointer'});const image=spriteImage(catalog,name);Object.assign(image.style,{width:'100%',height:'100%'});b.append(image);b.onclick=event=>{event.stopPropagation();action();};b.onpointerdown=event=>event.stopPropagation();element.append(b);return b;};
 const close=()=>{update({...value,shown:false,mode:'DisplayHide'});onModeChange('DisplayHide');};
 button('Cerrar pantalla','DisplayCloseNormal',18,close);
 const resize=button('Ampliar pantalla','DisplayLargerNormal',76,()=>{const mode=value.fullscreen?'DisplaySmaller':'DisplayLarger';update({...value,mode,shown:true,fullscreen:!value.fullscreen});onModeChange(mode);});
 resize.dataset.displayResize='';
 const syncWebView=()=>{resize.hidden=document.body.classList.contains('wedo-content-open');};
 const observer=new MutationObserver(syncWebView);observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 if(fontSource)document.fonts.load('18px WeDoDisplay').then(()=>{if(!element.hidden)fit();});
 function update(next){
  const wasShown=value.shown;value={...value,...next};element.hidden=!value.shown;
  const label=String(value.label??'');text.textContent=label.length>50?label.slice(0,50)+'..':label;
  const image=catalog.displayBackgrounds?.[String(value.background)];if(image)background.src=image.url;
  size=value.fullscreen?ORIGINAL_DISPLAY.large:ORIGINAL_DISPLAY.small;
  const canvas=canvasSize();position=value.fullscreen?{x:0,y:30}:snapOriginalDisplay(wasShown?position:{x:0,y:0},canvas.width,canvas.height);
  const name=value.fullscreen?'DisplaySmallerNormal':'DisplayLargerNormal';resize.firstChild.src=sprite(catalog,name).url;resize.setAttribute('aria-label',value.fullscreen?'Reducir pantalla':'Ampliar pantalla');
  resize.hidden=document.body.classList.contains('wedo-content-open');place();requestAnimationFrame(fit);
 }
 element.addEventListener('pointerdown',event=>{if(value.fullscreen||!value.shown||event.button!==0)return;const parent=element.parentElement,rect=parent.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,position:{...position},scale:rect.width/parent.clientWidth};element.setPointerCapture(event.pointerId);element.style.transition='none';event.preventDefault();});
 element.addEventListener('pointermove',event=>{if(!drag)return;const canvas=canvasSize();position=clampOriginalDisplay({x:drag.position.x+(event.clientX-drag.x)/drag.scale,y:drag.position.y-(event.clientY-drag.y)/drag.scale},canvas.width,canvas.height);place();});
 const finish=()=>{if(!drag)return;drag=null;element.style.transition='width .2s linear,height .2s linear,left .2s linear,top .2s linear';const canvas=canvasSize();position=snapOriginalDisplay(position,canvas.width,canvas.height);place();};
 element.addEventListener('pointerup',finish);element.addEventListener('pointercancel',finish);element.addEventListener('transitionend',fit);
 return {element,update,close,destroy(){observer.disconnect();element.remove();}};
}
