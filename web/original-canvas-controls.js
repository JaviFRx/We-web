// level1:118 Zoom Pan Panel, level1:175 StopButton; logical canvas height768.
export function createOriginalCanvasControls({catalog,onZoomIn,onZoomOut,onFit,onStop}){
 const element=document.createElement('div');element.className='original-canvas-controls';element.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:5';
 const image=name=>{const img=document.createElement('img');img.alt='';img.draggable=false;img.src=catalog.sprites[name].url;img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none';return img;};
 const button=(label,icon,handler,style)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.style.cssText='position:absolute;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;'+style;b.append(image(icon));b.onclick=handler;element.append(b);return b;};
 const zoomIn=button('Acercar programa','icon_zoomin_gray',onZoomIn,'right:30px;top:223px;width:40px;height:40px');
 const zoomOut=button('Alejar programa','icon_zoomout_gray',onZoomOut,'right:30px;top:303px;width:40px;height:40px');
 const fit=button('Centrar programa','icon_normal_blue',onFit,'right:30px;top:383px;width:40px;height:40px');
 const stop=button('Detener programas','stopbutton_normal',onStop,'right:0;top:539.5px;width:132.5px;height:103.4px');const glow=image('stopbutton_highlight');glow.style.opacity='0';stop.append(glow);let animation;
 function setZoom(zoom){for(const [button,name,active] of [[zoomIn,'icon_zoomin',zoom>1],[zoomOut,'icon_zoomout',zoom<1],[fit,'icon_normal',zoom===1]])button.firstElementChild.src=catalog.sprites[name+(active?'_blue':'_gray')].url;}
 function setRunning(running){animation?.cancel();animation=null;if(running)animation=glow.animate([{opacity:0},{opacity:1},{opacity:0}],{duration:1000,iterations:Infinity});else glow.style.opacity='0';}
 return {element,zoomIn,zoomOut,fit,stop,setRunning,setZoom,setVisible(visible){element.hidden=!visible;},destroy(){animation?.cancel();element.remove();}};
}
