from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.pairs import CurrencyPair


class DailyBar(BaseModel):
    date: date
    close: float | None


class Quote(BaseModel):
    price: float | None = None
    observed_at: datetime | None = None
    retrieved_at: datetime | None = None
    interval: Literal["1m"] = "1m"
    status: Literal["available", "closed", "stale", "unavailable"] = "unavailable"
    reason: str | None = None
    change: float | None = None
    comparison_date: date | None = None


class PairData(BaseModel):
    bars: list[DailyBar] = Field(default_factory=list)
    daily_retrieved_at: datetime | None = None
    daily_timezone: str | None = None
    quote: Quote = Field(default_factory=Quote)
    daily_error: str | None = None
    quote_error: str | None = None


class HistoryPoint(BaseModel):
    date: date
    close: float | None
    baseline: float | None
    z_score: float | None


class Metrics(BaseModel):
    analytics_as_of: date | None = None
    daily_close: float | None = None
    baseline: float | None = None
    z_score: float | None = None
    weekly_z_change: float | None = None
    daily_return: float | None = None
    volatility: float | None = None
    status: str = "unavailable"
    reason: str | None = None
    observations: int = 0


class MonitorRow(BaseModel):
    pair: CurrencyPair
    quote: Quote
    metrics: Metrics
    daily_retrieved_at: datetime | None = None
    daily_timezone: str | None = None
    daily_error: str | None = None
    sparkline: list[float | None] = Field(default_factory=list)


class RefreshState(BaseModel):
    refreshing: bool
    completed: int
    total: int
    last_attempt: datetime | None
    last_completed: datetime | None
    error: str | None = None


class MonitorResponse(BaseModel):
    snapshot_id: str
    generated_at: datetime
    source: str = "Yahoo Finance via yfinance"
    lookback: int
    market_status: str
    expected_session: date
    rows: list[MonitorRow]
    refresh: RefreshState


class HistoryResponse(BaseModel):
    snapshot_id: str
    lookback: int
    row: MonitorRow
    points: list[HistoryPoint]
