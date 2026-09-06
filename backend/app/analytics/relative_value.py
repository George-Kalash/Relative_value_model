"""Daily descriptive statistics. Missing sessions break rolling windows."""

from datetime import date

import numpy as np
import pandas as pd

from app.analytics.volatility import realized_volatility
from app.domain.schemas import DailyBar, HistoryPoint, Metrics
from app.services.sessions import session_index


def number(value: float) -> float | None:
    return float(value) if pd.notna(value) and np.isfinite(value) else None


def calculate(
    bars: list[DailyBar], lookback: int, cutoff: date
) -> tuple[Metrics, list[HistoryPoint]]:
    if not bars:
        return Metrics(reason="No daily history available."), []
    valid = {pd.Timestamp(b.date): b.close for b in bars if b.date <= cutoff}
    if not valid:
        return Metrics(reason="No finalized daily observations."), []
    raw = pd.Series(valid, dtype=float).sort_index()
    # Retain observed holidays, but do not invent prices for expected sessions.
    index = session_index(raw.index[0].date(), cutoff).union(raw.index)
    prices = raw.reindex(index)
    prices = prices.where((prices > 0) & np.isfinite(prices))
    log = np.log(prices)
    mean = log.rolling(lookback, min_periods=lookback).mean()
    sd = log.rolling(lookback, min_periods=lookback).std(ddof=1)
    baseline = np.exp(mean)
    z = ((log - mean) / sd).where(sd > 1e-12)
    vol = realized_volatility(prices)
    change = prices.pct_change(fill_method=None)
    recent = prices.tail(lookback)
    if pd.isna(prices.iloc[-1]):
        status, reason = "stale", f"No valid daily close for expected session {cutoff}."
    elif len(prices) < lookback:
        status, reason = "insufficient_history", f"Need {lookback} sessions; have {len(prices)}."
    elif recent.isna().any():
        status, reason = (
            "missing_sessions",
            f"{int(recent.isna().sum())} missing or invalid closes in the baseline window.",
        )
    elif pd.isna(z.iloc[-1]):
        status, reason = "zero_variance", "Baseline variance is zero or too small to standardize."
    else:
        status, reason = "eligible", None
    metrics = Metrics(
        analytics_as_of=cutoff,
        daily_close=number(prices.iloc[-1]),
        baseline=number(baseline.iloc[-1]),
        z_score=number(z.iloc[-1]),
        weekly_z_change=number((z - z.shift(5)).iloc[-1]),
        daily_return=number(change.iloc[-1]),
        volatility=number(vol.iloc[-1]),
        status=status,
        reason=reason,
        observations=int(prices.notna().sum()),
    )
    points = [
        HistoryPoint(
            date=d.date(),
            close=number(prices.loc[d]),
            baseline=number(baseline.loc[d]),
            z_score=number(z.loc[d]),
        )
        for d in prices.index[-252:]
    ]
    return metrics, points
