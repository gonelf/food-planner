/**
 * index.js
 *
 * Zero-dependency HTTP service that exposes the recipe scraper to an admin UI.
 *
 *   POST /api/scrape        { term, maxPages }   → starts a job, returns { jobId }
 *   GET  /api/scrape/:jobId                      → job status, live log & result
 *   GET  /api/recipes                            → counts of saved recipe files
 *
 * Jobs run in-memory (one at a time is plenty for an admin trigger). Progress
 * events from the scraper are buffered so the admin page can poll for live logs.
 *
 * Run with:  node server/index.js   (defaults to port 3001, override with PORT)
 * In dev the Vite server proxies /api → this service (see vite.config.js).
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { scrapeRecipes } from './scraper.js';
import { saveRecipes, DATA_DIR } from './store.js';

const PORT = process.env.PORT || 3001;

/** In-memory job registry. */
const jobs = new Map();

function createJob(term, maxPages) {
  const id = randomUUID();
  const job = {
    id,
    term,
    maxPages,
    status: 'running', // running | done | error
    startedAt: new Date().toISOString(),
    finishedAt: null,
    log: [],
    found: 0,
    result: null,
    error: null,
  };
  jobs.set(id, job);
  return job;
}

function log(job, message) {
  job.log.push({ t: new Date().toISOString(), message });
  // Keep the buffer from growing without bound on large scrapes.
  if (job.log.length > 1000) job.log.splice(0, job.log.length - 1000);
}

/** Turns a structured scraper progress event into a human-readable log line. */
function describe(event) {
  switch (event.type) {
    case 'start':
      return `A iniciar scrape de "${event.term}" (até ${event.maxPages} páginas)…`;
    case 'listing':
      return `Página de resultados ${event.page}…`;
    case 'listing-result':
      return `  → ${event.found} links (${event.added} novos, ${event.total} no total)`;
    case 'listing-error':
      return `  ✗ erro na página ${event.page}: ${event.message}`;
    case 'urls':
      return `${event.total} receitas únicas encontradas. A extrair detalhes…`;
    case 'recipe-start':
      return `[${event.index}/${event.total}] ${event.url}`;
    case 'recipe-done':
      return `  ✓ ${event.title}`;
    case 'recipe-skip':
      return `  – ignorada (${event.reason})`;
    case 'recipe-error':
      return `  ✗ erro: ${event.message}`;
    case 'finish':
      return `Scrape concluído: ${event.scraped} receitas extraídas.`;
    default:
      return JSON.stringify(event);
  }
}

async function runJob(job) {
  try {
    const recipes = await scrapeRecipes(job.term, {
      maxPages: job.maxPages,
      onProgress: (event) => {
        log(job, describe(event));
        if (event.type === 'recipe-done') job.found += 1;
      },
    });
    const saved = await saveRecipes(job.term, recipes);
    log(
      job,
      `Guardado em ${saved.file}: ${saved.added} novas, ${saved.skipped} duplicadas ignoradas, ${saved.total} no total.`
    );
    job.result = { scraped: recipes.length, ...saved };
    job.status = 'done';
  } catch (err) {
    job.error = err.message;
    job.status = 'error';
    log(job, `Falha: ${err.message}`);
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function recipeFileSummary() {
  let files = [];
  try {
    files = (await readdir(DATA_DIR)).filter((f) => /^recipes.*\.json$/.test(f));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      const arr = JSON.parse(await readFile(join(DATA_DIR, f), 'utf8'));
      out.push({ file: f, count: Array.isArray(arr) ? arr.length : 0 });
    } catch {
      out.push({ file: f, count: 0 });
    }
  }
  return out;
}

// ─── Router ──────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  // POST /api/scrape
  if (req.method === 'POST' && url.pathname === '/api/scrape') {
    const body = await readBody(req);
    const term = String(body.term || '').trim();
    const maxPages = Math.min(Math.max(parseInt(body.maxPages, 10) || 20, 1), 100);
    if (!term) {
      sendJson(res, 400, { error: 'Indica um termo de pesquisa (ex.: "bacalhau").' });
      return;
    }
    const running = [...jobs.values()].find((j) => j.status === 'running');
    if (running) {
      sendJson(res, 409, { error: 'Já existe um scrape em curso.', jobId: running.id });
      return;
    }
    const job = createJob(term, maxPages);
    runJob(job); // fire and forget; progress polled via GET
    sendJson(res, 202, { jobId: job.id });
    return;
  }

  // GET /api/scrape/:jobId
  if (req.method === 'GET' && url.pathname.startsWith('/api/scrape/')) {
    const id = url.pathname.slice('/api/scrape/'.length);
    const job = jobs.get(id);
    if (!job) {
      sendJson(res, 404, { error: 'Job não encontrado.' });
      return;
    }
    sendJson(res, 200, {
      id: job.id,
      term: job.term,
      status: job.status,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      found: job.found,
      result: job.result,
      error: job.error,
      log: job.log,
    });
    return;
  }

  // GET /api/recipes
  if (req.method === 'GET' && url.pathname === '/api/recipes') {
    sendJson(res, 200, { files: await recipeFileSummary() });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Recipe scraper service a ouvir em http://localhost:${PORT}`);
});
