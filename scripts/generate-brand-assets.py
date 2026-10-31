"""Generate faithful crops/icons from the owner's supplied artwork; requires Pillow.
Usage: python scripts/generate-brand-assets.py /path/to/approved-logo.png
No AI redrawing, font substitution, remote upload or background removal.
"""
from pathlib import Path
from PIL import Image, ImageOps
import sys
root = Path(__file__).resolve().parents[1]
source = Image.open(sys.argv[1]).convert('RGB')
# Coordinates refer to the approved 1254x1254 composition, scaled for equivalent exports.
def crop(box):
    return source.crop(tuple(round(v * source.width / 1254) for v in box))
brand = root / 'public/brand'
icons = root / 'public/icons'
brand.mkdir(parents=True, exist_ok=True)
icons.mkdir(parents=True, exist_ok=True)
source.save(brand / 'danqel-logo.webp', quality=95, method=6)
mark = crop((350, 220, 890, 690))
wordmark = crop((160, 710, 1090, 955))
wordmark.resize((744,196), Image.Resampling.LANCZOS).save(brand / 'danqel-wordmark.webp', quality=95, method=6)
canvas = Image.new('RGB', (512,512), '#02020b')
fitted = ImageOps.contain(mark, (440,440), Image.Resampling.LANCZOS)
canvas.paste(fitted, ((512-fitted.width)//2,(512-fitted.height)//2))
canvas.save(brand / 'danqel-mark.webp', quality=95, method=6)
for size in (32,192,512):
    canvas.resize((size,size), Image.Resampling.LANCZOS).save(icons / f'icon-{size}.png', optimize=True)
canvas.resize((180,180), Image.Resampling.LANCZOS).save(icons / 'apple-touch-icon.png', optimize=True)
mask = Image.new('RGB',(512,512),'#02020b')
fitted = ImageOps.contain(mark,(286,286),Image.Resampling.LANCZOS)
mask.paste(fitted,((512-fitted.width)//2,(512-fitted.height)//2))
mask.save(icons / 'icon-maskable-512.png',optimize=True)
print('Generated approved logo, faithful mark/wordmark crops, favicon, touch and PWA PNG icons.')
