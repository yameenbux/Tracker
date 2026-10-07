# Generates the Plumb brand marks as SVG.
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

OUT = sys.argv[1]
FONT = '/home/user/Tracker/mobile/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'
PLUM1, PLUM2, CORAL, AMBER, PAPER, INK = '#2A1E45', '#4B2E73', '#FF6B5E', '#FFA24B', '#FBF7F3', '#241B33'

def bob_parts(cx, top, w, h, fill, facet=True):
    """Plumb bob pointing down: small knob, short body, long taper. Returns SVG elements."""
    kw, kh = w * 0.30, h * 0.10                 # knob where the line ties on
    y1 = top + kh * 0.85                          # body top
    y2 = y1 + h * 0.20                            # end of the straight body
    tip = top + h
    rr = w * 0.16
    L, R = cx - w / 2, cx + w / 2
    body = (f"M{L + rr} {y1} H{R - rr} Q{R} {y1} {R} {y1 + rr} V{y2} "
            f"L{cx + w*0.07} {tip - h*0.035} Q{cx} {tip + h*0.01} {cx - w*0.07} {tip - h*0.035} "
            f"L{L} {y2} V{y1 + rr} Q{L} {y1} {L + rr} {y1} Z")
    out = f'<rect x="{cx - kw/2}" y="{top}" width="{kw}" height="{kh + 2}" rx="{kw*0.28}" fill="{fill}"/><path d="{body}" fill="{fill}"/>'
    if facet:   # lighter left facet so it reads as a turned metal weight, not a flat pin
        fac = (f"M{L + rr} {y1} H{cx} V{tip - h*0.02} L{cx - w*0.07} {tip - h*0.035} L{L} {y2} V{y1 + rr} Q{L} {y1} {L + rr} {y1} Z")
        out += f'<path d="{fac}" fill="#FFFFFF" opacity="0.16"/>'
    return out

def defs(uid, dark=True):
    return f'''<defs>
    <linearGradient id="bg{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{PLUM1}"/><stop offset="1" stop-color="{PLUM2}"/></linearGradient>
    <radialGradient id="glow{uid}" cx="0.82" cy="0.14" r="0.55"><stop offset="0" stop-color="{CORAL}" stop-opacity="0.32"/><stop offset="1" stop-color="{CORAL}" stop-opacity="0"/></radialGradient>
    <linearGradient id="bob{uid}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="{AMBER}"/><stop offset="1" stop-color="{CORAL}"/></linearGradient>
    <linearGradient id="line{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PAPER if dark else PLUM2}" stop-opacity="0"/><stop offset="0.35" stop-color="{PAPER if dark else PLUM2}"/></linearGradient>
  </defs>'''

def mark_group(uid, cx=512, line_top=118, bob_top=430, bob_w=250, bob_h=450, stroke=42, dark=True, mono=None):
    lc = mono or f'url(#line{uid})'
    bc = mono or f'url(#bob{uid})'
    return (f'<rect x="{cx - stroke/2}" y="{line_top}" width="{stroke}" height="{bob_top - line_top + 8}" rx="{stroke/2}" fill="{lc}"/>'
            + bob_parts(cx, bob_top, bob_w, bob_h, bc, facet=not mono))

def app_icon(uid='a', rounded=False):
    clip = f'<clipPath id="r{uid}"><rect width="1024" height="1024" rx="228"/></clipPath>' if rounded else ''
    open_g = f'<g clip-path="url(#r{uid})">' if rounded else '<g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{defs(uid)}<defs>{clip}</defs>'
            f'{open_g}<rect width="1024" height="1024" fill="url(#bg{uid})"/><rect width="1024" height="1024" fill="url(#glow{uid})"/>'
            f'{mark_group(uid)}</g></svg>')

def mark_only(uid, size=1024, scale=1.0, mono=None, dark=True):
    """Mark without background (Android adaptive foreground, splash, monochrome)."""
    s = scale
    g = mark_group(uid, dark=dark, mono=mono)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="{size}" height="{size}">{defs(uid, dark)}'
            f'<g transform="translate({512 - 512*s} {505 - 505*s}) scale({s})">{g}</g></svg>')

# ---- wordmark: "p u m b" from Space Grotesk Bold, with the l replaced by the plumb line + bob ----
font = TTFont(FONT)
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
asc = font['hhea'].ascent
def glyph(ch):
    name = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[name].draw(pen)
    bp = BoundsPen(gs); gs[name].draw(bp)
    return pen.getCommands(), gs[name].width, bp.bounds
l_name = cmap[ord('l')]; lb = BoundsPen(gs); gs[l_name].draw(lb)
stem = lb.bounds[2] - lb.bounds[0]            # stem width of the real "l", so the custom one matches
l_top = lb.bounds[3]

def wordmark(uid, ink, line_col, bob_fill, bg=None, height=300):
    x = 0; parts = []
    for ch in 'plumb':
        if ch == 'l':
            d, adv, bounds = glyph('l')
            parts.append(f'<path transform="translate({x} {asc}) scale(1 -1)" d="{d}" fill="{ink}"/>')
            cx = x + (bounds[0] + bounds[2]) / 2
            # the weight hangs from the foot of the "l", in the descender space, so the word still reads "plumb"
            parts.append(bob_parts(cx, asc - 4, stem * 2.0, 290, bob_fill, facet=True))
            x += adv
            continue
        d, adv, _ = glyph(ch)
        parts.append(f'<path transform="translate({x} {asc}) scale(1 -1)" d="{d}" fill="{ink}"/>')
        x += adv
    desc = -font['hhea'].descent
    w, h = x, asc + desc
    pad = 60
    vb_w, vb_h = w + pad * 2, h + pad * 2 - 140
    bgrect = f'<rect x="{-pad}" y="{-pad + 70}" width="{vb_w}" height="{vb_h}" fill="{bg}"/>' if bg else ''
    width = height * vb_w / vb_h
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad + 70} {vb_w} {vb_h}" width="{width:.0f}" height="{height}">'
            f'{defs(uid)}{bgrect}{"".join(parts)}</svg>')

files = {
  'plumb-app-icon.svg': app_icon('a'),
  'plumb-app-icon-rounded.svg': app_icon('b', rounded=True),
  'plumb-mark.svg': mark_only('c', dark=True),
  'plumb-mark-mono.svg': mark_only('d', mono='#FFFFFF'),
  'plumb-wordmark.svg': wordmark('e', PLUM1, PLUM1, 'url(#bobe)'),
  'plumb-wordmark-on-plum.svg': wordmark('f', PAPER, PAPER, 'url(#bobf)', bg=PLUM1),
}
for name, svg in files.items():
    open(f'{OUT}/{name}', 'w').write(svg)
print('wrote', len(files), 'files; stem', stem, 'upm', upm)

# ---- app assets (rendered to PNG by assets.js) ----
import os
A = os.path.join(OUT, 'png-src'); os.makedirs(A, exist_ok=True)
assets = {
  'icon.svg': app_icon('g'),                                   # iOS: full-bleed, iOS rounds it
  'splash-icon.svg': mark_only('h', scale=0.9),                # on plum splash background
  'android-icon-foreground.svg': mark_only('i', scale=0.58),   # inside the 66% safe zone
  'android-icon-monochrome.svg': mark_only('j', scale=0.58, mono='#FFFFFF'),
  'android-icon-background.svg': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{defs("k")}<rect width="1024" height="1024" fill="url(#bgk)"/><rect width="1024" height="1024" fill="url(#glowk)"/></svg>',
  'favicon.svg': app_icon('l', rounded=True),
}
for name, svg in assets.items():
    open(os.path.join(A, name), 'w').write(svg)
