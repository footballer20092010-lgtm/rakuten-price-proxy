const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_ITEMS = 10;
const NAV_TIMEOUT = 15000;
const MAX_RETRY = 1;

function parsePriceToNumber(text) {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function scrapeRakuten(searchUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: CHROME_UA,
      locale: 'ja-JP',
      viewport: { width: 1366, height: 768 }
    });

    const page = await context.newPage();

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT
    });

    await page.waitForTimeout(1200);

    const items = await page.evaluate((limit) => {
      const anchors = Array.from(document.querySelectorAll('a[href*="item.rakuten.co.jp"]'));
      const used = new Set();
      const results = [];

      for (const anchor of anchors) {
        if (results.length >= limit) break;

        const href = anchor.href;
        if (!href || !href.includes('item.rakuten.co.jp')) continue;

        const normalizedUrl = href.split('?')[0];
        if (used.has(normalizedUrl)) continue;

        const titleCandidate =
          anchor.getAttribute('title') ||
          anchor.textContent ||
          anchor.querySelector('img')?.alt ||
          '';
        const title = titleCandidate.replace(/\s+/g, ' ').trim();
        if (!title) continue;

        const card =
          anchor.closest('li') ||
          anchor.closest('section') ||
          anchor.closest('div');

        if (!card) continue;

        const priceEl = card.querySelector('[class*="price" i], [data-testid*="price" i]');
        const priceText = (priceEl?.textContent || card.textContent || '').trim();

        const image =
          anchor.querySelector('img')?.src ||
          card.querySelector('img')?.src ||
          null;

        results.push({
          title,
          priceText,
          url: normalizedUrl,
          image
        });
        used.add(normalizedUrl);
      }

      return results;
    }, MAX_ITEMS * 2);

    return items;
  } finally {
    await browser.close();
  }
}

async function fetchWithRetry(searchUrl) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
    try {
      const raw = await scrapeRakuten(searchUrl);
      return raw;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRY) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError;
}

app.get('/rakuten', async (req, res) => {
  const query = (req.query.q || '').toString().trim();

  if (!query) {
    return res.status(200).json({
      status: 'not_found',
      items: []
    });
  }

  const searchUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/`;
  console.log(`[rakuten] 検索URL: ${searchUrl}`);

  try {
    const rawItems = await fetchWithRetry(searchUrl);

    const items = rawItems
      .map((item) => ({
        title: item.title,
        price: parsePriceToNumber(item.priceText),
        url: item.url,
        image: item.image
      }))
      .filter((item) => item.url && item.url.includes('item.rakuten.co.jp'))
      .filter((item) => Number.isFinite(item.price))
      .slice(0, MAX_ITEMS);

    if (!items.length) {
      console.log('[rakuten] 取得件数: 0');
      return res.status(200).json({
        status: 'not_found',
        items: []
      });
    }

    console.log(`[rakuten] 取得件数: ${items.length}`);
    items.slice(0, 3).forEach((item, index) => {
      console.log(`[rakuten] ${index + 1}. ${item.title} - ${item.price}`);
    });

    return res.status(200).json({
      status: 'found',
      query,
      items
    });
  } catch (error) {
    console.error('[rakuten] スクレイピング失敗:', error.message);
    return res.status(200).json({
      status: 'not_found',
      items: []
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
