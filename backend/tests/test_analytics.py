from datetime import date

import numpy as np
import pytest

from app.analytics.relative_value import calculate
from app.domain.schemas import DailyBar
from app.services.sessions import session_index


def bars(n=300):
    dates = session_index(date(2025, 1, 2), date(2026, 7, 1))[:n]
    x = 0.05 + np.arange(n) * 0.0003 + np.sin(np.arange(n) / 9) * 0.006
    return [DailyBar(date=d.date(), close=float(np.exp(v))) for d, v in zip(dates, x)], x


def test_statistics_against_independent_numpy_calculation():
    values, logs = bars()
    result, points = calculate(values, 63, values[-1].date)
    current = (logs[-1] - logs[-63:].mean()) / logs[-63:].std(ddof=1)
    prior = (logs[-6] - logs[-68:-5].mean()) / logs[-68:-5].std(ddof=1)
    assert result.status == "eligible"
    assert result.z_score == pytest.approx(current)
    assert result.baseline == pytest.approx(np.exp(logs[-63:].mean()))
    assert result.weekly_z_change == pytest.approx(current - prior)
    assert result.volatility == pytest.approx(np.diff(logs)[-20:].std(ddof=1) * np.sqrt(252))
    assert result.daily_return == pytest.approx(np.exp(logs[-1] - logs[-2]) - 1)
    assert points[-1].z_score == result.z_score


def test_cutoff_prevents_future_observation_leakage():
    values, _ = bars()
    cutoff = values[-10].date
    full = calculate(values, 63, cutoff)
    trimmed = calculate(values[:-9], 63, cutoff)
    assert full == trimmed


@pytest.mark.parametrize("bad", [None, 0, -2, float("nan"), float("inf")])
def test_invalid_price_breaks_window_without_filling(bad):
    values, _ = bars()
    values[-12].close = bad
    result, points = calculate(values, 63, values[-1].date)
    assert result.status == "missing_sessions"
    assert result.z_score is None
    assert result.volatility is None
    assert points[-12].close is None


def test_missing_session_is_explicit_gap():
    values, _ = bars()
    missing = values.pop(-8).date
    result, points = calculate(values, 63, values[-1].date)
    assert result.status == "missing_sessions"
    assert next(p for p in points if p.date == missing).close is None


def test_zero_variance_and_warmup():
    values, _ = bars(70)
    for value in values:
        value.close = 1.2
    result, _ = calculate(values, 63, values[-1].date)
    assert result.status == "zero_variance"
    assert result.z_score is None
    result, _ = calculate(values[:20], 63, values[19].date)
    assert result.status == "insufficient_history"
    assert result.weekly_z_change is None


def test_stale_series_is_not_rankable():
    values, _ = bars()
    cutoff = values.pop().date
    result, points = calculate(values, 63, cutoff)
    assert result.status == "stale"
    assert result.z_score is None
    assert points[-1].date == cutoff and points[-1].close is None
