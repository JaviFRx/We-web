from PIL import Image, ImageChops
from pathlib import Path
import json
base=Path('analysis/verification/runtime/display-comparison');result={}
count=lambda im:sum(bool(pixel) for pixel in im.get_flattened_data())
for mode,reference,web,region in [('small','15-display-visible.png','web-display-123.png',(650,304,1270,692)),('large','16-display-large.png','web-display-large-123.png',(340,110,1580,886))]:
 masks={};entry={};left,top,_,_=region
 for key,path in {'native':Path('analysis/verification/native')/reference,'web':base/web}.items():
  im=Image.open(path).convert('RGB').crop(region)
  mask=Image.new('1',im.size);mask.putdata([r<40 and g<40 and b<40 for r,g,b in im.get_flattened_data()]);masks[key]=mask
  box=mask.getbbox();entry[key]={'black_bbox':[box[0]+left,box[1]+top,box[2]+left,box[3]+top],'black_pixels':count(mask)}
  im.save(base/(key+'-'+mode+'-display-crop.png'))
 diff=ImageChops.logical_xor(masks['native'],masks['web']);entry['glyph_mask_xor_pixels']=count(diff);entry['glyph_mask_iou']=count(ImageChops.logical_and(masks['native'],masks['web']))/count(ImageChops.logical_or(masks['native'],masks['web']))
 entry['bbox_max_delta_px']=max(abs(a-b) for a,b in zip(entry['native']['black_bbox'],entry['web']['black_bbox']))
 diff.convert('RGB').save(base/(mode+'-glyph-diff.png'));result[mode]=entry
(base/'pixel-comparison.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
