# Generates the Plumb brand marks as SVG: the plumb bob is a plum, hanging from the plumb line.
# Usage: python3 make_logo.py <out-dir>   (needs `pip install fonttools` and mobile/node_modules for the font)
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '../mobile/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf')
PLUM1, PLUM2, PLUM_LIGHT, CORAL, AMBER, PAPER = '#2A1E45', '#4B2E73', '#6A3F9A', '#FF6B5E', '#FFA24B', '#FBF7F3'

FRUIT = 'M512 384 C562 336 752 340 752 622 C752 812 634 904 512 904 C390 904 272 812 272 622 C272 340 462 336 512 384 Z'
LEAF = 'M522 368 C546 290 640 252 726 274 C702 346 618 394 522 368 Z'
SUTURE = 'M524 402 C594 484 612 664 560 866'

def defs(u, line=PLUM1):
    return (f'<defs><linearGradient id="line{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{line}" stop-opacity="0"/>'
            f'<stop offset="0.45" stop-color="{line}"/></linearGradient>'
            f'<linearGradient id="fruit{u}" x1="0.2" y1="0.1" x2="0.8" y2="1"><stop offset="0" stop-color="{PLUM_LIGHT}"/>'
            f'<stop offset="0.55" stop-color="{PLUM2}"/><stop offset="1" stop-color="{PLUM1}"/></linearGradient>'
            f'<linearGradient id="leaf{u}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{CORAL}"/>'
            f'<stop offset="1" stop-color="{AMBER}"/></linearGradient></defs>')

def mark(u, mono=None, line=None):
    """Line, plum and leaf on the 1024 grid. mono = one flat colour (Android themed icon)."""
    if mono:   # crease and leaf gap cut out, so the silhouette reads as a plum, not an apple
        return (f'<mask id="m{u}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">'
                f'<rect width="1024" height="1024" fill="#000"/><path d="{FRUIT}" fill="#fff"/>'
                f'<path d="{SUTURE}" fill="none" stroke="#000" stroke-width="30" stroke-linecap="round"/>'
                f'<path d="{LEAF}" fill="#000" stroke="#000" stroke-width="40"/></mask>'
                f'<rect x="494" y="96" width="36" height="290" rx="18" fill="{mono}"/>'
                f'<rect width="1024" height="1024" fill="{mono}" mask="url(#m{u})"/><path d="{LEAF}" fill="{mono}"/>')
    return (f'<rect x="494" y="96" width="36" height="300" rx="18" fill="url(#line{u})"/>'
            f'<path d="{FRUIT}" fill="url(#fruit{u})"/>'
            f'<path d="{SUTURE}" fill="none" stroke="{PAPER}" stroke-opacity="0.22" stroke-width="18" stroke-linecap="round"/>'
            f'<ellipse cx="392" cy="566" rx="42" ry="96" transform="rotate(-18 392 566)" fill="#FFFFFF" opacity="0.16"/>'
            f'<path d="{LEAF}" fill="url(#leaf{u})"/>')

def svg(inner, size=1024, vb='0 0 1024 1024'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="{vb}">{inner}</svg>'

def icon(u, rounded=False):
    bg = f'<rect width="1024" height="1024" rx="{228 if rounded else 0}" fill="{PAPER}"/>'
    return svg(defs(u) + bg + mark(u))

def mark_only(u, scale=1.0, mono=None):
    t = f'translate({512 - 512 * scale} {512 - 512 * scale}) scale({scale})'
    return svg(defs(u) + f'<g transform="{t}">{mark(u, mono)}</g>')

# ---- wordmark: "plumb" in Space Grotesk Bold, outlined so it needs no font ----
font = TTFont(FONT); gs = font.getGlyphSet(); cmap = font.getBestCmap()
asc, desc = font['hhea'].ascent, -font['hhea'].descent

def word(ink):
    x, parts = 0, []
    for ch in 'plumb':
        g = gs[cmap[ord(ch)]]; pen = SVGPathPen(gs); g.draw(pen)
        parts.append(f'<path transform="translate({x} {asc}) scale(1 -1)" d="{pen.getCommands()}" fill="{ink}"/>')
        x += g.width
    return ''.join(parts), x

def lockup(u, ink, bg=None, height=240):
    """Icon tile + wordmark, side by side."""
    w_paths, w_width = word(ink)
    tile = asc + desc                              # tile is as tall as the type's full height
    gap = tile * 0.06
    total_w = tile + gap + w_width
    pad = tile * 0.18
    vb_w, vb_h = total_w + pad * 2, tile + pad * 2
    s = tile / 1024
    inner = (defs(u) + (f'<rect x="{-pad}" y="{-pad}" width="{vb_w}" height="{vb_h}" fill="{bg}"/>' if bg else '')
             + f'<g transform="scale({s})"><rect width="1024" height="1024" rx="228" fill="{PAPER}"/>{mark(u)}</g>'
             + f'<g transform="translate({tile + gap} 0)">{w_paths}</g>')
    width = height * vb_w / vb_h
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" height="{height}" '
            f'viewBox="{-pad} {-pad} {vb_w} {vb_h}">{inner}</svg>')

def wordmark(ink, height=200):
    w_paths, w_width = word(ink)
    pad = 40
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{height * (w_width + 2 * pad) / (asc + desc + 2 * pad):.0f}" '
            f'height="{height}" viewBox="{-pad} {-pad} {w_width + 2 * pad} {asc + desc + 2 * pad}">{w_paths}</svg>')

files = {
    'plumb-app-icon.svg': icon('a'),
    'plumb-app-icon-rounded.svg': icon('b', rounded=True),
    'plumb-mark.svg': mark_only('c'),
    'plumb-mark-mono.svg': mark_only('d', mono='#FFFFFF'),
    'plumb-wordmark.svg': wordmark(PLUM1),
    'plumb-lockup.svg': lockup('e', PLUM1),
    'plumb-lockup-on-plum.svg': lockup('f', PAPER, bg=PLUM1),
}
os.makedirs(OUT, exist_ok=True)
for name, s in files.items():
    open(os.path.join(OUT, name), 'w').write(s)

# App asset sources, rendered to PNG by render_assets.js
A = os.path.join(OUT, 'png-src'); os.makedirs(A, exist_ok=True)
assets = {
    'icon.svg': icon('g'),                                     # iOS: full-bleed, iOS rounds it; no transparency
    'splash-icon.svg': mark_only('h', scale=0.9),
    'android-icon-foreground.svg': mark_only('i', scale=0.62), # inside the adaptive-icon safe zone
    'android-icon-monochrome.svg': mark_only('j', scale=0.62, mono='#FFFFFF'),
    'android-icon-background.svg': svg(f'<rect width="1024" height="1024" fill="{PAPER}"/>'),
    'favicon.svg': icon('l', rounded=True),
}
for name, s in assets.items():
    open(os.path.join(A, name), 'w').write(s)
print('wrote', len(files), 'brand files and', len(assets), 'asset sources')
