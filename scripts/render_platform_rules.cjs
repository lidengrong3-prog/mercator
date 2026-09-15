#!/usr/bin/env node
'use strict';

// Browser-rendered fallback for official rule centers that return an empty
// application shell to ordinary HTTP clients.  It emits normalized, bounded
// metadata only; raw page HTML and cookies are never written to disk.

const { chromium } = require('playwright');

function clean(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function isoDate(value) {
  const match = String(value || '').match(/(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

async function collectTikTok(page, listingUrl) {
  await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('article').first().waitFor({ state: 'visible', timeout: 20_000 });
  const candidates = await page.locator('article').evaluateAll((articles) => articles.map((article, index) => {
    const paragraphs = [...article.querySelectorAll('p')].map((node) => (node.innerText || '').replace(/\s+/g, ' ').trim());
    const spans = [...article.querySelectorAll('span')].map((node) => (node.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const title = (paragraphs[0] || '').replace(/^更新\s*/, '').trim();
    const summary = (paragraphs[1] || '').replace(/^摘要\s*[:：]?\s*/, '').trim();
    const dateText = paragraphs.find((value) => /更新时间/.test(value)) || '';
    // Scope comes from the card tags, not arbitrary words in the headline or
    // summary (for example, "US exports to Mexico" is a Mexico rule).
    const isUs = /美国/.test(paragraphs.slice(2).join(' '));
    return { index, title, summary, dateText, isUs };
  }));

  const records = [];
  for (const candidate of candidates.filter((row) => row.isUs && row.title.length >= 8).slice(0, 20)) {
    if (page.url() !== listingUrl) {
      await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
    }
    const article = page.locator('article').nth(candidate.index);
    const navigation = page.waitForURL((url) => url.href !== listingUrl, { timeout: 15_000 }).catch(() => null);
    await article.click({ timeout: 15_000 });
    await navigation;
    const sourceUrl = page.url();
    if (!/^https:\/\/seller\.tiktokshopglobalselling\.com\/university\/essay\?/.test(sourceUrl)) continue;
    const identity = new URL(sourceUrl).searchParams.get('knowledge_id');
    if (!identity) continue;
    records.push({
      rule_key: `tiktok-shop:${identity}`,
      title: clean(candidate.title, 240),
      summary: clean(candidate.summary),
      published_at: isoDate(candidate.dateText),
      effective_date: isoDate(candidate.dateText),
      source_url: sourceUrl,
      market: 'US',
      platform: 'TikTok Shop',
      platform_key: 'tiktok-shop',
    });
  }
  return records;
}

async function main() {
  const platform = clean(process.argv[2], 40).toLowerCase();
  const listingUrl = clean(process.argv[3], 500);
  if (platform !== 'tiktok-shop' || !/^https:\/\/seller\.tiktokshopglobalselling\.com\//.test(listingUrl)) {
    throw new Error('unsupported platform or official URL');
  }
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_BROWSER_CHANNEL) launchOptions.channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const records = await collectTikTok(page, listingUrl);
    process.stdout.write(`${JSON.stringify(records)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${clean(error && error.message, 500)}\n`);
  process.exitCode = 1;
});
