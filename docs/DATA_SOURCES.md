# Market-data source and coverage

[yfinance](https://ranaroussi.github.io/yfinance/) accesses Yahoo Finance FX
observations through its [Ticker.history interface](https://ranaroussi.github.io/yfinance/reference/api/yfinance.Ticker.history.html).
The project requests five years of daily history and five days of one-minute
bars per pair. Both use unadjusted prices (`auto_adjust=False`) with corporate
actions disabled. Intraday data has limited provider retention; see the
[download reference](https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html).

All 45 unordered G10 pairs have one canonical direction, defined by
`backend/app/domain/pairs.py`. USD-base pairs use Yahoo's aliases (JPY=X,
CHF=X, CAD=X, NOK=X, SEK=X). Other pairs use BASEQUOTE=X. Pair symbols are
requested directly. No inverse or synthetic cross is substituted when a request
fails.

## Observed coverage

A full scan on September 6, 2026 returned eligible 252-session daily statistics
for 43 pairs. NZD/NOK returned no finalized daily rows, while NZD/SEK failed to
return usable daily history. One-minute quotes were available for 44 pairs;
their observation timestamps were stale relative to the weekly session clock at
the time checked. Availability is evaluated on every refresh, not hardcoded.

EUR/USD provider metadata reported Europe/London daily timestamps and regular
sessions from local 00:00 through 23:59. An additional Sunday daily row appeared
in the source response; the monitor excludes weekend daily rows and today's
partial row under its explicit finalization policy. This verifies access and
observed metadata, not a guarantee of provider accuracy or finality.

## Storage and failures

Normalized daily closes, session timezone, latest minute observation, retrieval
times, and error fields are stored in `data/cache/market-v1.json`. The cache is
ignored by Git and written by atomic replacement. Invalid/unreadable cache files
are ignored. It is a restart cache, not an immutable archive of all source bars.

Automatic refresh is request-driven with a 120-second default minimum. Daily
history has a one-hour TTL and is also renewed when the expected session changes.
Manual refresh has a 60-second cooldown. Four workers bound concurrency; each
provider call has a configurable timeout and one retry after a short backoff.

A failed request retains previously fetched observations and marks the failure.
Missing prices are never replaced by zeros or demonstrations. Daily analytics
and quote freshness are independently evaluated. The UI shows the observation
time and source retrieval time separately. All quote times display in UTC;
daily chart dates preserve their provider session labels.

## Use and interpretation

yfinance's documentation describes it as unaffiliated with Yahoo and intended
for research and education, and points to Yahoo's data-use terms. This is a
local personal research application. It has no streaming, execution, or
real-time-delivery guarantee. The label is "latest available", with actual
freshness shown per pair. The weekly session/holiday policy and statistical
limitations are documented in METHODOLOGY.md and the in-app methodology dialog.
