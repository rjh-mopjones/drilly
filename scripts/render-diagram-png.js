/**
 * Screenshot the pages written by render-diagram.ts. Needs playwright on
 * NODE_PATH, e.g. NODE_PATH=<dir with node_modules/playwright> node scripts/render-diagram-png.js out web-crawler
 */
const { chromium } = require("playwright");
const path = require("node:path");
(async () => {
  const [outDir, ...ids] = process.argv.slice(2);
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  for (const id of ids) {
    await p.goto("file://" + path.resolve(outDir, `${id}.html`));
    const el = await p.$("svg");
    await el.screenshot({ path: path.resolve(outDir, `${id}.png`) });
    console.log(`${id} -> ${path.resolve(outDir, `${id}.png`)}`);
  }
  await b.close();
})();
