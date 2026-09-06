# API guide

Base path `/api`. Interactive schemas: `/docs`. OpenAPI: `/openapi.json`.

| Method | Path | Response |
| --- | --- | --- |
| GET | /health | Application liveness; does not contact Yahoo |
| GET | /pairs | All 45 canonical G10 pairs and Yahoo symbols |
| GET | /monitor?lookback=252 | Snapshot, row metrics/quotes, refresh progress |
| GET | /quotes | Latest quote observations, status, metadata |
| GET | /pairs/{pair_id}/history?lookback=252&snapshot_id=... | Exact snapshot row and up to 252 daily chart points |
| POST | /refresh | HTTP 202; current refresh state (deduplicated / throttled) |

`lookback` accepts 63, 126, or 252; invalid values return 422. Pair IDs omit
separators (EURUSD); unknown IDs return 404. An expired or baseline-mismatched
snapshot returns 409. The history endpoint may omit snapshot_id to request the
current snapshot, but clients coordinating rankings and charts should supply it.

Market-data GETs initiate a background refresh when due and immediately return
available data. Initial responses can contain unavailable rows while loading.
Use `refresh.refreshing`, `completed`, and `total` for progress. A manual request
within 60 seconds of the previous attempt returns the current state without a
new fetch; automatic requests have a configurable 120-second minimum.

`MonitorResponse` contains generated_at, source, market_status, expected_session,
lookback, snapshot_id, refresh, and rows. Each row contains:

- pair: canonical direction and provider symbol.
- quote: price, observed_at, retrieved_at, interval, status, reason, fractional
  change, and comparison_date.
- metrics: analytics_as_of, daily_close, baseline, z_score, weekly_z_change,
  daily_return, volatility, status, reason, and observation count.
- daily_retrieved_at, daily_timezone, daily_error, and a 30-session score sparkline.

Unavailable numerical values are null. Intraday timestamps are UTC. Daily chart
points use provider session dates. Generated time, source observation time, and
retrieval time have different meanings; clients must preserve that distinction.

`GET /quotes` returns a quotes array with pair_id and the quote fields above.
`POST /refresh` returns the same RefreshState shape nested in monitor responses.
Errors for individual providers preserve other rows. Source failures do not turn
into HTTP 500 responses unless the application itself fails.

The default application is local and uses one worker. Refresh locks, progress,
and snapshot retention are in process. The disk cache stores normalized data
and survives restarts; snapshot IDs do not. No authentication, execution, or
server-side watchlist endpoints are included. The browser stores its watchlist.
