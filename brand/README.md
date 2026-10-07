# Plumb brand

A plumb line hangs true whatever the day looks like — the steady trend under the noisy scale.

| File | Use |
|---|---|
| `plumb-app-icon.svg` | Master app icon, full-bleed (iOS rounds the corners itself) |
| `plumb-app-icon-rounded.svg` | Icon with corners, for slides, the website and previews |
| `plumb-mark.svg` / `plumb-mark-mono.svg` | Mark without background; one-colour version for Android themed icons |
| `plumb-wordmark.svg` / `plumb-wordmark-on-plum.svg` | Wordmark on light and on plum |
| `plumb-brand-sheet.png` | Overview |

Colours: paper `#FBF7F3`, ink `#241B33`, plum `#2A1E45` → `#4B2E73`, coral `#FF6B5E`, amber `#FFA24B`.
Type: Space Grotesk Bold (display), Hanken Grotesk (body).

Regenerate: `pip install fonttools && python3 make_logo.py .` writes the SVGs here and the asset sources to `png-src/`;
`node render_assets.js png-src ../mobile/assets` renders the app PNGs with Playwright.
The in-app icon (`mobile/src/components/Logo.tsx`) uses the same geometry.
