# Composes capture pieces into the docs images (phone downscale, sheets). Run by capture-docs.sh.
from PIL import Image
O = "../docs/art/lab/img"
for n in ["phone-day", "phone-night"]:
    im = Image.open(f"out/cap/{n}.png")
    # DPR 3 -> CSS px by an exact integer step (texels stay square: 6 device px -> 2 px)
    im.resize((im.width // 3, im.height // 3), Image.NEAREST).save(f"{O}/{n}.png", optimize=True)
a, b = Image.open("out/cap/hurt.png"), Image.open("out/cap/death.png")
s = Image.new("RGB", (a.width, a.height + b.height)); s.paste(a, (0, 0)); s.paste(b, (0, a.height)); s.save(f"{O}/motion-hurt-death.png", optimize=True)
# live frames: the centre of each 1280x720 frame, unscaled (3 device px per texel), 4x2
fr = [Image.open(f"out/cap/fight-{i:02d}.png").crop((340, 170, 940, 530)) for i in range(2, 10)]
W, H = fr[0].size
s = Image.new("RGB", (W * 4, H * 2))
for i, f in enumerate(fr):
    s.paste(f, ((i % 4) * W, (i // 4) * H))
s.save(f"{O}/motion-live-fight.png", optimize=True)
