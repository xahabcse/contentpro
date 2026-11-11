// Local browser QA for the Docker stack. Run: node scripts/qa-local-ui.cjs
// Uses the site's real assets and client-side editor; API auth/profile responses
// are stubbed so this check does not need a Turnstile token or a real account.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const JSZip = require('../app/node_modules/jszip');

const origin = 'http://localhost:8080';
const output = process.env.QA_OUT || path.join(os.tmpdir(), 'contentpro-qa');
fs.mkdirSync(output, { recursive: true });
const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };

async function mockUser(page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'qa-user', email: 'qa@example.test', emailVerified: true } }));
  await page.route('**/api/profile', (route) => route.fulfill({ json: { name: 'QA Author', handle: 'qa-author', designation: 'Designer' } }));
}

async function checkWidth(page, label) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  check(size.content <= size.viewport + 2, `${label} horizontal overflow: ${JSON.stringify(size)}`);
  return size;
}

async function download(page, button, label) {
  const event = page.waitForEvent('download', { timeout: 45000 });
  await button.click();
  const item = await event;
  const file = await item.path();
  const bytes = fs.statSync(file).size;
  check(bytes > 1000, `${label} export was empty (${bytes} bytes)`);
  const saved = path.join(output, item.suggestedFilename());
  await item.saveAs(saved);
  return { name: item.suggestedFilename(), bytes, saved };
}

(async () => {
  const browserPath = process.env.CHROME_PATH || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  check(fs.existsSync(browserPath), `Install Chrome or set CHROME_PATH to a Chromium executable: ${browserPath}`);
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockUser(page);
  try {
    await page.goto(`${origin}/#templates`, { waitUntil: 'networkidle' });
    check((await page.locator('body').innerText()).includes('100 CURATED TEMPLATES'), 'Landing template count is missing');
    await page.getByPlaceholder('Search tutorials, charts, career posts…').fill('Pie Chart');
    check(await page.getByRole('heading', { name: 'Pie Chart' }).count() === 1, 'Pie Chart search failed');
    await page.getByRole('button', { name: 'Carousel slide' }).click();
    await page.getByPlaceholder('Search tutorials, charts, career posts…').scrollIntoViewIfNeeded();
    await page.locator('.lp-template-preview svg').first().waitFor();
    await page.screenshot({ path: path.join(output, 'gallery-desktop.png') });
    const galleryDesktop = await checkWidth(page, 'landing desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByPlaceholder('Search tutorials, charts, career posts…').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'gallery-mobile.png') });
    const galleryMobile = await checkWidth(page, 'landing mobile');
    await page.setViewportSize({ width: 320, height: 700 });
    const galleryNarrow = await checkWidth(page, 'landing narrow mobile');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${origin}/dashboard?template=pie_chart&format=card`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /New Pie Chart card/ }).click();
    await page.getByRole('button', { name: 'Export PNG' }).waitFor();
    await page.getByRole('tab', { name: 'Templates', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('progress');
    check(await page.getByRole('button', { name: /Learning Progress/ }).count() > 0, 'Editor template search failed');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(output, 'editor-card-mobile.png') });
    const editorMobile = await checkWidth(page, 'editor mobile');
    await page.setViewportSize({ width: 320, height: 700 });
    const editorNarrow = await checkWidth(page, 'editor narrow mobile');
    await page.setViewportSize({ width: 390, height: 844 });
    const png = await download(page, page.getByRole('button', { name: 'Export PNG' }), 'PNG');
    const pngSize = await sharp(png.saved).metadata();
    check(pngSize.width === 1080 && pngSize.height === 1080, `Card export dimensions: ${pngSize.width}×${pngSize.height}`);

    await page.goto(`${origin}/dashboard?template=progress_tracker&format=carousel`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /New Learning Progress carousel/ }).click();
    await page.getByRole('button', { name: 'Add slide' }).click();
    await page.locator('summary[aria-label="Export carousel"]').click();
    const pdf = await download(page, page.getByRole('button', { name: /PDF for LinkedIn/ }), 'PDF');
    await page.locator('summary[aria-label="Export carousel"]').click();
    const zip = await download(page, page.getByRole('button', { name: /PNG slides ZIP for Facebook/ }), 'ZIP');
    check(fs.readFileSync(pdf.saved).subarray(0, 5).toString() === '%PDF-', 'Carousel export is not a PDF');
    const archive = await JSZip.loadAsync(fs.readFileSync(zip.saved));
    const slides = Object.values(archive.files).filter((entry) => !entry.dir && entry.name.endsWith('.png'));
    check(slides.length === 6, `Expected 6 PNG slides (five starters plus one added), found ${slides.length}`);
    for (const slide of slides) {
      const metadata = await sharp(await slide.async('nodebuffer')).metadata();
      check(metadata.width === 1080 && metadata.height === 1350, `Carousel slide dimensions: ${metadata.width}×${metadata.height}`);
    }

    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }));
    await page.route('**/api/admin/overview', (route) => route.fulfill({ json: { overview: { totalUsers: 260, verifiedUsers: 200, newUsers24h: 4, newUsers7d: 20, successfulLogins7d: 500, failedLogins7d: 15, failedLoginIps7d: 3 } } }));
    await page.route('**/api/admin/users', (route) => route.fulfill({ json: { users: [{ id: 'u1', email: 'member@example.test', name: 'Member', emailVerified: true }] } }));
    await page.route('**/api/admin/logs?limit=200', (route) => route.fulfill({ json: { events: [{ ts: Date.now(), type: 'login', email: 'member@example.test', ip: '127.0.0.1' }] } }));
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle' });
    check((await page.locator('body').innerText()).includes('260'), 'Admin overview aggregate missing');
    await page.screenshot({ path: path.join(output, 'admin-mobile.png') });
    const adminMobile = await checkWidth(page, 'admin mobile');
    await page.setViewportSize({ width: 320, height: 700 });
    const adminNarrow = await checkWidth(page, 'admin narrow mobile');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Users', exact: true }).last().click();
    check((await page.locator('body').innerText()).includes('member@example.test'), 'Mobile admin Users tab not reachable');
    await page.getByRole('button', { name: 'Security Logs', exact: true }).last().click();
    check((await page.locator('body').innerText()).includes('member@example.test'), 'Mobile admin Security Logs tab not reachable');
    check(pageErrors.length === 0, `Browser errors: ${pageErrors.join('; ')}`);
    process.stdout.write(JSON.stringify({ galleryDesktop, galleryMobile, galleryNarrow, editorMobile, editorNarrow, adminMobile, adminNarrow, png, pdf, zip, screenshots: output }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
