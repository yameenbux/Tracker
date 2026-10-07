let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const fs = require('fs');
const src = process.argv[2], out = process.argv[3];
const jobs = [['icon', 1024, false], ['icon-dark', 1024, false], ['icon-tinted', 1024, false], ['splash-icon', 1024, true], ['android-icon-foreground', 512, true],
  ['android-icon-monochrome', 432, true], ['android-icon-background', 512, false], ['favicon', 48, true]];
(async () => {
  const b = await chromium.launch();
  for (const [n, size, transparent] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const svg = fs.readFileSync(`${src}/${n}.svg`, 'utf8').replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: `${out}/${n}.png`, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  }
  await b.close();
})();
