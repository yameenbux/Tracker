/* global __dirname */
// Builds the GitHub Pages site from the web export: Tidemark at the root (with the bits iOS needs to add it to the
// Home Screen as a full-screen app), the privacy policy at its usual address, and the original web tracker in /classic.
// Usage: node scripts/pages-site.js <web-export-dir> <out-dir> <base-path, e.g. /Tracker>
const fs = require('fs');
const path = require('path');

const [dist, out, base = ''] = process.argv.slice(2);
if (!dist || !out) { console.error('usage: node scripts/pages-site.js <web-export-dir> <out-dir> [base-path]'); process.exit(1); }
const repo = path.resolve(__dirname, '..', '..');
const mobile = path.resolve(__dirname, '..');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });

// Home Screen icon and standalone mode (iOS reads these from the page, not from a build setting)
fs.copyFileSync(path.join(mobile, 'assets', 'icon.png'), path.join(out, 'apple-touch-icon.png'));
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Tidemark', short_name: 'Tidemark', start_url: `${base}/`, scope: `${base}/`, display: 'standalone',
  background_color: '#FBF7F3', theme_color: '#2A1E45',
  icons: [{ src: `${base}/apple-touch-icon.png`, sizes: '1024x1024', type: 'image/png' }],
}, null, 2));
const head = [
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Tidemark">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="theme-color" content="#FBF7F3" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#121019" media="(prefers-color-scheme: dark)">',
].join('');
const indexPath = path.join(out, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('web export index.html has no </head>');
fs.writeFileSync(indexPath, html.replace('</head>', head + '</head>'));

// The privacy policy keeps its address; the original web tracker moves to /classic (it loads its own fonts)
fs.copyFileSync(path.join(repo, 'privacy.html'), path.join(out, 'privacy.html'));
fs.mkdirSync(path.join(out, 'classic'), { recursive: true });
fs.copyFileSync(path.join(repo, 'index.html'), path.join(out, 'classic', 'index.html'));
fs.cpSync(path.join(repo, 'fonts'), path.join(out, 'classic', 'fonts'), { recursive: true });
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Pages site written to ${out}`);
