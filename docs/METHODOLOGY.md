# Metric definitions

Implemented in `backend/app/analytics/relative_value.py` and `volatility.py`.

## Direction and daily observations

BASE/QUOTE is units of QUOTE per one unit of BASE. Each unordered G10 pair has
one orientation, defined by the registry. A positive z-score means BASE/QUOTE
is above its own historical baseline.

Daily observations are finalized using their source timezone: a provider-local
calendar day is eligible one hour after its following midnight. Current-day
and weekend daily rows are excluded. This is a conservative operational policy,
not a certified FX fixing or a claim that Yahoo will never revise a past bar.
Yahoo EUR/USD metadata observed September 6, 2026 reported Europe/London and a
regular session from local 00:00 through 23:59. Other pairs retain their returned
timezone; timezone-naive responses fail normalization.

Expected sessions are weekdays excluding January 1 and December 25. Observed
weekday holiday rows, when supplied, are retained. The policy is deliberately
conservative and does not implement every global market holiday. Unrecognized
closures can appear as missing data. Source history contained Easter gaps in
2025; those gaps remain visible rather than being filled.

Rows are sorted and deduplicated (last observation wins). Nonpositive or
nonfinite prices become missing. Expected but absent sessions are represented
as gaps; no forward filling is applied. Missing sessions invalidate rolling
windows until sufficient contiguous valid observations are available again.

## Calculations

Let x_t = ln(P_t), using the finalized daily close. Default N = 252 observations,
with 63 and 126 alternatives. Include t in its own baseline window.

| Metric | Definition | Display |
| --- | --- | --- |
| Baseline | exp(mean(x over trailing N sessions)) | Daily price overlay |
| Daily z-score | (x_t − mean(x)) / sample_std(x), ddof=1 | Signed standard deviations |
| Five-session z-score change | z_t − z_(t−5), rolling N at each date | Z-score units |
| Daily close return | P_t / P_(t−1) − 1 | API fraction |
| Quote change | Latest completed minute close / prior provider-day close − 1 | Percentage |
| Realized volatility | sample_std(diff(ln(P)) over 20 daily returns) × sqrt(252) | Annualized percentage |

The quote return uses the quote's date in the daily provider timezone, not the
current wall-clock date or latest available daily row. The denominator must be
the previous expected session; missing references produce null.

Z-score requires N valid consecutive session observations. Five-session change
requires N+5. Volatility requires 21 closes (20 returns). Zero/near-zero baseline
standard deviation (≤1e−12), incomplete history, and broken windows yield null
with an explanation. Metrics with independently complete windows can still be
shown, such as volatility when the longer baseline has a gap.

The ranking defaults to descending absolute z-score, with pair ID tie-breaking.
Ineligible scores appear after eligible scores, with a reason rather than zero.
Chart history contains up to 252 sessions after calculating on up to five years
of source history for warm-up. No future observations enter a calculation.

## Quotes, freshness, and consistency

A quote is the close of the latest positive, finite, timezone-aware one-minute
bar whose full minute has ended. It is not a bid/ask spread or a live tick.
Daily charts never append intraday quote candidates.

The weekly session is Sunday 17:00 to Friday 17:00 in America/New_York,
including DST. During that session, quotes older than 15 minutes are stale.
During weekend closure, an observation within eight hours before the latest
Friday 17:00 close or later is labelled closed; older observations are stale.
This weekly convention is not a complete holiday calendar.

A failed quote refresh retains cached observations with stale/unavailable status
and the failure reason. Daily refresh failures retain history and show a warning;
existing daily statistics remain eligible only if their expected-session window
is complete. A fresh fetch never resets the source observation time.

Ranking and detail share an immutable snapshot ID, baseline, and daily cutoff.
The API retains 12 recent snapshots; expired details return HTTP 409 so the UI can
reload. All percentage values are fractions in JSON. No metric uses a silent
sample, zero, derived cross, or filled price to replace unavailable source data.

## Interpretation

These are descriptive historical statistics. Trending price levels and changing
regimes can produce persistent z-scores. ±2σ is only a reference line, not a
probability, expected return, trading recommendation, or reversal threshold.
Pairs share currency exposures and are correlated. Carry, interest rates, macro
valuation, transaction costs, and execution are outside this model.
