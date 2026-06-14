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
```

## HTTP API

| Method | Path                 | Body / Notes                                  |
| ------ | -------------------- | --------------------------------------------- |
| POST   | `/api/scrape`        | `{ "term": "bacalhau", "maxPages": 20 }` → `{ jobId }` |
| GET    | `/api/scrape/:jobId` | Job status, live log and result               |
| GET    | `/api/recipes`       | Counts per saved recipe file                  |

## Notes

- The Pingo Doce site uses bot protection. Running from your own machine /
  server (a real outbound IP) generally works; sandboxes with an egress
  allow-list or aggressive WAFs may receive `HTTP 403` — the job log reports
  this clearly.
- After a scrape, new recipes appear in the app automatically: any
  `src/data/recipes*.json` file is picked up by `PlannerContext.jsx` via
  `import.meta.glob`, so new terms (e.g. `recipes-bacalhau.json`) need no extra
  wiring — just refresh the app.
