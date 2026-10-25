"""Decode all recovered raster images without modifying them (requires Pillow)."""
import json
from pathlib import Path
from PIL import Image

roots = ['content/wedo', 'web/original-assets']
report = {'checked': 0, 'frames': 0, 'failures': [], 'roots': roots,
          'method': 'Pillow full image load, including every animated frame; no image modifications'}
for root in roots:
    for file in Path(root).rglob('*'):
        if file.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.gif'}:
            continue
        report['checked'] += 1
        try:
            with Image.open(file) as image:
                for index in range(getattr(image, 'n_frames', 1)):
                    image.seek(index)
                    image.load()
                    report['frames'] += 1
        except Exception as error:
            report['failures'].append({'file': str(file), 'error': str(error)})
destination = Path('analysis/verification/media/image-integrity.json')
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'checked': report['checked'], 'frames': report['frames'], 'failures': len(report['failures'])}))
raise SystemExit(bool(report['failures']))
