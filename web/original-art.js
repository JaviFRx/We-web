let promise;
export function loadOriginalArt(){
 return promise ||= fetch('/original-assets.json').then(response=>{if(!response.ok)throw Error('No se pudieron cargar los recursos originales.');return response.json();}).then(catalog=>{catalog.activeTranslations=catalog.translations[localStorage.getItem('wedo-language')||'ES']||catalog.translations.ES;return catalog;}).catch(error=>{promise=null;throw error;});
}
export function sprite(catalog,name){return catalog.sprites[name+'@2x']||catalog.sprites[name+'_2x']||catalog.sprites[name];}
export function spriteImage(catalog,name,className=''){
 const asset=sprite(catalog,name),image=document.createElement('img');
 image.className=className;image.alt='';image.draggable=false;
 if(asset){image.src=asset.url;image.dataset.sprite=name;}
 else {image.hidden=true;console.warn('Missing original sprite:',name);}
 return image;
}
export function spriteSize(catalog,name){const item=sprite(catalog,name);return item?{width:item.width*100/item.pixelsPerUnit,height:item.height*100/item.pixelsPerUnit}:{width:91,height:107.5};}
