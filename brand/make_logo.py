# Generates the Tidemark brand marks as SVG.
# The mark (direction A, "calming waves"): daily weigh-ins are the waves; they calm, and what's left is the trend, one
# flat line, with today marked where it lands. Read the trend, not the waves.
# Usage: python3 make_logo.py <out-dir>   (needs `pip install fonttools` and mobile/node_modules for the font)
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '../mobile/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf')
PLUM1, CORAL, AMBER, PAPER = '#2A1E45', '#FF6B5E', '#FFA24B', '#FBF7F3'

# ---- geometry (1024 grid) ----
X0, X1 = 210, 814                  # waves span
WAVES = ((318, 120, 0.34), (500, 60, 0.62))   # (baseline y, amplitude, opacity): the second is calmer and stronger
LINE_Y, LINE_END, TODAY = 690, 760, (788, 690)
STROKE, LINE_STROKE, TODAY_R = 76, 92, 72   # weights tuned so the mark still reads at 29 px

def wave(y, amp, n=3):
    w = (X1 - X0) / n
    d = f'M{X0} {y} Q {X0 + w / 2:.1f} {y - amp} {X0 + w:.1f} {y}'
    for i in range(2, n + 1): d += f' T {X0 + i * w:.1f} {y}'
    return d

def defs(u):
    return (f'<defs><linearGradient id="bg{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#352657"/>'
            f'<stop offset="0.55" stop-color="{PLUM1}"/><stop offset="1" stop-color="#1E1533"/></linearGradient>'
            f'<radialGradient id="warm{u}" cx="0.79" cy="0.69" r="0.5"><stop offset="0" stop-color="{CORAL}" stop-opacity="0.28"/>'
            f'<stop offset="1" stop-color="{CORAL}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="sheen{u}" cx="0.3" cy="0" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.08"/>'
            f'<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="tr{u}" gradientUnits="userSpaceOnUse" x1="{X0}" y1="{LINE_Y}" x2="{TODAY[0]}" y2="{LINE_Y}">'
            f'<stop offset="0" stop-color="{AMBER}"/><stop offset="1" stop-color="{CORAL}"/></linearGradient></defs>')

def mark(u, mono=None):
    ink = mono or PAPER
    waves = ''.join(f'<path d="{wave(y, amp)}" fill="none" stroke="{ink}" stroke-opacity="{min(1, op + 0.12) if mono else op}" '
                    f'stroke-width="{STROKE}" stroke-linecap="round"/>' for y, amp, op in WAVES)
    # in one colour the line stops short of the ring (a gap instead of the paper halo), or it would fill the ring's hole
    end = TODAY[0] - TODAY_R - LINE_STROKE // 2 - 26 if mono else LINE_END
    line = (f'<path d="M{X0} {LINE_Y} H{end}" stroke="{mono or f"url(#tr{u})"}" stroke-width="{LINE_STROKE}" '
            f'stroke-linecap="round"/>')
    cx, cy = TODAY
    # One colour: today becomes a ring, so it still stands apart from the line it sits on
    today = (f'<circle cx="{cx}" cy="{cy}" r="{TODAY_R - 21}" fill="none" stroke="{mono}" stroke-width="42"/>' if mono else
             f'<circle cx="{cx}" cy="{cy}" r="{TODAY_R}" fill="{PAPER}"/><circle cx="{cx}" cy="{cy}" r="{round(TODAY_R * 0.41)}" fill="{CORAL}"/>')
    return waves + line + today

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
