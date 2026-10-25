// The supplied win10desktop config enables useWebViewFormatAdorner. Its original
// wysiwyg directive already renders these twelve controls with original CSS/icons.
// UI.FormatAdorner (Unity fallback) emits the same UnityAppBroadcast event names.
export const ORIGINAL_TEXT_FORMAT_COMMANDS=Object.freeze([
 'undo','redo','textsizesmall','textsizemedium','textsizelarge',
 'textcolorblack','textcolorgreen','textcolorblue','textcolorred',
 'textalignleft','textalignmiddle','textalignright'
]);
export const ORIGINAL_DOCUMENTATION_BUTTONS=Object.freeze(['addPage','deletePage','templateselector']);
export function handleFormatMessage(message,w=globalThis){
 const [command,query='']=message.split('?');if(command!=='FormatAdorner')return false;
 const state=new URLSearchParams(query).get('State');if(state!=='Show'&&state!=='Hide')return false;
 const panes=w.document.querySelectorAll('.wysiwyg-format-pane');
 if(state==='Hide'){panes.forEach(pane=>pane.classList.remove('active'));return true;}
 // Let the original directive own selection, focus, formatting and persistence.
 const editor=w.document.activeElement?.closest?.('.lego-wysiwyg-editor');
 const pane=editor?.querySelector('.wysiwyg-format-pane')||(panes.length===1?panes[0]:null);
 if(pane){pane.classList.add('active');return true;}
 return false;
}
