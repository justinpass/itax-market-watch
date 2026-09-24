# ITAX Market Watch

A low-maintenance international tax intelligence dashboard inspired by a financial-market terminal. It converts tax developments into topic signals, business implications and client questions.

## What is included

- Next.js 16 / React 19 responsive interface
- FastAPI backend under `/api/*`
- 16 configurable tax topics across four business segments
- Topic momentum cards and sparklines
- Personal watchlist stored in browser local storage
- Official-source development cards
- Analyst-note / meeting-agenda workflow
- Configurable official-source collector
- GitHub Actions refresh every six hours
- Vercel-compatible single-project layout

The UI does **not** treat tax signals as financial prices. `RISING`, `WATCH`, `STEADY` and `OPPORTUNITY` describe regulatory activity and advisory relevance.

## Project structure

```text
itax-market-watch/
├── frontend/
│   ├── app/                     # Next.js interface
│   └── data/market.json         # MVP market data
├── backend/main.py              # FastAPI service entrypoint for Vercel
├── config/
│   ├── sources.json             # Add/remove official sources here
│   └── topic_keywords.json      # Rule-based topic classification
├── scripts/refresh_news.py      # Scheduled collector
├── tests/test_api.py
└── .github/workflows/
    └── refresh-tax-news.yml
```

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

From `frontend/`, the UI is available at `http://localhost:3000`.

### FastAPI only

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
cd backend
pip install -e .
fastapi dev main.py
```

Then test `http://localhost:8000/health`. Vercel mounts this service at `/api`, so production uses `/api/health`.

### Vercel-style combined development

This repo uses Vercel Services: Next.js at `/` and FastAPI mounted at `/api`. After installing the Vercel CLI and linking the project:

```bash
vercel link
vercel dev
```

Then `/api/*` is routed to FastAPI on the same origin.

## Data refresh

Run manually:

```bash
pip install httpx beautifulsoup4 feedparser
python scripts/refresh_news.py
```

The collector:

1. reads `config/sources.json`;
2. gathers items from configured official sources;
3. classifies topics using `config/topic_keywords.json`;
4. creates deterministic business-impact prompts;
5. merges and deduplicates items into `frontend/data/market.json`.

No database and no AI API key are required for the MVP.

### Why GitHub Actions rather than a database?

For a small internal intelligence dashboard this makes maintenance materially easier:

- one repository;
- no persistent backend to operate;
- no database credentials;
- full history of data changes in Git;
- Vercel redeploys automatically after a scheduled data commit.

When the dataset or user count grows, replace `data/market.json` with Postgres/Supabase without changing the visual components.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Keep the detected Next.js settings.
4. Deploy.

`vercel.json` defines the two Vercel Services. In Vercel Project Settings, set the Framework Preset to **Services** before deploying.

For CLI deployment after linking:

```bash
vercel deploy --prod
```

## Configuration

### Add a topic keyword

Edit `config/topic_keywords.json`.

### Add an official source

Edit `config/sources.json` and choose one of:

- `rss`: Atom/RSS feed
- `html_links`: authority page whose article links share a stable path fragment

Example:

```json
{
  "name": "Authority name",
  "jurisdiction": "Country",
  "type": "html_links",
  "url": "https://authority.example/news",
  "link_contains": "/news/",
  "enabled": true
}
```

The scraper is deliberately small. If a source changes HTML, update the source configuration or extraction helper rather than the frontend.

## Next production upgrades

Recommended after the MVP is approved:

- Microsoft Entra ID / SSO
- Postgres/Supabase persistence for analyst notes and multi-user portfolios
- Azure OpenAI or OpenAI structured summaries behind a feature flag
- source-specific collectors for high-priority jurisdictions
- email/Teams alerts for high-materiality changes
- source-health monitoring and stale-feed warnings
- audit log for generated analyst notes

## Disclaimer

This dashboard is an information-monitoring tool, not tax advice. Important developments should be verified against the underlying authority publication before client use.
