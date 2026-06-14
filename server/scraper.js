/**
 * scraper.js
 *
 * Zero-dependency scraper for Pingo Doce recipes (https://www.pingodoce.pt).
 *
 * Strategy:
 *  1. Walk the paginated search listing (…/receitas/pesquisa/?o=recente&sq=<term>&cp=<n>)
 *     collecting recipe page URLs until a page yields no new recipes.
 *  2. For each recipe page, read the embedded JSON-LD `Recipe` block
 *     (schema.org) and convert it into the project's recipe shape:
 *        { title, ingredients: [{ quantity, unit, name }], preparation: [string] }
 *
 * Uses only Node built-ins (global fetch from Node 18+). No npm install needed.
 */

const BASE = 'https://www.pingodoce.pt';

// Browser-like headers help get past basic bot filtering / WAF rules.
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches a URL as text with browser headers and exponential-backoff retries.
 */
async function fetchText(url, { retries = 3, referer = BASE } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, Referer: referer },
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s…
    }
  }
  throw lastErr;
}

// ─── LISTING / PAGINATION ────────────────────────────────────────────────────

// Paths under /receitas/ that are NOT individual recipes.
const NON_RECIPE_SEGMENTS = new Set([
  'pesquisa',
  'coleccoes',
  'colecoes',
  'categorias',
  'categoria',
  'tecnicas',
  'escola-de-cozinha',
  'chefs',
  'video',
  'videos',
]);

/**
 * Extracts absolute recipe URLs from a listing page's HTML.
 */
function extractRecipeLinks(html) {
  const links = new Set();
  const re = /href="((?:https:\/\/www\.pingodoce\.pt)?\/receitas\/([^/"#?]+)\/?)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[2];
    if (NON_RECIPE_SEGMENTS.has(slug)) continue;
    const path = m[1].startsWith('http') ? m[1] : BASE + m[1];
    // Normalise to a trailing-slash canonical form.
    links.add(path.replace(/\/?$/, '/'));
  }
  return [...links];
}

function listingUrl(term, page) {
  const q = encodeURIComponent(term);
  return `${BASE}/receitas/pesquisa/?o=recente&sq=${q}&cp=${page}`;
}

/**
 * Walks the paginated search results collecting unique recipe URLs.
 * Stops when a page returns no new recipes or maxPages is reached.
 */
async function collectRecipeUrls(term, { maxPages = 20, onProgress = () => {} } = {}) {
  const all = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = listingUrl(term, page);
    onProgress({ type: 'listing', page, url });
    let html;
    try {
      html = await fetchText(url, { referer: `${BASE}/receitas/` });
    } catch (err) {
      onProgress({ type: 'listing-error', page, url, message: err.message });
      break;
    }
    const links = extractRecipeLinks(html);
    const before = all.size;
    links.forEach((l) => all.add(l));
    const added = all.size - before;
    onProgress({ type: 'listing-result', page, found: links.length, added, total: all.size });
    // No new recipes on this page → we've reached the end of pagination.
    if (added === 0) break;
    await sleep(400); // be polite between requests
  }
  return [...all];
}

// ─── JSON-LD RECIPE PARSING ──────────────────────────────────────────────────

/**
 * Returns every JSON-LD object embedded in the page (flattening @graph).
 */
function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && Array.isArray(item['@graph'])) blocks.push(...item['@graph']);
        else blocks.push(item);
      }
    } catch {
      // Malformed JSON-LD block — skip it.
    }
  }
  return blocks;
}

function hasType(node, type) {
  const t = node && node['@type'];
  if (!t) return false;
  return Array.isArray(t) ? t.includes(type) : t === type;
}

/**
 * Flattens schema.org recipeInstructions (string | string[] | HowToStep[] |
 * HowToSection[]) into a flat array of step strings.
 */
function flattenInstructions(instructions) {
  const steps = [];
  const pushText = (text) => {
    if (!text) return;
    String(text)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => steps.push(s));
  };

  if (!instructions) return steps;
  if (typeof instructions === 'string') {
    pushText(instructions);
    return steps;
  }
  const arr = Array.isArray(instructions) ? instructions : [instructions];
  for (const node of arr) {
    if (typeof node === 'string') pushText(node);
    else if (hasType(node, 'HowToSection') && Array.isArray(node.itemListElement)) {
      for (const step of node.itemListElement) pushText(step.text || step.name);
    } else if (node && (node.text || node.name)) {
      pushText(node.text || node.name);
    }
  }
  return steps;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── INGREDIENT STRING → { quantity, unit, name } ────────────────────────────

// Maps a matched unit token to the abbreviation used in the existing dataset.
const UNIT_MAP = [
  { re: /^(kgs?|quilos?|quilogramas?)$/i, unit: 'kg' },
  { re: /^(g|gr|gramas?)$/i, unit: 'g' },
  { re: /^(mg|miligramas?)$/i, unit: 'mg' },
  { re: /^(l|litros?)$/i, unit: 'l' },
  { re: /^(dl|decilitros?)$/i, unit: 'dl' },
  { re: /^(cl|centilitros?)$/i, unit: 'cl' },
  { re: /^(ml|mililitros?)$/i, unit: 'ml' },
  { re: /^(ch[aá]venas?|chav\.?)$/i, unit: 'chávena' },
  { re: /^(copos?)$/i, unit: 'copo' },
  { re: /^(dentes?)$/i, unit: 'dente' },
  { re: /^(folhas?)$/i, unit: 'folha' },
  { re: /^(latas?)$/i, unit: 'lata' },
  { re: /^(pacotes?)$/i, unit: 'pacote' },
  { re: /^(embalagens?|emb\.?)$/i, unit: 'embalagem' },
  { re: /^(frascos?)$/i, unit: 'frasco' },
  { re: /^(ramos?)$/i, unit: 'ramo' },
  { re: /^(fios?)$/i, unit: 'fio' },
  { re: /^(pitadas?)$/i, unit: 'pitada' },
  { re: /^(unidades?|unid\.?|un\.?)$/i, unit: 'unid.' },
];

// Multi-word spoon units (checked before single-token units).
// End each with a (?=\s|$) lookahead — a plain \b fails after accented vowels
// like "chá"/"café" because those code points are not regex word characters.
const SPOON_UNITS = [
  { re: /^colher(?:es)?\s+de\s+sopa(?=\s|$)/i, unit: 'c. de sopa' },
  { re: /^c\.?\s*de\s*sopa(?=\s|$)/i, unit: 'c. de sopa' },
  { re: /^c\.?\s*s\.?(?=\s|$)/i, unit: 'c. de sopa' },
  { re: /^colher(?:es)?\s+de\s+sobremesa(?=\s|$)/i, unit: 'c. de sobremesa' },
  { re: /^c\.?\s*de\s*sobremesa(?=\s|$)/i, unit: 'c. de sobremesa' },
  { re: /^colher(?:es)?\s+de\s+ch[aá](?=\s|$)/i, unit: 'c. de chá' },
  { re: /^c\.?\s*de\s*ch[aá](?=\s|$)/i, unit: 'c. de chá' },
  { re: /^c\.?\s*c\.?(?=\s|$)/i, unit: 'c. de chá' },
  { re: /^colher(?:es)?\s+de\s+caf[eé](?=\s|$)/i, unit: 'c. de café' },
  { re: /^c\.?\s*de\s*caf[eé](?=\s|$)/i, unit: 'c. de café' },
];

// Leading-quantity matcher: numbers, decimals, fractions, unicode fractions, ranges.
const QTY_RE =
  /^\s*((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[-–a]\s*\d+(?:[.,]\d+)?)?|[½¼¾⅓⅔⅛])\s*/;

/**
 * Parses a free-form ingredient string into { quantity, unit, name },
 * matching the shape/units used by the existing recipe JSON files.
 */
function parseIngredient(raw) {
  let text = decodeEntities(raw);
  if (!text) return null;

  // "q.b." anywhere → no quantity, keep the ingredient name.
  const qbMatch = text.match(/\bq\.?\s*b\.?\b/i);
  if (qbMatch) {
    const name = text.replace(/\bq\.?\s*b\.?\b/i, '').replace(/[-–,]/g, ' ').trim();
    return { quantity: 'q.b.', unit: '', name: cleanName(name) };
  }

  // Leading quantity.
  let quantity = '';
  const qm = text.match(QTY_RE);
  if (qm) {
    quantity = normaliseQuantity(qm[1]);
    text = text.slice(qm[0].length);
  }

  // Unit (multi-word spoons first, then single-token units).
  let unit = '';
  for (const { re, unit: u } of SPOON_UNITS) {
    const m = text.match(re);
    if (m) {
      unit = u;
      text = text.slice(m[0].length);
      break;
    }
  }
  if (!unit) {
    const tokenMatch = text.match(/^([^\s]+)\s+/);
    if (tokenMatch) {
      const token = tokenMatch[1].replace(/\.$/, (s) => s); // keep dots for matcher
      const mapped = UNIT_MAP.find((u) => u.re.test(token));
      if (mapped) {
        unit = mapped.unit;
        text = text.slice(tokenMatch[0].length);
      }
    }
  }

  // Drop a connecting "de" between unit and name ("400 g de farinha").
  text = text.trim().replace(/^de\s+/i, '');

  const name = cleanName(text);
  if (!name) return null;
  return { quantity: quantity || '', unit, name };
}

function normaliseQuantity(q) {
  return q.replace(/\s+/g, ' ').replace(/\s*\/\s*/, '/').trim();
}

function cleanName(name) {
  let n = decodeEntities(name)
    .replace(/^[\s,;:.\-–]+/, '')
    .replace(/[\s,;:.\-–]+$/, '')
    .trim();
  // Match the existing dataset's lower-case ingredient names.
  if (n) n = n.charAt(0).toLowerCase() + n.slice(1);
  return n;
}

// ─── SINGLE RECIPE ───────────────────────────────────────────────────────────

/**
 * Fetches a recipe page and returns the project-shaped recipe, or null if the
 * page has no parseable Recipe JSON-LD.
 */
async function scrapeRecipe(url, { onProgress = () => {} } = {}) {
  const html = await fetchText(url, { referer: `${BASE}/receitas/` });
  const recipeNode = extractJsonLd(html).find((n) => hasType(n, 'Recipe'));
  if (!recipeNode) {
    onProgress({ type: 'recipe-skip', url, reason: 'no JSON-LD Recipe found' });
    return null;
  }

  const title = decodeEntities(recipeNode.name || '');
  const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient
    : recipeNode.recipeIngredient
    ? [recipeNode.recipeIngredient]
    : [];
  const ingredients = rawIngredients.map(parseIngredient).filter(Boolean);
  const preparation = flattenInstructions(recipeNode.recipeInstructions);

  if (!title || ingredients.length === 0 || preparation.length === 0) {
    onProgress({ type: 'recipe-skip', url, reason: 'incomplete recipe data' });
    return null;
  }

  return { title, ingredients, preparation, sourceUrl: url };
}

// ─── ORCHESTRATION ───────────────────────────────────────────────────────────

/**
 * Scrapes all recipes matching `term`, honouring pagination.
 * Calls onProgress with structured events throughout.
 *
 * @returns {Promise<Array<{title, ingredients, preparation, sourceUrl}>>}
 */
async function scrapeRecipes(term, { maxPages = 20, onProgress = () => {} } = {}) {
  onProgress({ type: 'start', term, maxPages });
  const urls = await collectRecipeUrls(term, { maxPages, onProgress });
  onProgress({ type: 'urls', total: urls.length });

  const recipes = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress({ type: 'recipe-start', index: i + 1, total: urls.length, url });
    try {
      const recipe = await scrapeRecipe(url, { onProgress });
      if (recipe) {
        recipes.push(recipe);
        onProgress({ type: 'recipe-done', index: i + 1, total: urls.length, title: recipe.title });
      }
    } catch (err) {
      onProgress({ type: 'recipe-error', url, message: err.message });
    }
    await sleep(300);
  }

  onProgress({ type: 'finish', scraped: recipes.length });
  return recipes;
}

export {
  scrapeRecipes,
  scrapeRecipe,
  collectRecipeUrls,
  extractRecipeLinks,
  parseIngredient,
  flattenInstructions,
  extractJsonLd,
};
