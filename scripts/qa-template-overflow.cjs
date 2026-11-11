// Checks every new template in both formats against its fixed canvas bounds.
// Run after `docker compose up -d --build`: node scripts/qa-template-overflow.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = ['template-catalog-learning.ts', 'template-catalog-everyday.ts']
  .map((file) => fs.readFileSync(path.join(root, 'app/src/lib', file), 'utf8')).join('\n');
const ids = [...source.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1]);
if (ids.length !== 62 || new Set(ids).size !== 62) throw new Error(`Expected 62 unique new templates; found ${ids.length}`);

(async () => {
  const browserPath = process.env.CHROME_PATH || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const overflow = [];
  try {
    await page.goto('http://localhost:8080/#templates', { waitUntil: 'networkidle' });
    for (const format of ['card', 'carousel']) {
      if (format === 'carousel') await page.getByRole('button', { name: 'Carousel slide' }).click();
      for (const id of ids) {
        const tile = page.locator(`a.lp-feature-card[href*="template=${id}"]`);
        await tile.scrollIntoViewIfNeeded();
        const canvas = tile.locator(`[data-template-id="${id}"]`);
        await canvas.waitFor({ timeout: 5000 });
        const size = await canvas.locator('[data-catalog-content]').evaluate((node) => ({ available: node.clientHeight, needed: node.scrollHeight }));
        if (size.needed > size.available + 2) overflow.push({ id, format, ...size });
      }
    }
    process.stdout.write(JSON.stringify({ checked: ids.length * 2, overflow }, null, 2) + '\n');
    if (overflow.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
