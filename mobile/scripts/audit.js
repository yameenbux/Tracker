// Fails CI on any high or critical advisory in runtime dependencies that isn't on the reviewed list below.
// `npm audit --audit-level=high` alone can't be used: build-time tooling that Expo pulls in carries advisories
// that never reach the app, so the gate would always be red and people would learn to ignore it.
// Usage: node scripts/audit.js   (reads `npm audit --omit=dev --json`)
const { execSync } = require('child_process');

// Reviewed: each one is in build tooling only and doesn't ship in the app binary. Re-check after each Expo upgrade.
const ALLOWED = {
  'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm': 'braces, via Metro: bundler file matching at build time',
  'https://github.com/advisories/GHSA-86w9-cpqp-85rv': 'node-forge, via the Expo CLI: code signing helpers at build time',
};

let out;
try { out = execSync('npm audit --omit=dev --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
catch (e) { out = e.stdout; }                       // npm audit exits non-zero whenever it finds anything
const report = JSON.parse(out);
const found = new Map();
for (const v of Object.values(report.vulnerabilities || {})) {
  for (const s of v.via) {
    if (typeof s === 'object' && (s.severity === 'high' || s.severity === 'critical')) found.set(s.url, `${s.name}: ${s.title}`);
  }
}
const fresh = [...found].filter(([url]) => !ALLOWED[url]);
const stale = Object.keys(ALLOWED).filter(url => !found.has(url));
for (const url of stale) console.log(`No longer reported, can be removed from the list: ${url}`);
if (fresh.length) {
  console.error('New high or critical advisories in runtime dependencies:');
  for (const [url, what] of fresh) console.error(`  ${what}\n  ${url}`);
  console.error('Fix them, or review and add them to ALLOWED in scripts/audit.js with the reason.');
  process.exit(1);
}
console.log(`Audit OK: ${found.size} reviewed high/critical advisories, none new.`);
