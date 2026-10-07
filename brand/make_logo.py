# Generates the Plumb brand marks as SVG.
# The mark: daily weigh-ins scatter, the trend eases down and settles on the goal line, and today is marked where it lands.
# Usage: python3 make_logo.py <out-dir>   (needs `pip install fonttools` and mobile/node_modules for the font)
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '../mobile/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf')
PLUM1, CORAL, AMBER, PAPER = '#2A1E45', '#FF6B5E', '#FFA24B', '#FBF7F3'

# ---- geometry (1024 grid) ----
P0, C1, C2, P3 = (204, 318), (352, 600), (548, 706), (806, 706)   # trend: steep at first, settles on the goal
GOAL_Y = 706
TREND = f'M{P0[0]} {P0[1]} C{C1[0]} {C1[1]} {C2[0]} {C2[1]} {P3[0]} {P3[1]}'

def bez(t):
    return tuple((1 - t) ** 3 * P0[i] + 3 * (1 - t) ** 2 * t * C1[i] + 3 * (1 - t) * t ** 2 * C2[i] + t ** 3 * P3[i] for i in (0, 1))

def tangent(t):
    a, b = bez(max(0, t - 0.01)), bez(min(1, t + 0.01))
    dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy)
    return dx / n, dy / n

# four weigh-ins, alternating either side of the trend
DOTS = []
for t, side in ((0.16, -1), (0.36, 1), (0.56, -1), (0.76, 1)):
    (x, y), (tx, ty) = bez(t), tangent(t)
    DOTS.append((round(x - ty * 92 * side, 1), round(y + tx * 92 * side, 1)))

def defs(u):
    return (f'<defs><linearGradient id="bg{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#352657"/>'
            f'<stop offset="0.55" stop-color="{PLUM1}"/><stop offset="1" stop-color="#1E1533"/></linearGradient>'
            f'<radialGradient id="warm{u}" cx="0.79" cy="0.69" r="0.5"><stop offset="0" stop-color="{CORAL}" stop-opacity="0.28"/>'
            f'<stop offset="1" stop-color="{CORAL}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="sheen{u}" cx="0.3" cy="0" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.08"/>'
            f'<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="tr{u}" gradientUnits="userSpaceOnUse" x1="{P0[0]}" y1="{P0[1]}" x2="{P3[0]}" y2="{P3[1]}">'
            f'<stop offset="0" stop-color="{AMBER}"/><stop offset="1" stop-color="{CORAL}"/></linearGradient></defs>')

def mark(u, mono=None):
    ink = mono or PAPER
    goal = (f'<path d="M196 {GOAL_Y} H828" stroke="{ink}" stroke-opacity="{0.5 if mono else 0.22}" stroke-width="18" '
            f'stroke-linecap="round" stroke-dasharray="0 46"/>')
    dots = ''.join(f'<circle cx="{x}" cy="{y}" r="34" fill="{ink}" opacity="{0.55 if mono else 0.42}"/>' for x, y in DOTS)
    trend = f'<path d="{TREND}" fill="none" stroke="{mono or f"url(#tr{u})"}" stroke-width="84" stroke-linecap="round"/>'
    today = (f'<circle cx="{P3[0]}" cy="{P3[1]}" r="70" fill="{mono}"/>' if mono else
             f'<circle cx="{P3[0]}" cy="{P3[1]}" r="70" fill="{PAPER}"/><circle cx="{P3[0]}" cy="{P3[1]}" r="28" fill="{CORAL}"/>')
    return goal + dots + trend + today

def svg(inner, w=1024, h=1024, vb='0 0 1024 1024'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{inner}</svg>'

def bg(u, rx=0):
    return ''.join(f'<rect width="1024" height="1024" rx="{rx}" fill="url(#{k}{u})"/>' for k in ('bg', 'warm', 'sheen'))

def icon(u, rounded=False):
    return svg(defs(u) + bg(u, 228 if rounded else 0) + mark(u))

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
    'plumb-app-icon.svg': icon('a'),
    'plumb-app-icon-rounded.svg': icon('b', rounded=True),
    'plumb-mark.svg': mark_only('c'),
    'plumb-mark-mono.svg': mark_only('d', mono='#FFFFFF'),
    'plumb-wordmark.svg': wordmark(PLUM1),
    'plumb-lockup.svg': lockup('e', PLUM1),
    'plumb-lockup-on-plum.svg': lockup('f', PAPER, page=PLUM1),
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
    'splash-icon.svg': mark_only('h', scale=0.9),
    'android-icon-foreground.svg': mark_only('i', scale=0.6),     # inside the adaptive-icon safe zone
    'android-icon-monochrome.svg': mark_only('j', scale=0.6, mono='#FFFFFF'),
    'android-icon-background.svg': svg(defs('k') + bg('k')),
    'favicon.svg': icon('l', rounded=True),
}
for name, s in assets.items():
    open(os.path.join(A, name), 'w').write(s)
print('wrote', len(files), 'brand files and', len(assets), 'asset sources; dots', DOTS)
