# G10 Relative-Value Monitor

A local FX research dashboard for scanning historical price deviations across
45 unique G10 currency pairs. It combines daily relative-value statistics with
separately timestamped latest available quotes from Yahoo Finance via yfinance.

## Features

- Sortable pair ranking: latest one-minute close, daily quote change, daily
  log-price z-score, five-session z-score change, and annualized 20-day volatility.
- 63-, 126-, and 252-session baselines; currency filter and pair search.
- Pair explorer with daily close / geometric baseline and z-score charts;
  3M, 6M, and 1Y display ranges (63, 126, and 252 sessions).
- Local watchlist, CSV export of the filtered view, and methodology dialog.
- Manual refresh and automatic polling; explicit stale, unavailable, incomplete,
  and missing-session states. Failed requests retain previously fetched data.
- Persistent local market cache, bounded provider concurrency, retries,
  refresh deduplication, and versioned API snapshots.
- Responsive layout and keyboard-operable controls.

**Coverage observed September 6, 2026:** 43 pairs had eligible 252-session daily
history. NZD/NOK and NZD/SEK had no usable daily history. Intraday availability
and freshness vary independently; missing crosses remain visible without
synthetic replacements.

## Quick start

Requires Python 3.11+ and Node.js 22.12+ (or Node 20.19+). From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -c backend/requirements.lock -e './backend[dev]'
npm --prefix frontend ci
.venv/bin/python scripts/dev.py
```

Open **http://127.0.0.1:5173**. API documentation is at
http://127.0.0.1:8000/docs. Ctrl+C stops both development servers. The first visit
requests the data universe; subsequent visits can display the local cache while
refreshing. No Yahoo API key is required for this adapter.

To run the processes separately:

```bash
# Terminal 1
.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload --port 8000
# Terminal 2
npm --prefix frontend run dev
```

For a single local server serving a production frontend build:

```bash
npm --prefix frontend run build
.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 after starting that server. Build before starting the
API so it mounts the frontend. Run one API worker: refresh locks and retained
snapshots are process-local. The application is intended for local research;
public deployment and authentication are outside this version.

## Configuration

Optional settings live in `backend/.env` (copy `backend/.env.example`). Defaults:

| Setting | Default | Meaning |
| --- | --- | --- |
| G10_YFINANCE_TIMEOUT_SECONDS | 10 | Timeout per provider request |
| G10_REFRESH_SECONDS | 120 | Minimum automatic refresh interval |
| G10_HISTORY_TTL_SECONDS | 3600 | Daily-history cache lifetime |
| G10_CACHE_DIR | data/cache under this repository | Local normalized observations |

Manual refresh has a 60-second cooldown. Daily history is fetched again after
its TTL or when the expected daily session advances. The browser polls every
30 seconds while auto refresh is enabled and every three seconds while a refresh
is running. Auto refresh controls this tab's polling, not other connected tabs.
Data requests can initiate a refresh when due; the API does not run unattended
jobs when unused.

## Verification

```bash
.venv/bin/python -m pytest backend/tests -q
.venv/bin/ruff check backend scripts
npm --prefix frontend run build
```

Browser integration checks require both development servers and Yahoo access or
a populated local cache:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

The backend tests are offline and use explicit fixtures. Browser checks cover
real-source rendering, filters, sorting, pair selection, baseline changes,
watchlist persistence, export, refresh, methodology, mobile overflow, and outage
handling. `scripts/probe_yfinance.py` is an optional manual EUR/USD source probe.

## Project map

```text
backend/app/
  api/           HTTP endpoints and input validation
  core/          Environment configuration
  domain/        G10 registry and typed data/response schemas
  providers/     yfinance adapter and provider interface
  services/      Session policy, normalization, cache, refresh, snapshots
  analytics/     Pure daily statistics
backend/tests/   Offline financial, provider, cache, and API checks
frontend/src/
  components/    Application shell
  features/monitor/  Ranking, pair charts, filters, watchlist, methodology
  lib/           HTTP client and value formatting
  types/         TypeScript API contracts
  styles/        Responsive dashboard styling
frontend/e2e/    Browser integration checks
docs/           Methodology, sources, API, chart contract, delivery notes
scripts/        Development launcher and source probe
data/cache/     Ignored normalized provider data; schema versioned
```

Read the [methodology](docs/METHODOLOGY.md), [data-source policy](docs/DATA_SOURCES.md),
[API guide](docs/API.md), and [delivery notes](docs/PROJECT_PLAN.md).

Historical price deviations do not establish economic fair value or promise
mean reversion. Quotes are latest available observations, not executable prices
or a guaranteed real-time feed. Observation times and retrieval times are shown
separately in the pair explorer.
