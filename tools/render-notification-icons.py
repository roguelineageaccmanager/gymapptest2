"""Render Android status-bar alpha glyphs from the existing repository ouroboros."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
root = Path(__file__).resolve().parent.parent
source = Image.open(root / "icon-512.png").convert("RGBA")
mask = ImageChops.multiply(ImageOps.grayscale(source), source.getchannel("A"))
mask = mask.crop(mask.point(lambda value: 255 if value > 20 else 0).getbbox())
for density, size in [("mdpi",24),("hdpi",36),("xhdpi",48),("xxhdpi",72),("xxxhdpi",96)]:
    margin = round(size * 2 / 24)
    glyph = ImageOps.contain(mask, (size-2*margin,size-2*margin), Image.Resampling.LANCZOS)
    alpha = Image.new("L", (size,size))
    alpha.paste(glyph, ((size-glyph.width)//2,(size-glyph.height)//2))
    output = Image.new("RGBA", (size,size), (255,255,255,0))
    output.putalpha(alpha)
    target = root / "tools" / "android" / "res" / ("drawable-"+density)
    target.mkdir(exist_ok=True)
    output.save(target / "ic_workout_notification.png")
