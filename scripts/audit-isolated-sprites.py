"""Compare exported images with identical crop logic in per-file UnityPy environments."""
import json,hashlib
from pathlib import Path
import UnityPy
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data')
OUT=ROOT/'analysis/verification/runtime/sprite-source-audit'
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'web/original-assets.json').read_text(encoding='utf8'))
records={(r['source']['file'],r['source']['pathId']):r for r in [*catalog['sprites'].values(),*catalog['provenance'].get('supersededSpriteAliases',[])]}
environments={}
results=[]
for _,record in records.items():
 name=record['originalName']
 src=record['source'];file=src['file']
 if file not in environments:
  env=UnityPy.load(str(SOURCE/file));environments[file]={o.path_id:o for o in env.objects if o.assets_file.name==file}
 obj=environments[file][src['pathId']];d=obj.read();tex=d.m_RD.texture.deref().read().image;rect=d.m_Rect
 left,top=round(rect.x),round(tex.height-rect.y-rect.height)
 if src['extraction']=='unpacked-texture-rect':isolated=tex.crop((left,top,left+round(rect.width),top+round(rect.height))).convert('RGBA')
 else:
  crop=d.image;isolated=Image.new('RGBA',(round(rect.width),round(rect.height)));off=d.m_RD.textureRectOffset;isolated.paste(crop,(round(off.x),round(rect.height-off.y-crop.height)))
 old_path=ROOT/'web'/record['url'].lstrip('/');old=Image.open(old_path).convert('RGBA')
 diff=ImageChops.difference(old,isolated)
 visible=ImageChops.lighter(old.getchannel('A'),isolated.getchannel('A')).point(lambda x:255 if x else 0)
 rgb=ImageChops.lighter(ImageChops.lighter(diff.getchannel('R'),diff.getchannel('G')),diff.getchannel('B'))
 mask=ImageChops.lighter(ImageChops.multiply(rgb,visible),diff.getchannel('A')).point(lambda x:255 if x else 0)
 changed=sum(mask.histogram()[1:])
 if changed or old.size!=isolated.size:
  target=OUT/(Path(record['url']).name);isolated.save(target)
  results.append({'name':name,'source':src,'visibleChangedPixels':changed,'oldDimensions':old.size,'isolatedDimensions':isolated.size,'totalPixels':old.width*old.height,'bounds':mask.getbbox(),'catalogSha256':record['sha256'],'oldFileSha256':hashlib.sha256(old_path.read_bytes()).hexdigest(),'isolatedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'isolatedImage':str(target.relative_to(ROOT))})
report={'compared':len(records),'different':len(results),'differences':results,'method':'Same full rect crop or packed sprite restoration; only UnityPy environment changes to one serialized asset file. Pixel comparison ignores RGB when both images alpha0; alpha and dimension differences always counted.'}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'compared':report['compared'],'different':len(results),'names':[r['name'] for r in results]}))
