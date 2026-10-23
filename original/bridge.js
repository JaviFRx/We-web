angular.module('lego.content.common').factory('CommunicationHandler.wsa',['$q','$timeout','$window',function($q,$timeout,w){
 let next=()=>{};
 return {attach:fn=>{next=fn;},processQueue:message=>{
  $timeout(()=>{
   if(message.startsWith('ProjectDataPath?'))w.setProjectPath('/original/');
   if(message.startsWith('Language?'))w.unityEmitMessage('LanguageChange','ES');
   if(message.startsWith('PlayVideo?')){const path=new URLSearchParams(message.split('?')[1]).get('Path');if(path){const url=new URL(path,location.href);if(url.origin===location.origin)window.open(url.href,'_blank','noopener');}}
   if(/^(ShowConnectionCenter|StartProject|OpenProject|LoadProgram|Drag)/.test(message))window.alert('Esta acción requiere el editor Unity. Su adaptación web exacta todavía está pendiente.');
   next();
  },0);
  return $q.resolve();
 }};
}]);
