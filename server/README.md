# Recipe scraper service

A small, **zero-dependency** Node service (Node 18+) that scrapes Pingo Doce
recipes by search term and saves them into the app's data files
(`src/data/recipes-<term>.json`), in the same shape the React app already
consumes:

```json
{ "id": 102, "title": "…", "ingredients": [{ "quantity": "400", "unit": "g", "name": "…" }], "preparation": ["…"], "sourceUrl": "https://www.pingodoce.pt/receitas/…/" }
```

It walks the paginated search listing (`…/receitas/pesquisa/?o=recente&sq=<term>&cp=<n>`)
until pagination is exhausted, then reads each recipe page's schema.org
`Recipe` JSON-LD and converts it. IDs continue from the highest id across all
`src/data/recipes*.json` files; re-running merges by source URL / title so
recipes are never duplicated.

## Run it

### From the admin web page (recommended)

```bash
npm run server          # starts the service on http://localhost:3001
npm run dev             # in another terminal: starts Vite (proxies /api → :3001)
```

Then open the app and go to **`/#admin`** (e.g. `http://localhost:5173/#admin`),
type a term such as `bacalhau` or `frango`, and press **Iniciar scrape**. Live
progress and the saved-file summary are shown on the page.

### From the command line

```bash
npm run scrape -- bacalhau
npm run scrape -- "peito de frango" --max-pages 10
npm run scrape -- bacalhau --browser     # force the headless-browser fallback
npm run scrape -- bacalhau --fetch        # plain HTTP only, never a browser
```

## Anti-bot fallback (headless browser)

The Pingo Doce site uses bot protection that can return `HTTP 403` to a plain
HTTP fetch. The service has three **methods**, selectable in the admin page or
via the API (`mode`) / CLI flags:

| Method    | Behaviour                                                        |
| --------- | --------------------------------------------------------------- |
| `auto`    | Default. Plain fetch first; on failure retry through a headless browser (if Playwright is installed). |
| `browser` | Always render pages through a headless Chromium.                 |
| `fetch`   | Plain HTTP only — never launch a browser.                       |

The browser fallback uses **Playwright**, which is an *optional* dependency
loaded lazily — the service runs with zero dependencies when plain fetch is
enough. To enable the fallback:

```bash
npm i -D playwright
npx playwright install chromium
```

If Playwright isn't installed, `auto`/`browser` degrade gracefully and the job
log explains how to enable it.

## HTTP API

| Method | Path                 | Body / Notes                                  |
| ------ | -------------------- | --------------------------------------------- |
| POST   | `/api/scrape`        | `{ "term": "bacalhau", "maxPages": 20 }` → `{ jobId }` |
| GET    | `/api/scrape/:jobId` | Job status, live log and result               |
| GET    | `/api/recipes`       | Counts per saved recipe file                  |

## Resilience & live feedback

The scrape is modular so one bad recipe or page never sinks the whole run:

- Each recipe is fetched, parsed and **saved independently** — a single failure
  is logged and counted, then the run continues.
- Recipes are **persisted incrementally** (the file is flushed after every new
  recipe), so a crash, stop or network drop keeps everything gathered so far.
  On error the job result is marked `partial` with whatever was saved.
- Pagination tolerates transient page errors and only stops after several
  consecutive failures (or when a page yields no new recipes).
- The admin page shows a **live progress bar** and counters
  (encontradas / processadas / guardadas / duplicadas / sem receita / falhadas)
  plus the recipe currently being processed, polled from
  `GET /api/scrape/:jobId` (`progress` field).

## Notes

- Running from your own machine / server (a real outbound IP) generally works
  with plain `fetch`; if you hit `HTTP 403`, switch to the `auto`/`browser`
  method (see above). Sandboxes with an egress allow-list may block the host
  entirely regardless of method — the job log reports this clearly.
- After a scrape, new recipes appear in the app automatically: any
  `src/data/recipes*.json` file is picked up by `PlannerContext.jsx` via
  `import.meta.glob`, so new terms (e.g. `recipes-bacalhau.json`) need no extra
  wiring — just refresh the app.
