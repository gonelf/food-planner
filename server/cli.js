/**
 * cli.js — run the scraper from the command line, without the HTTP service.
 *
 *   node server/cli.js bacalhau
 *   node server/cli.js "peito de frango" --max-pages 10
 *   node server/cli.js bacalhau --browser   # force headless-browser fallback
 *   node server/cli.js bacalhau --fetch     # plain HTTP only, never a browser
 *
 * Saves results into src/data/recipes-<term>.json (merging with any existing file).
 */

import { scrapeRecipes } from './scraper.js';
import { saveRecipes } from './store.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  let maxPages = 20;
  let mode = 'auto';
  const terms = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-pages' || args[i] === '-p') {
      maxPages = parseInt(args[++i], 10) || maxPages;
    } else if (args[i] === '--browser') {
      mode = 'browser';
    } else if (args[i] === '--fetch') {
      mode = 'fetch';
    } else {
      terms.push(args[i]);
    }
  }
  return { term: terms.join(' ').trim(), maxPages, mode };
}

const { term, maxPages, mode } = parseArgs(process.argv);

if (!term) {
  console.error('Uso: node server/cli.js <termo> [--max-pages N] [--browser|--fetch]');
  process.exit(1);
}

const recipes = await scrapeRecipes(term, {
  maxPages,
  mode,
  onProgress: (e) => console.log(JSON.stringify(e)),
});

const saved = await saveRecipes(term, recipes);
console.log(
  `\nGuardado em ${saved.file}: ${saved.added} novas, ${saved.skipped} ignoradas, ${saved.total} no total.`
);
