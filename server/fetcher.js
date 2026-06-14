/**
 * fetcher.js
 *
 * Fetch layer with an optional headless-browser fallback.
 *
 * Modes:
 *   'auto'    (default) — try plain HTTP fetch; if it fails (e.g. HTTP 403 from
 *                         the site's bot protection), retry once through a
 *                         headless browser, *if* Playwright is installed.
 *   'fetch'             — plain HTTP only, never launch a browser.
 *   'browser'           — always render through the headless browser.
 *
 * Playwright is an OPTIONAL dependency: it is loaded lazily via dynamic import,
 * so the service keeps working with zero dependencies when the plain fetch is
 * enough. To enable the fallback:
 *
 *     npm i -D playwright && npx playwright install chromium
 */

const BASE = 'https://www.pingodoce.pt';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Safari/605.1.15';

const DEFAULT_HEADERS = {
  'User-Agent': UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Plain HTTP ──────────────────────────────────────────────────────────────

async function fetchViaHttp(url, { referer, retries }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, Referer: referer },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1000 * 2 ** attempt); // 1s, 2s…
    }
  }
  throw lastErr;
}

// ─── Headless browser (lazy, optional) ───────────────────────────────────────

let browserPromise = null;
let playwrightMissing = false;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      let pw;
      try {
        pw = await import('playwright');
      } catch {
        const err = new Error(
          'Playwright não está instalado. Para ativar o fallback de browser: ' +
            'npm i -D playwright && npx playwright install chromium'
        );
        err.code = 'PLAYWRIGHT_MISSING';
        throw err;
      }
      const chromium = pw.chromium ?? pw.default?.chromium;
      return chromium.launch({ headless: true });
    })();
    // Don't cache a rejected promise — let the next call surface the same error.
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

async function fetchViaBrowser(url, { referer }) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'pt-PT',
    extraHTTPHeaders: { 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8', Referer: referer },
  });
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (resp && resp.status() >= 400) {
      throw new Error(`HTTP ${resp.status()} for ${url} (browser)`);
    }
    // Give late-injected JSON-LD / content a moment to land.
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    return await page.content();
  } finally {
    await context.close();
  }
}

/** Closes the shared browser instance (call once a scrape run is finished). */
export async function closeBrowser() {
  if (browserPromise) {
    const p = browserPromise;
    browserPromise = null;
    try {
      const browser = await p;
      await browser.close();
    } catch {
      /* never launched / already closed */
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches a URL as text, applying the selected fetch strategy.
 *
 * @param {string} url
 * @param {object} opts
 * @param {string} [opts.referer]
 * @param {'auto'|'fetch'|'browser'} [opts.mode='auto']
 * @param {number} [opts.retries=1]  HTTP retry count before falling back
 * @param {(msg:string)=>void} [opts.onNotice]  surfaces fallback notices
 */
export async function fetchText(
  url,
  { referer = BASE, mode = 'auto', retries = 1, onNotice } = {}
) {
  if (mode === 'browser') return fetchViaBrowser(url, { referer });

  try {
    return await fetchViaHttp(url, { referer, retries });
  } catch (httpErr) {
    if (mode === 'fetch' || playwrightMissing) throw httpErr;
    // 'auto': attempt the headless-browser fallback.
    try {
      onNotice?.(`Fetch direto falhou (${httpErr.message}); a tentar via browser headless…`);
      return await fetchViaBrowser(url, { referer });
    } catch (browserErr) {
      if (browserErr.code === 'PLAYWRIGHT_MISSING') {
        playwrightMissing = true; // stop retrying the browser path for this run
        onNotice?.(browserErr.message);
        throw httpErr; // surface the original (more meaningful) HTTP error
      }
      throw browserErr;
    }
  }
}

export { BASE };
