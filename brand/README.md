# Tidemark brand

The mark is a scale's dial seen from above. The upper half of the ring is paper; the lower half fills amber to coral,
the progress you've made; the needle rests steady on a coral hub. It says health at a glance, and the needle sits still
on purpose: Tidemark reads the trend, not today's jump. Strokes are heavy enough to read at 29 px; in one colour (iOS
tinted, Android themed) the paper half steps back to show the filled half, and the hub becomes a ring.

The dial (direction D3) was picked in October 2026 from AI concept rounds, then redrawn here as exact geometry.

Figma (the earlier directions, including A · Calming waves, the mark before the dial, and the Plumb work, archived):
https://www.figma.com/design/CZGyRjRwm0vNKi5EQA33Ek

| File | Use |
|---|---|
| `tidemark-app-icon.svg` | Master app icon, full-bleed (iOS rounds the corners itself). Dark and tinted iOS versions are in `mobile/assets` |
| `tidemark-app-icon-rounded.svg` | Icon with corners, for slides, the website and previews |
| `tidemark-mark.svg` / `tidemark-mark-mono.svg` | Mark without background; one-colour version for Android themed icons |
| `tidemark-wordmark.svg` | Wordmark alone |
| `tidemark-lockup.svg` / `tidemark-lockup-on-plum.svg` | Icon + wordmark, on light and on plum |
| `tidemark-brand-sheet.png` | Overview: the icon at every size, dark, tinted, and the lockups |

Colours: paper `#FBF7F3`, ink `#241B33`, plum `#352657` → `#2A1E45` → `#1E1533`, coral `#FF6B5E`, amber `#FFA24B`.
Type: Space Grotesk Bold (display), Hanken Grotesk (body).

Regenerate: `pip install fonttools && python3 make_logo.py .` (from this folder, after `npm install` in `mobile/`) writes the SVGs here and the asset sources to `png-src/`;
`node render_assets.js png-src ../mobile/assets` renders the app PNGs with Playwright.
The in-app icon (`mobile/src/components/Logo.tsx`) uses the same geometry.
