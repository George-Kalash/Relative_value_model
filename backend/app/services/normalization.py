from datetime import UTC, datetime

import numpy as np
import pandas as pd

from app.domain.market_data import RawHistory
from app.domain.schemas import DailyBar, Quote
from app.providers.base import MarketDataUnavailable
from app.services.sessions import completed_session


def normalize_daily(raw: RawHistory, now: datetime) -> tuple[list[DailyBar], str]:
    index = raw.bars.index
    if not isinstance(index, pd.DatetimeIndex) or index.tz is None:
        raise MarketDataUnavailable("Daily bars lack a timezone; session finalization is unsafe.")
    zone = str(index.tz)
    cutoff = completed_session(now, zone)
    values = {}
    for stamp, close in raw.bars["Close"].sort_index().items():
        day = stamp.date()
        if day > cutoff or day.weekday() >= 5:
            continue
        values[day] = float(close) if pd.notna(close) and np.isfinite(close) and close > 0 else None
    if not values:
        raise MarketDataUnavailable("No finalized weekday daily bars returned.")
    return [DailyBar(date=d, close=p) for d, p in sorted(values.items())], zone


def normalize_quote(raw: RawHistory, now: datetime) -> Quote:
    if not isinstance(raw.bars.index, pd.DatetimeIndex) or raw.bars.index.tz is None:
        raise MarketDataUnavailable("Intraday bars lack a source timezone.")
    values = raw.bars["Close"].sort_index()
    values = values[~values.index.duplicated(keep="last")]
    values = values[(values > 0) & np.isfinite(values)]
    # A one-minute bar must have ended; future/partial observations are discarded.
    values = values[values.index <= pd.Timestamp(now) - pd.Timedelta(minutes=1)]
    if values.empty:
        raise MarketDataUnavailable("No valid completed one-minute bar available.")
    return Quote(
        price=float(values.iloc[-1]),
        observed_at=values.index[-1].to_pydatetime().astimezone(UTC),
        retrieved_at=raw.retrieved_at,
    )
