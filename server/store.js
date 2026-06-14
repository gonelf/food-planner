/**
 * store.js
 *
 * Persists scraped recipes to the project's JSON files
 * (data/recipes-<term>.json), matching the existing on-disk shape:
 *   { id, title, ingredients: [{ quantity, unit, name }], preparation: [string] }
 *
 * - IDs continue from the highest id found across every data/recipes*.json file,
 *   so they stay globally unique (the React app loads all files together).
 * - Re-scraping merges by source URL / title, so existing recipes are not
 *   duplicated and new ones are appended.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The React app imports recipes from src/data/recipes-*.json (see
// src/contexts/PlannerContext.jsx), so that's where scraped recipes must land.
const DATA_DIR = join(__dirname, '..', 'src', 'data');

const slugify = (term) =>
  term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normaliseTitle = (t) => (t || '').toLowerCase().normalize('NFC').trim();

async function readJsonArray(path) {
  try {
    const txt = await readFile(path, 'utf8');
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Highest recipe id across all data/recipes*.json files. */
async function maxIdAcrossFiles() {
  let max = 0;
  let files = [];
  try {
    files = (await readdir(DATA_DIR)).filter((f) => /^recipes.*\.json$/.test(f));
  } catch {
    return 0;
  }
  for (const f of files) {
    const arr = await readJsonArray(join(DATA_DIR, f));
    for (const r of arr) {
      if (typeof r.id === 'number' && r.id > max) max = r.id;
    }
  }
  return max;
}

/**
 * Opens an incremental store for data/recipes-<term>.json.
 *
 * Loads the existing file once, then lets the caller add recipes one at a time
 * and flush to disk after each — so a crash or stop mid-scrape keeps everything
 * gathered so far instead of losing the whole run.
 *
 * @param {string} term
 * @returns {Promise<{ add, save, summary }>}
 */
export async function createStore(term) {
  const file = join(DATA_DIR, `recipes-${slugify(term)}.json`);
  const recipes = await readJsonArray(file);

  const seenUrls = new Set(recipes.map((r) => r.sourceUrl).filter(Boolean));
  const seenTitles = new Set(recipes.map((r) => normaliseTitle(r.title)));
  let nextId = (await maxIdAcrossFiles()) + 1;
  let added = 0;
  let skipped = 0;
  let dirty = false;

  /** Adds one recipe; returns 'added' or 'skipped' (duplicate). */
  function add(r) {
    const titleKey = normaliseTitle(r.title);
    if ((r.sourceUrl && seenUrls.has(r.sourceUrl)) || seenTitles.has(titleKey)) {
      skipped++;
      return 'skipped';
    }
    recipes.push({
      id: nextId++,
      title: r.title,
      ingredients: r.ingredients,
      preparation: r.preparation,
      sourceUrl: r.sourceUrl,
    });
    if (r.sourceUrl) seenUrls.add(r.sourceUrl);
    seenTitles.add(titleKey);
    added++;
    dirty = true;
    return 'added';
  }

  /** Flushes to disk. Never creates an empty file. */
  async function save() {
    if (!dirty || recipes.length === 0) return;
    await writeFile(file, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
    dirty = false;
  }

  function summary() {
    return { file, added, skipped, total: recipes.length };
  }

  return { add, save, summary };
}

/**
 * Bulk-merges scraped recipes into data/recipes-<term>.json (non-incremental).
 * Kept for the CLI / one-shot path; built on top of createStore.
 *
 * @returns {Promise<{file, added, skipped, total}>}
 */
export async function saveRecipes(term, scraped) {
  const store = await createStore(term);
  for (const r of scraped) store.add(r);
  await store.save();
  return store.summary();
}

export { DATA_DIR, slugify, existsSync };
