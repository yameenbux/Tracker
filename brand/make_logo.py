# Generates the Tidemark brand marks as SVG.
# The mark (direction D, "the dial"): a scale's dial seen from above. The upper half of the ring is paper; the lower
# half fills amber to coral, the progress you've made; the needle rests steady on a coral hub. It reads as health at a
# glance, and the needle sits still on purpose: the trend, not today's jump.
# Usage: python3 make_logo.py <out-dir>   (needs `pip install fonttools` and mobile/node_modules for the font)
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '../mobile/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf')
PLUM1, CORAL, AMBER, PAPER = '#2A1E45', '#FF6B5E', '#FFA24B', '#FBF7F3'

# ---- geometry (1024 grid) ----
CX, CY, R, RING = 512, 524, 292, 96     # dial centre, ring radius (to the stroke's middle) and weight
NEEDLE_ANGLE, NEEDLE_LEN, NEEDLE_BASE = 45, 214, 64   # degrees from 12 o'clock (clockwise), length, base width
HUB = 58                                 # the coral hub the needle turns on; weights tuned so it reads at 29 px

def pt(angle, r):
    """A point on a circle around the dial centre; angle in degrees clockwise from 12 o'clock."""
    a = math.radians(angle)
    return CX + r * math.sin(a), CY - r * math.cos(a)

def arc(a0, a1):
    (x0, y0), (x1, y1) = pt(a0, R), pt(a1, R)
    return f'M{x0:.1f} {y0:.1f} A{R} {R} 0 {1 if abs(a1 - a0) > 180 else 0} 1 {x1:.1f} {y1:.1f}'

def defs(u):
    return (f'<defs><linearGradient id="bg{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#352657"/>'
            f'<stop offset="0.55" stop-color="{PLUM1}"/><stop offset="1" stop-color="#1E1533"/></linearGradient>'
            f'<radialGradient id="warm{u}" cx="0.5" cy="0.8" r="0.55"><stop offset="0" stop-color="{CORAL}" stop-opacity="0.24"/>'
            f'<stop offset="1" stop-color="{CORAL}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="sheen{u}" cx="0.3" cy="0" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.08"/>'
            f'<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="tr{u}" gradientUnits="userSpaceOnUse" x1="{CX - R}" y1="0" x2="{CX + R}" y2="0">'
            f'<stop offset="0" stop-color="{AMBER}"/><stop offset="1" stop-color="{CORAL}"/></linearGradient></defs>')

def mark(u, mono=None):
    ink = mono or PAPER
    # paper upper half (in one colour it steps back, so the filled half still reads as progress)
    upper = (f'<path d="{arc(-90, 90)}" fill="none" stroke="{ink}" stroke-opacity="{0.42 if mono else 1}" '
             f'stroke-width="{RING}" stroke-linecap="round"/>')
    lower = (f'<path d="{arc(90, 270)}" fill="none" stroke="{mono or f"url(#tr{u})"}" stroke-width="{RING}" '
             f'stroke-linecap="round"/>')
    tip = pt(NEEDLE_ANGLE, NEEDLE_LEN)
    l, r = pt(NEEDLE_ANGLE - 90, NEEDLE_BASE / 2), pt(NEEDLE_ANGLE + 90, NEEDLE_BASE / 2)
    needle = (f'<path d="M{l[0]:.1f} {l[1]:.1f} L{tip[0]:.1f} {tip[1]:.1f} L{r[0]:.1f} {r[1]:.1f} Z" fill="{ink}" '
              f'stroke="{ink}" stroke-width="14" stroke-linejoin="round"/>')
    # One colour: the hub becomes a ring, so it still stands apart from the needle it holds
    hub = (f'<circle cx="{CX}" cy="{CY}" r="{HUB - 17}" fill="none" stroke="{mono}" stroke-width="34"/>' if mono else
           f'<circle cx="{CX}" cy="{CY}" r="{HUB}" fill="{CORAL}"/>')
    return upper + lower + needle + hub

def svg(inner, w=1024, h=1024, vb='0 0 1024 1024'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{inner}</svg>'

def bg(u, rx=0):
    return ''.join(f'<rect width="1024" height="1024" rx="{rx}" fill="url(#{k}{u})"/>' for k in ('bg', 'warm', 'sheen'))

def icon(u, rounded=False):
    return svg(defs(u) + bg(u, 228 if rounded else 0) + mark(u))

def mark_only(u, scale=1.0, mono=None):
    t = f'translate({512 - 512 * scale} {512 - 512 * scale}) scale({scale})'
    return svg(defs(u) + f'<g transform="{t}">{mark(u, mono)}</g>')

# ---- wordmark: "tidemark" in Space Grotesk Bold, outlined so it needs no font ----
font = TTFont(FONT); gs = font.getGlyphSet(); cmap = font.getBestCmap()
asc, desc = font['hhea'].ascent, -font['hhea'].descent

def word(ink):
    x, parts = 0, []
    for ch in 'tidemark':
        g = gs[cmap[ord(ch)]]; pen = SVGPathPen(gs); g.draw(pen)
        parts.append(f'<path transform="translate({x} {asc}) scale(1 -1)" d="{pen.getCommands()}" fill="{ink}"/>')
        x += g.width
    return ''.join(parts), x

def lockup(u, ink, page=None, height=240):
    """Icon tile beside the wordmark."""
    w_paths, w_width = word(ink)
    tile = asc + desc
    gap, pad = tile * 0.22, tile * 0.18
    vb_w, vb_h = tile + gap + w_width + pad * 2, tile + pad * 2
    inner = (defs(u) + (f'<rect x="{-pad}" y="{-pad}" width="{vb_w}" height="{vb_h}" fill="{page}"/>' if page else '')
             + f'<g transform="scale({tile / 1024})">{bg(u, 228)}{mark(u)}</g>'
             + f'<g transform="translate({tile + gap} 0)">{w_paths}</g>')
    return svg(inner, f'{height * vb_w / vb_h:.0f}', height, f'{-pad} {-pad} {vb_w} {vb_h}')

def wordmark(ink, height=200):
    w_paths, w_width = word(ink)
    pad = 40; vb_w, vb_h = w_width + 2 * pad, asc + desc + 2 * pad
    return svg(w_paths, f'{height * vb_w / vb_h:.0f}', height, f'{-pad} {-pad} {vb_w} {vb_h}')

files = {
    'tidemark-app-icon.svg': icon('a'),
    'tidemark-app-icon-rounded.svg': icon('b', rounded=True),
    'tidemark-mark.svg': mark_only('c'),
    'tidemark-mark-mono.svg': mark_only('d', mono='#FFFFFF'),
    'tidemark-wordmark.svg': wordmark(PLUM1),
    'tidemark-lockup.svg': lockup('e', PLUM1),
    'tidemark-lockup-on-plum.svg': lockup('f', PAPER, page=PLUM1),
}
os.makedirs(OUT, exist_ok=True)
for name, s in files.items():
    open(os.path.join(OUT, name), 'w').write(s)

# App asset sources, rendered to PNG by render_assets.js
A = os.path.join(OUT, 'png-src'); os.makedirs(A, exist_ok=True)
assets = {
    'icon.svg': icon('g'),                                        # iOS light: full-bleed, iOS rounds it; no transparency
    'icon-dark.svg': svg(defs('m') + '<rect width="1024" height="1024" fill="#0E0B14"/>' + mark('m')),
    'icon-tinted.svg': svg('<rect width="1024" height="1024" fill="#000000"/>' + mark('n', mono='#FFFFFF')),  # greyscale; iOS tints it
    'splash-icon.svg': icon('h', rounded=True),                # the app icon tile, on the app's paper background
    'android-icon-foreground.svg': mark_only('i', scale=0.6),     # inside the adaptive-icon safe zone
    'android-icon-monochrome.svg': mark_only('j', scale=0.6, mono='#FFFFFF'),
    'android-icon-background.svg': svg(defs('k') + bg('k')),
    'favicon.svg': icon('l', rounded=True),
}
for name, s in assets.items():
    open(os.path.join(A, name), 'w').write(s)
print('wrote', len(files), 'brand files and', len(assets), 'asset sources')
