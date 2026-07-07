// Renders a LinkedIn post (Format A single-card or Format B carousel) from
// posts/<slug>/content.json into posts/<slug>/output/ as high-quality PNG/PDF.
//
// Usage: node scripts/render.js <postFolder>
// Example: node scripts/render.js posts/2026-07-http-query-method

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');
const FONT_DIR = path.join(REPO_ROOT, 'brand', 'assets', 'fonts');
const DEFAULT_PHOTO = path.join(REPO_ROOT, 'brand', 'assets', 'profile-photo.jpg');
const DEFAULT_COMPANY_LOGO = path.join(REPO_ROOT, 'brand', 'assets', 'company-logo.jpg');

const SUPERSAMPLE = 2; // render at 2x, then downscale for crisp anti-aliased output

// Shared contact-icon row (Facebook / WhatsApp / Gmail / LinkedIn) used in the
// single-line footer on cover-style pages. Kept in one place so both the
// single-card template and the carousel cover slide stay visually identical.
const FOOTER_ICONS_HTML = `<div class="icons">
        <span class="icon" title="Facebook"><svg viewBox="0 0 24 24"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7c-.28-.04-1.24-.12-2.36-.12-2.34 0-3.94 1.43-3.94 4.04V9.9H8v3.1h2.4v8h3.1z"/></svg></span>
        <span class="icon" title="WhatsApp"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-7.6 13.8L3 21l4.3-1.4A9 9 0 1012 3zm0 1.8a7.2 7.2 0 016.1 11.1l-.2.4.7 2.4-2.5-.7-.4.2A7.2 7.2 0 1112 4.8zm-3.2 3.6c-.2 0-.5 0-.7.3-.2.3-.9.8-.9 2s.9 2.3 1 2.5c.1.1 1.7 2.7 4.1 3.7 2 .8 2.4.7 2.9.6.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.6-.3-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7.9-.8 1.1-.2.2-.3.2-.5.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.1-.3.2-.4.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4z"/></svg></span>
        <span class="icon" title="Gmail"><svg viewBox="0 0 24 24"><path d="M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11zm2 .3v.4l7 4.9 7-4.9v-.4l-7 4.4-7-4.4z"/></svg></span>
        <span class="icon" title="LinkedIn"><svg viewBox="0 0 24 24"><path d="M6.94 8.5H4.5V19h2.44V8.5zM5.72 4.5a1.42 1.42 0 100 2.84 1.42 1.42 0 000-2.84zM19.5 19h-2.44v-5.4c0-1.29-.03-2.94-1.8-2.94-1.8 0-2.08 1.4-2.08 2.85V19h-2.44V8.5h2.34v1.43h.03c.33-.62 1.12-1.28 2.31-1.28 2.47 0 2.93 1.63 2.93 3.74V19z"/></svg></span>
      </div>`;

function fileToDataUri(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function fontFaceCss() {
  const dir = pathToFileURL(FONT_DIR + path.sep).toString();
  return `
    @font-face { font-family:'Poppins'; font-weight:400; src:url('${dir}poppins-400.woff2') format('woff2'); }
    @font-face { font-family:'Poppins'; font-weight:600; src:url('${dir}poppins-600.woff2') format('woff2'); }
    @font-face { font-family:'Poppins'; font-weight:700; src:url('${dir}poppins-700.woff2') format('woff2'); }
    @font-face { font-family:'Poppins'; font-weight:800; src:url('${dir}poppins-800.woff2') format('woff2'); }
  `;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderCard(content, outputDir) {
  const templatePath = path.join(TEMPLATES_DIR, 'single-card.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  const photoPath = content.photo ? path.resolve(REPO_ROOT, content.photo) : DEFAULT_PHOTO;
  const photoSrc = fileToDataUri(photoPath);
  const companyLogoPath = content.companyLogo ? path.resolve(REPO_ROOT, content.companyLogo) : DEFAULT_COMPANY_LOGO;
  const companyLogoSrc = fileToDataUri(companyLogoPath);
  const fontUrlPrefix = pathToFileURL(FONT_DIR).toString();

  const paragraphs = Array.isArray(content.body) ? content.body : [content.body || ''];
  const bodyHtml = paragraphs
    .filter(Boolean)
    .map(p => `<p class="body-text">${escapeHtml(p)}</p>`)
    .join('\n    ');

  html = html
    .replace(/\{\{FONT_URL_PREFIX\}\}/g, fontUrlPrefix)
    .replace('{{EYEBROW}}', escapeHtml(content.eyebrow || 'TECH NEWS'))
    .replace('{{HEADLINE}}', escapeHtml(content.headline || ''))
    .replace('{{BODY_PARAGRAPHS}}', bodyHtml)
    .replace('{{HANDLE}}', escapeHtml(content.handle || '@xahabcse'))
    .replace('{{DESIGNATION}}', escapeHtml(content.designation || 'Assistant Software Engineer at OnnoRokom Projukti Limited'))
    .replace('{{AUTHOR_NAME}}', escapeHtml(content.authorName || 'Md Sahabuddin Hossain'))
    .replace('{{PHOTO_SRC}}', photoSrc)
    .replace('{{COMPANY_LOGO_SRC}}', companyLogoSrc);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: SUPERSAMPLE,
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(150); // let @font-face finish swapping in
    const buffer = await page.screenshot({ type: 'png' });
    await browser.close();

    const outPath = path.join(outputDir, 'card.png');
    await sharp(buffer)
      .resize(1080, 1080, { kernel: sharp.kernel.lanczos3 })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outPath);

    console.log('Wrote', outPath);
  } catch (err) {
    await browser.close();
    throw err;
  }
}

function renderSlideHtml(slide, index, total) {
  const pageLabel = `${index + 1} / ${total}`;
  if (slide.type === 'cover') {
    return `
      <section class="slide slide-cover">
        <div class="glow"></div>
        <div class="dash"></div>
        <div class="cover-title">${escapeHtml(slide.headline || '')}</div>
        <div class="footer">
          <div class="divider"></div>
          <div class="row">
            <img class="photo" src="${slide.photoSrc}" alt="${escapeHtml(slide.authorName || '')}" />
            ${FOOTER_ICONS_HTML}
            <div class="handle">${escapeHtml(slide.handle || '@xahabcse')}</div>
            <div class="sep">&middot;</div>
            <div class="designation">${escapeHtml(slide.designation || 'Software Engineer')}</div>
          </div>
        </div>
      </section>`;
  }
  if (slide.type === 'cta') {
    return `
      <section class="slide slide-cta">
        <div class="glow"></div>
        <h2>${escapeHtml(slide.heading || '')}</h2>
        <p class="body-text">${escapeHtml(slide.body || '')}</p>
        <p class="cta-line">${escapeHtml(slide.cta || '')}</p>
      </section>`;
  }
  // default: content slide
  const bulletsHtml = Array.isArray(slide.bullets) && slide.bullets.length
    ? `<ul class="checklist">${slide.bullets.map(b => `<li><span class="check">&#10003;</span><span>${escapeHtml(b)}</span></li>`).join('')}</ul>`
    : `<p class="body-text">${escapeHtml(slide.body || '')}</p>`;
  return `
    <section class="slide slide-content">
      <h2>${escapeHtml(slide.heading || '')}</h2>
      ${bulletsHtml}
      <div class="page-count">${pageLabel}</div>
    </section>`;
}

async function renderCarousel(content, outputDir) {
  const cssPath = path.join(TEMPLATES_DIR, 'carousel-styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const slides = content.slides || [];
  const total = slides.length;

  const slidesWithPhotos = slides.map(s => {
    if (s.type === 'cover') {
      const photoPath = s.photo ? path.resolve(REPO_ROOT, s.photo) : DEFAULT_PHOTO;
      return { ...s, photoSrc: fileToDataUri(photoPath), authorName: s.authorName || content.authorName };
    }
    return s;
  });

  const slidesHtml = slidesWithPhotos.map((s, i) => renderSlideHtml(s, i, total)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Carousel</title>
<style>
${fontFaceCss()}
${css}
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`;

  const browser = await chromium.launch();
  try {
    // Viewport tall enough to fit every stacked slide, so clipped per-slide
    // screenshots don't fall outside the rendered/visible page area.
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1080 * Math.max(total, 1) },
      deviceScaleFactor: SUPERSAMPLE,
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(150);

    // Full PDF (all slides, native multi-page — this is what gets uploaded to LinkedIn as a Document post)
    const pdfPath = path.join(outputDir, 'carousel.pdf');
    await page.pdf({
      path: pdfPath,
      width: '1080px',
      height: '1080px',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    });
    console.log('Wrote', pdfPath);

    // Per-slide PNGs (for quick preview/review) at 2x supersample, downscaled
    const handles = await page.$$('.slide');
    for (let i = 0; i < handles.length; i++) {
      const box = await handles[i].boundingBox();
      const buffer = await page.screenshot({
        clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
      const outPath = path.join(outputDir, `page-${String(i + 1).padStart(2, '0')}.png`);
      await sharp(buffer)
        .resize(1080, 1080, { kernel: sharp.kernel.lanczos3 })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(outPath);
      console.log('Wrote', outPath);
    }

    await browser.close();
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function main() {
  const postFolder = process.argv[2];
  if (!postFolder) {
    console.error('Usage: node scripts/render.js <postFolder>');
    process.exit(1);
  }
  const postDir = path.resolve(REPO_ROOT, postFolder);
  const contentPath = path.join(postDir, 'content.json');
  if (!fs.existsSync(contentPath)) {
    console.error('No content.json found at', contentPath);
    process.exit(1);
  }
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const outputDir = path.join(postDir, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  if (content.format === 'carousel') {
    await renderCarousel(content, outputDir);
  } else {
    await renderCard(content, outputDir);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
