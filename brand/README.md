# Plumb brand

The plumb bob is a plum, hanging from a plumb line. One shape carries the name (plum → plumb), the brand colour and food,
and the line is what the app does: it hangs true however noisy the scale is.

Design board with the three directions explored (A · Plum chosen, B · Monogram, C · Signal):
https://www.figma.com/design/CZGyRjRwm0vNKi5EQA33Ek

| File | Use |
|---|---|
| `plumb-app-icon.svg` | Master app icon, full-bleed paper tile (iOS rounds the corners itself) |
| `plumb-app-icon-rounded.svg` | Icon with corners, for slides, the website and previews |
| `plumb-mark.svg` / `plumb-mark-mono.svg` | Mark without background; one-colour version for Android themed icons |
| `plumb-wordmark.svg` | Wordmark alone |
| `plumb-lockup.svg` / `plumb-lockup-on-plum.svg` | Icon + wordmark, on light and on plum |
| `plumb-brand-sheet.png` | Overview |

Colours: paper `#FBF7F3`, ink `#241B33`, plum `#2A1E45` → `#4B2E73`, coral `#FF6B5E`, amber `#FFA24B`.
Type: Space Grotesk Bold (display), Hanken Grotesk (body).

Regenerate: `pip install fonttools && python3 make_logo.py .` (from this folder, after `npm install` in `mobile/`) writes the SVGs here and the asset sources to `png-src/`;
`node render_assets.js png-src ../mobile/assets` renders the app PNGs with Playwright.
The in-app icon (`mobile/src/components/Logo.tsx`) uses the same geometry.
