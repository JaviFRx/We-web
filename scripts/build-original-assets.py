"""Losslessly export the shipped Unity UI assets used by the web reconstruction.

Run with analysis/unity-assets/venv/Scripts/python.exe. Requires UnityPy 1.25.4.
Reads the original installation and the auxiliary prefab inventory; never writes
to the installation. PNGs preserve the full Sprite rect, including whitespace.
"""
import argparse
import hashlib
import json
import re
import io
import wave
from collections import Counter
import xml.etree.ElementTree as ET
from pathlib import Path
import UnityPy
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path(r'C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data'))
args=parser.parse_args()
source=args.source
output=ROOT/'web/original-assets'
output.mkdir(parents=True,exist_ok=True)
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[source/n for n in ['resources.assets','resources.assets.resS','resources.resource','sharedassets1.assets','sharedassets1.assets.resS','globalgamemanagers','globalgamemanagers.assets','level1']]
sources={p.name:{'file':p.name,'sha256':digest(p),'bytes':p.stat().st_size} for p in files}
env=UnityPy.load(str(source/'resources.assets'),str(source/'sharedassets1.assets'),str(source/'level1'))
objects={}
for o in env.objects:
 if o.type.name=='Sprite':
  d=o.read()
  key=d.m_Name if not d.m_Name.isdigit() else f'{d.m_Name}__{o.assets_file.name}__{o.path_id}'
  if key in objects:raise RuntimeError('Duplicate sprite '+key)
  objects[key]=(o,d)

# These are closed UI resource families used by the decompiled factories,
# toolbar/connection prefabs, parameter modes and onboarding animations.
family=re.compile(r'^(?:genericDialog|TeacherGuide|Introduction|Toolbox|CheckmarkBackground|privacy|cookie|HighlightCenter|icon_normal|teacherOnboardingToggleActive|onboardingpassive|onboardingCloseButton|EnlargeNormal|SmallerNormal|Record|WaveformBackground|Rectangle|confirm|cancel|SoundLevel|microphone|Oval|Flip_icon|capture_preview_background|Mirror@Universal|SelectedPics|UnselectedPics|Playback|Stop|CornerTriangle|toolbar-background|icn_remove|capture_toggle_|Lock|Unlock|AddDefault|AddSelect|TabsDefault|TabsSelect|Remove|Export|DividerIndent|HardwareAddressing|hw_adr_|Block|Start|Play(?:Palette)?(?:@2x)?$|Motor|RGB|Node|Display|Hourglass|Mailbox|KeyboardKey|Envelope|Loop|Parameter|TiltSensor|DistanceSensor|SoundSensor|Dice|BubbleComment|TopBar|topBar|Connect|connect|detectedDevice|hub_|hubPlus|smarthub|OpenConnection|GhostHand|stopbutton|Trash|icon_zoom|Keyboard|SliderHandle|drag_it_|build_|[0-9]+(?:@2x)?$)')
names={n for n,(o,d) in objects.items() if family.search(d.m_Name) or d.m_Name.startswith(('btn_reload','iconLightbulb','lobby','Lobby','import','export'))}
prefabs=json.loads((ROOT/'analysis/unity-assets/layout-index.json').read_text())
sprite_ids={(o.assets_file.name,o.path_id):name for name,(o,d) in objects.items()}
referenced_names=set()
def collect_prefab_sprites(value,source_file):
 if isinstance(value,dict):
  if 'm_FileID' in value and 'm_PathID' in value:
   target_file=source_file if value['m_FileID']==0 else prefabs['file_ids'][source_file].get(str(value['m_FileID']))
   name=sprite_ids.get((target_file,value['m_PathID']))
   if name:referenced_names.add(name)
  for child in value.values():collect_prefab_sprites(child,source_file)
 elif isinstance(value,list):
  for child in value:collect_prefab_sprites(child,source_file)
for prefab in prefabs['roots']:
 if prefab['name'] in ['TeacherResources','TeacherResourcesSlides','GenericDialog','AudioDialogPanel','PictureAdornerElement','AudioPreviewAdornerPanel','Lobby','LanguageButton','LanguageManager','Onboarding','HubDialogContainer','TipHubImage']:
  collect_prefab_sprites(prefab,prefab['source'])
names.update(n for n,(o,d) in objects.items() if re.match(r'^(?:ar|da-DK|de-DE|en-US|en-AU|en-GB|es-ES|fr-FR|ja-JP|ko-KR|nb-NO|pt-BR|ru-RU|sv-SE|zh-CN|nl-NL)(?:Sm)?(?:@2x)?$',d.m_Name,re.I))
names.update(referenced_names)
# Keep the 2x variant selected by ApplicationSpriteManager.Use2X. Global sprites
# without @2x remain at their native resolution. Unsuffixed aliases resolve to 2x.
names={n for n in names if n.endswith('@2x') or n+'@2x' not in names}
names.update(referenced_names)
catalog={'schemaVersion':1,'sprites':{},'palette':[],'sounds':{},'fonts':{},'translations':{},'geometry':{},'provenance':{'tools':{'UnityPy':UnityPy.__version__},'sourceFiles':sources,'spriteSelection':'ApplicationSpriteManager.Use2X => true; names without @2x alias the selected 2x resource','limitations':[]}}
basenames={name:re.sub(r'[^a-zA-Z0-9_.@-]','_',name) for name in names}
folded_counts=Counter(value.casefold() for value in basenames.values())
catalog['provenance']['caseInsensitiveFilenameCollisions']=[]
catalog['provenance']['supersededSpriteAliases']=[]
for name in sorted(names):
 o,d=objects[name]
 rect=d.m_Rect
 texture=d.m_RD.texture.deref().read()
 tex=texture.image
 packed=bool(d.m_RD.settingsRaw&1)
 if not packed:
  left,top=round(rect.x),round(tex.height-rect.y-rect.height)
  img=tex.crop((left,top,left+round(rect.width),top+round(rect.height)))
  method='unpacked-texture-rect'
 else:
  cropped=d.image
  img=Image.new('RGBA',(round(rect.width),round(rect.height)))
  off=d.m_RD.textureRectOffset
  img.paste(cropped,(round(off.x),round(rect.height-off.y-cropped.height)))
  method='packed-sprite-restored-to-rect'
 filename=basenames[name]+'.png'
 if folded_counts[basenames[name].casefold()]>1:
  filename=f'{basenames[name]}--{o.assets_file.name}-{o.path_id}.png'
  catalog['provenance']['caseInsensitiveFilenameCollisions'].append({'name':name,'filename':filename,'reason':'Distinct Unity names collide on case-insensitive Windows filesystem.'})
 img.save(output/filename)
 border=d.m_Border
 record={'originalName':d.m_Name,'url':'/original-assets/'+filename,'width':img.width,'height':img.height,'pixelsPerUnit':d.m_PixelsToUnits,'border':{'left':border.x,'bottom':border.y,'right':border.z,'top':border.w},'pivot':{'x':d.m_Pivot.x,'y':d.m_Pivot.y},'sha256':digest(output/filename),'source':{'file':o.assets_file.name,'pathId':o.path_id,'fileSha256':sources[o.assets_file.name]['sha256'],'texturePathId':d.m_RD.texture.m_PathID,'textureRect':{'x':rect.x,'y':rect.y,'width':rect.width,'height':rect.height},'extraction':method}}
 catalog['sprites'][name]=record
 if name.endswith('@2x'):
  previous=catalog['sprites'].get(name[:-3])
  if previous:catalog['provenance']['supersededSpriteAliases'].append(previous)
  catalog['sprites'][name[:-3]]=record

# Exact order and resource composition from Views.PaletteViewFactory.CreateViews.
definitions=[
 ('MotorPower','MotorSpeed','BlockGreen','8'),('MotorOnFor','MotorTime','BlockGreen','1'),('MotorOff','MotorStop','BlockGreen',None),
 ('MotorThisWay','MotorCounterClockwise','BlockGreen',None),('MotorThatWay','MotorClockwise','BlockGreen',None),('Light','RGBLight','BlockGreen','1'),
 ('PlaySound','Node','BlockRed','1'),('DisplayBackground','DisplayBackground','BlockRed','1'),('Display','Display','BlockRed','123'),('DisplayAdd','DisplayAdd','BlockRed','1'),('DisplayResize','DisplaySmaller','BlockRed',None),
 ('Start','Play','Start',None),('StartOnKeyPress','KeyboardKey','Start',None),('StartOnMessage','Mailbox','Start','abc'),('SendMessage','Envelope','BlockYellow','abc'),('WaitFor','Hourglass','BlockYellow','1')]
for type_name,icon,prefix,value in definitions:
 suffix='WithPar' if value is not None else 'WithoutPar'
 catalog['palette'].append({'type':type_name,'kind':'instruction','icon':icon+'Palette','background':prefix+suffix+'Palette','editorIcon':icon,'editorBackground':prefix+suffix,'defaultValue':value,'defaultParameterType':('TextInput' if type_name in ['Display','StartOnMessage','SendMessage'] else 'NumberInput') if value is not None else None})
catalog['palette'].append({'type':'Repeat','kind':'instruction','icon':'LoopWithoutParameterPalette','background':'LoopPalette','editorIcon':'LoopWithoutParameter','editorBackground':'LoopWithoutPar','defaultValue':None,'optionalParameterDefault':'10'})
for type_name,icon,background,text in [('TiltSensorNeutral','TiltSensorChange','ParameterOrange',None),('MotionSensor','DistanceSensorChange','ParameterOrange',None),('SoundSensorInput','SoundSensor','ParameterBlue',None),('NumberInput',None,'ParameterBlueWhite','123'),('TextInput',None,'ParameterBlueWhite','abc'),('DisplayInput','DisplayInput','ParameterBlue',None),('RandomInput','Dice','ParameterBlue',None)]:
 catalog['palette'].append({'type':type_name,'kind':'parameter','icon':icon+'Palette' if icon else None,'background':background+'Palette','editorIcon':icon,'editorBackground':background,'text':text})
catalog['palette'].append({'type':'CommentBlock','kind':'comment','icon':None,'background':'BubbleCommentPalette','editorBackground':'BubbleComment','text':None})
assert len(catalog['palette'])==25
for entry in catalog['palette']:
 for field in ['icon','background']:
  if entry.get(field) not in catalog['sprites'] and entry.get(field) is not None:raise RuntimeError(f'Missing {entry[field]}')

# Decode audio from its own environment: auxiliary resource readers opened while
# traversing multiple serialized files can otherwise select a different stream.
audio_env=UnityPy.load(str(source/'resources.assets'))
for o in audio_env.objects:
 if o.type.name=='AudioClip':
  clip=o.read()
  try:
   samples=clip.samples
   if len(samples)!=1:raise RuntimeError('Expected one audio sample')
   _,data=next(iter(samples.items()))
   filename='sound-'+clip.m_Name+'.wav'
   (output/filename).write_bytes(data)
   with wave.open(io.BytesIO(data)) as sound:
    audio_info={'channels':sound.getnchannels(),'sampleRate':sound.getframerate(),'duration':sound.getnframes()/sound.getframerate()}
   catalog['sounds'][clip.m_Name]={'url':'/original-assets/'+filename,**audio_info,'sha256':digest(output/filename),'source':{'file':o.assets_file.name,'pathId':o.path_id,'fileSha256':sources[o.assets_file.name]['sha256']}}
  except Exception as error:catalog['provenance']['limitations'].append({'audio':clip.m_Name,'error':str(error)})
 if o.type.name=='Font':
  font=o.read()
  if not font.m_FontData:continue
  filename='font-'+re.sub(r'[^a-zA-Z0-9_.-]','_',font.m_Name)+'.ttf'
  (output/filename).write_bytes(bytes(font.m_FontData))
  catalog['fonts'][font.m_Name]={'url':'/original-assets/'+filename,'sha256':digest(output/filename),'source':{'file':o.assets_file.name,'pathId':o.path_id,'fileSha256':sources[o.assets_file.name]['sha256']}}

catalog['provenance']['translationSources']={}
for translation in sorted((source/'StreamingAssets/Localization/app').glob('*.xml')):
 code=translation.stem
 catalog['translations'][code]={el.tag:(el.text or '').replace('REPLACEWITHTRADEMARK','\u00ae').replace('REPLACEWITHHTTPS','https://').replace('REPLACEWITHHTTP','http://') for el in ET.parse(translation).getroot()}
 catalog['provenance']['translationSources'][code]={'path':'StreamingAssets/Localization/app/'+translation.name,'sha256':digest(translation)}
catalog['provenance']['translationNormalization']='LanguageManager.CompensateLeftToRight placeholders: REPLACEWITHTRADEMARK -> registered mark; REPLACEWITHHTTPS -> https://; REPLACEWITHHTTP -> http://. Browser handles text shaping separately.'
catalog['provenance']['translationSource']=catalog['provenance']['translationSources']['ES']
manager_env=UnityPy.load(str(source/'globalgamemanagers'))
catalog['displayBackgrounds']={}
catalog['audioPreviews']={}
for manager in manager_env.objects:
 if manager.type.name!='ResourceManager':continue
 container=manager.read_typetree()['m_Container']
 for resource_path,ptr in container:
  if not resource_path.startswith(('displaypaneimages/','audiopaneimages/')):continue
  file=Path(manager.assets_file.externals[ptr['m_FileID']-1].path).name
  matches=[(key,value) for key,value in catalog['sprites'].items() if value['source']['file']==file and value['source']['pathId']==ptr['m_PathID']]
  if not matches:continue # the container also has the Texture2D of each Sprite
  number=resource_path.split('/')[-1]
  key,record=matches[0]
  catalog['displayBackgrounds' if resource_path.startswith('displaypaneimages/') else 'audioPreviews'][number]={'sprite':key,'url':record['url'],'width':record['width'],'height':record['height'],'resourcePath':resource_path,'source':{'managerFile':manager.assets_file.name,'managerPathId':manager.path_id,'managerFileSha256':sources[manager.assets_file.name]['sha256'],'targetFile':file,'targetPathId':ptr['m_PathID']}}
assert len(catalog['displayBackgrounds'])==29
audio_manager=json.loads((ROOT/'analysis/unity-assets/trees/sharedassets1.assets_1259.json').read_text())
for pointer in audio_manager['sprites']:
 record_key,record=next((k,v) for k,v in catalog['sprites'].items() if v['source']['file']=='sharedassets1.assets' and v['source']['pathId']==pointer['m_PathID'])
 number=record['originalName']
 catalog['audioPreviews'][number]={'sprite':record_key,'url':record['url'],'width':record['width'],'height':record['height'],'source':{'managerFile':'sharedassets1.assets','managerPathId':1259,'managerFileSha256':sources['sharedassets1.assets']['sha256'],'targetPathId':pointer['m_PathID']}}
assert len(catalog['audioPreviews'])==28
catalog['ui']={
 'toolbar':{'home':'TopBarHome','book':'TopBarBooks','lightbulb':'iconLightbulb','camera':'TopBarCamera','note':'TopBarNote','help':'TopBarHelp','background':'TopBarBG_PointFilteringNoSubMenu','rounding':'topBarBackgroundEndRounding','divider':'TopBarButtonDivider_PointFiltering'},
 'hub':{'disconnected':'connectionCenterbuttonNotConnectedIcon','connected':'connectionCenterbuttonConnectedIcon','open':'OpenConnectionCenterButton'},
 'connection':{'close':'ConnectHubDialogCloseButtonNormal','refresh':'btn_reload_normal','refreshDisabled':'btn_reload_inactive','hubIcon':'connectionHubDialogFrameHubIcon','tipHub':'connectionCenterTipHub','tipHand':'connectionCenterTipHand','broadcastHand':'ConnectDialogBroadcastHand','thumbsUp':'connectionCenterTipThumbsUpHand','frame':'connectionHubDialogFeatherFrame','connectedFrame':'connectionHubDialogConnectedFrame','selectedFrame':'connectionHubDialogHighligthedFrame','shadow':'ConnectionPanelspaceAndShadow'},
 'editor':{'stop':'stopbutton_normal','stopHighlight':'stopbutton_highlight','trash':'Trash','zoomIn':'icon_zoomin_blue','zoomOut':'icon_zoomout_blue'}
}
catalog['ui']['lobby']={'logo':'lobbylogo','close':'lobby_btn_exit','snail':'lobbySnailIcon','quickstart':'lobbyYourFirstProjectButton','classroom':'lobbyClassroomProjectsButton','teacher':'lobbyTeacherResourcesButton','circlesWhite':'lobbyGreyOnWhiteCirclesSolid','circlesGreen':'lobbyWhiteOnGreenCircles','projectBackground':'lobby_project_background','create':'lobby_project_new_icon','import':'import','export':'export','duplicate':'lobby_btn_duplicate','delete':'lobby_btn_close','rename':'connectionHubDialogRenameHubButton','accept':'connectDialogRenameAccept','renameBackground':'lobbyProjectRenameInputField'}
for section in catalog['ui'].values():
 for key in section.values():
  if key not in catalog['sprites']:raise RuntimeError('Missing UI sprite '+key)
layout=json.loads((ROOT/'analysis/unity-assets/layout-index.json').read_text())
for item in layout['roots']:
 catalog['geometry'][item['name']]=item
catalog['provenance']['layoutIndexSha256']=digest(ROOT/'analysis/unity-assets/layout-index.json')
catalog['layout']={
 'loop':{
  'backgroundWithoutParameter':'LoopWithoutPar','backgroundWithParameter':'LoopWithPar','icon':'LoopWithoutParameter',
  'imageType':'sliced','pixelsPerUnitScale':2,'baseWidth':226.25,'baseHeight':138,
  'leftSidebar':30,'rightSidebar':91,'rightWhitespace':15,'bottomWhitespace':18.5,
  'bottomAnchorFromRightVisualEdge':45.5,
  'iconRect':{'right':25,'top':28,'width':72,'height':72},
  'spriteBorderPixels':{'left':98,'bottom':6,'right':227,'top':0},
  'widthWithChildrenFormula':'baseWidth - firstChild.ownVisualWidth + firstChild.totalVisualWidth + optionalGhost.totalVisualWidth - firstRightAdjacentLoop.totalVisualWidth',
  'innerAttachFromBlockOrigin':{'x':30,'y':0},
  'prefabPivot':{'x':0,'y':0.783},
  'source':{'file':'sharedassets1.assets','gameObjectPathId':357,'decompiledClass':'Views.LoopBlockView','decompiledSha256':digest(ROOT/'analysis/unity-assets/Views.LoopBlockView.decompiled.cs')}
 }
}
catalog['layout']['teacherResources']=catalog['geometry']['TeacherResources']
catalog['layout']['teacherSlides']=catalog['geometry']['TeacherResourcesSlides']
catalog['provenance']['limitations'].append('Serialized prefab geometry is authored state; runtime layout and scripts must be applied separately.')
(ROOT/'web/original-assets.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Exported {len(names)} original sprites, {len(catalog["sounds"])} sounds, {len(catalog["fonts"])} fonts, {len(catalog["translations"]["ES"])} translations; {len(catalog["palette"])} palette entries.')


