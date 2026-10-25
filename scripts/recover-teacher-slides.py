"""Decode serialized OnboardingManager, correcting three separately aligned bools.
Schema: recovered OnboardingManager C#; Unity object resources.assets:2253.
The generated parser consumed 1620/1772 bytes; this parser asserts exact EOF.
"""
import json, struct, hashlib, sys
from pathlib import Path
import UnityPy
dest=Path('analysis/managed-reconstruction')
source=Path(r'C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data\resources.assets')
env=UnityPy.load(str(source))
object_id=int(sys.argv[1]) if len(sys.argv)>1 else 2253
prefix=sys.argv[2] if len(sys.argv)>2 else 'teacher-slides'
obj=next(item for item in env.objects if item.path_id==object_id)
data=obj.get_raw_data()
(dest/(prefix+'-manager.bin')).write_bytes(data)
offset=32
def take(fmt):
 global offset
 result=struct.unpack_from('<'+fmt,data,offset)
 offset+=struct.calcsize('<'+fmt)
 return result[0] if len(result)==1 else result
def string():
 global offset
 length=take('i');value=data[offset:offset+length].decode('utf8');offset+=length;offset=(offset+3)//4*4;return value
def vector(keys):return dict(zip(keys,take('f'*len(keys))))
def pointer():return dict(zip(['m_FileID','m_PathID'],take('iq')))
result={'States':[]}
for _ in range(take('i')):
 state={'Name':string(),'Color':vector('rgba'),'Objects':[]}
 for _ in range(take('i')):
  item={key:pointer() for key in ['Transform','Button','GifAnimator']}
  item.update({key:bool(take('i')) for key in ['ButtonInteractable','StartGif','AutoControlFullsize']})
  item['Image']=pointer();item['Position']=vector('xy');item['Size']=vector('xy');item['Rotation']=vector('xyz');item['Color']=vector('rgba');item['AnimiationSpeedBoost']=take('f');state['Objects'].append(item)
 result['States'].append(state)
result['Destroying']=bool(take('i'));result['pageTitleTranslationKeys']=[string() for _ in range(take('i'))];result['ScrollSnapTimeInSeconds']=take('f')
for key in ['ArrowLeftButton','ArrowRightButton','GetStartedButton','GetStartedButtonImage','GetStartedButtonText','CloseButton','CloseButtonTransform','CloseButtonImage','PageTitleText']:result[key]=pointer()
assert offset==len(data),(offset,len(data))
(dest/(prefix+'-state.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
(dest/(prefix+'-source.json')).write_text(json.dumps({'asset':str(source),'path_id':object_id,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'schema':'OnboardingManager.decompiled.cs','bool_alignment':4,'consumed_bytes':offset},indent=2),encoding='utf8')
print(prefix,':',len(result['States']),'states decoded; consumed',offset,'bytes.')
