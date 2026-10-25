angular.module('lego.content.common').factory('CommunicationHandler.wsa',['$q','$timeout','$window',function($q,$timeout,w){
 let next=()=>{};
 return {attach:fn=>{next=fn;},processQueue:message=>{
  $timeout(async()=>{
   try{
    const docs=await import('/original-documentation.js');
    const editor=await import('/original-editor.js');
    if(/^(LoadProject|LockedStatus)\?/.test(message))await editor.ensureProjectReady();
    if(message.startsWith('UpdateButtonState?'))editor.updateOriginalButtonState(message.split('?')[1]);
    if(message.startsWith('FormatAdorner?')){const format=await import('/original-text-format.js');format.handleFormatMessage(message,w);}
    if(message.startsWith('UpdateWebViewSize?'))editor.setWebViewSize(new URLSearchParams(message.split('?')[1]).get('Size'));
    if(message.startsWith('NavigateToLobby?')){await editor.showProjects();next();return;}
    if(await docs.handleDocumentationMessage(message,w,{getProject:editor.getCurrentProject,onSave:editor.saveCurrentProject})){next();return;}
   }catch(error){console.error(error);w.alert(error.message);next();return;}
   if(message.startsWith('ProjectDataPath?'))w.setProjectPath('/original/');
   if(message.startsWith('Language?'))w.unityEmitMessage('LanguageChange',localStorage.getItem('wedo-language')||'ES');
   if(message.startsWith('PlayVideo?')){const path=new URLSearchParams(message.split('?')[1]).get('Path');if(path){const url=new URL(path,location.href);if(url.origin===location.origin)window.open(url.href,'_blank','noopener');}}
   if(/^ShowConnectionCenter(?:\?|$)/.test(message))import('/connection.js').then(module=>module.showConnectionCenter()).catch(error=>w.alert('No se pudo abrir Bluetooth: '+error.message));
   if(/^(StartProject|OpenProject)(?:\?|$)/.test(message))import('/programming.js').then(module=>module.openProgramming()).catch(error=>w.alert('No se pudo abrir el editor: '+error.message));
   next();
  },0);
  return $q.resolve();
 }};
}]);
import('/programming.js').then(module=>module.installProgramming()).catch(error=>console.error('No se pudo cargar programación',error));
