/* global __dirname */
// Builds the GitHub Pages site from the web export: Tidemark at the root (with the bits iOS needs to add it to the
// Home Screen as a full-screen app), the privacy policy at its usual address, and the original web tracker in /classic.
// Usage: node scripts/pages-site.js <web-export-dir> <out-dir> <base-path, e.g. /Tracker> [site-url, for link previews]
const fs = require('fs');
const path = require('path');

const [dist, out, base = '', siteUrl = ''] = process.argv.slice(2);
if (!dist || !out) { console.error('usage: node scripts/pages-site.js <web-export-dir> <out-dir> [base-path]'); process.exit(1); }
const repo = path.resolve(__dirname, '..', '..');
const mobile = path.resolve(__dirname, '..');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });

// Home Screen icon and standalone mode (iOS reads these from the page, not from a build setting)
fs.copyFileSync(path.join(mobile, 'assets', 'icon.png'), path.join(out, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(mobile, 'assets', 'social.png'), path.join(out, 'social.png'));

// Title, description and link previews (iMessage, WhatsApp, search results). Previews need absolute addresses.
const esc = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = ({ title, description, page, noindex }) => [
  `<meta name="description" content="${esc(description)}">`,
  noindex ? '<meta name="robots" content="noindex">' : '',
  siteUrl ? `<link rel="canonical" href="${siteUrl}/${page}">` : '',
  '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Tidemark">',
  `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`,
  siteUrl ? `<meta property="og:url" content="${siteUrl}/${page}">` : '',
  siteUrl ? `<meta property="og:image" content="${siteUrl}/social.png">` : '',
  '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Tidemark: a private weight tracker. Read the trend, not the waves.">',
  '<meta name="twitter:card" content="summary_large_image">',
].filter(Boolean).join('');
const addHead = (file, tags, title) => {
  let h = fs.readFileSync(file, 'utf8');
  if (!h.includes('</head>')) throw new Error(`${file} has no </head>`);
  if (title) h = /<title>[^<]*<\/title>/.test(h) ? h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`) : h.replace('</head>', `<title>${esc(title)}</title></head>`);
  fs.writeFileSync(file, h.replace('</head>', tags + '</head>'));
};
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Tidemark', short_name: 'Tidemark', start_url: `${base}/`, scope: `${base}/`, display: 'standalone',
  background_color: '#FBF7F3', theme_color: '#2A1E45',
  icons: [{ src: `${base}/apple-touch-icon.png`, sizes: '1024x1024', type: 'image/png' }],
}, null, 2));
// The web app is the owner's private test build, not a product: kept out of search results
const head = meta({ title: 'Tidemark · Weight tracker', page: '', noindex: true,
  description: 'A private weight tracker. Your trend weight, not the daily noise, with a plan, habits and measurements. No account, and your data stays on your phone.' }) + [
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Tidemark">',
  // The app draws under the status bar (it already pads for it); iOS then shows white status text on top of it
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="theme-color" content="#FBF7F3" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#121019" media="(prefers-color-scheme: dark)">',
  // White status text needs a dark backing: dark mode already has the app's dark background, light mode gets a plum band
  '<style>@media (prefers-color-scheme: light){body::after{content:"";position:fixed;top:0;left:0;right:0;' +
    'height:env(safe-area-inset-top);background:#2A1E45;z-index:2147483647;pointer-events:none}}</style>',
].join('');
const indexPath = path.join(out, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('web export index.html has no </head>');
// viewport-fit=cover makes iOS report the notch and home-bar sizes, so the app's own safe-area padding applies
const viewport = /<meta name="viewport"[^>]*>/;
if (!viewport.test(html)) throw new Error('web export index.html has no viewport meta');
fs.writeFileSync(indexPath, html
  .replace(viewport, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />')
  .replace(/<title>[^<]*<\/title>/, '<title>Tidemark · Weight tracker</title>')
  .replace('</head>', head + '</head>'));

// The privacy policy keeps its address; the original web tracker moves to /classic (it loads its own fonts)
fs.copyFileSync(path.join(repo, 'privacy.html'), path.join(out, 'privacy.html'));
addHead(path.join(out, 'privacy.html'), meta({ title: 'Tidemark · Privacy policy', page: 'privacy.html',
  description: 'Tidemark collects no data. Everything you enter stays on your phone: no account, no server, no analytics, no ads.' }));
fs.mkdirSync(path.join(out, 'classic'), { recursive: true });
fs.copyFileSync(path.join(repo, 'index.html'), path.join(out, 'classic', 'index.html'));
fs.cpSync(path.join(repo, 'fonts'), path.join(out, 'classic', 'fonts'), { recursive: true });
// The original tracker stays reachable for anyone still using it, but out of search results (the app is the real thing)
addHead(path.join(out, 'classic', 'index.html'), meta({ title: 'Tidemark Classic', page: 'classic/', noindex: true,
  description: 'The original web version of the tracker. The current app is at the main address.' }), 'Tidemark Classic');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Pages site written to ${out}`);
