"""Snapshot-consistent rankings and pair details with bounded history retention."""

from collections import OrderedDict
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.analytics.relative_value import calculate
from app.domain.schemas import HistoryResponse, MonitorResponse, MonitorRow, PairData
from app.services.market_data import MarketDataService
from app.services.sessions import completed_session, market_open, quote_status


class MonitorService:
    def __init__(self, market: MarketDataService):
        self.market = market
        self.lock = Lock()
        self.snapshots: OrderedDict[str, tuple[MonitorResponse, dict[str, HistoryResponse]]] = (
            OrderedDict()
        )
        self.keys: dict[tuple, str] = {}

    def monitor(self, lookback: int, now: datetime | None = None) -> MonitorResponse:
        now = now or datetime.now(UTC)
        version, data, refresh = self.market.view()
        key = (version, lookback, int(now.timestamp() // 60))
        with self.lock:
            if key in self.keys and self.keys[key] in self.snapshots:
                response = self.snapshots[self.keys[key]][0]
                return response.model_copy(update={"refresh": refresh})
            snapshot_id = uuid4().hex
            rows, histories = [], {}
            for pair in self.market.pairs:
                item = data.get(pair.id, PairData())
                cutoff = completed_session(now, item.daily_timezone or "Europe/London")
                metrics, points = calculate(item.bars, lookback, cutoff)
                quote = item.quote.model_copy(deep=True)
                quote.status, quote.reason = quote_status(quote.observed_at, now)
                if item.quote_error:
                    quote.status = "stale" if quote.price is not None else "unavailable"
                    quote.reason = (
                        f"{item.quote_error} Cached observation retained."
                        if quote.price
                        else item.quote_error
                    )
                if quote.observed_at and quote.price is not None:
                    quote_day = quote.observed_at.astimezone(
                        ZoneInfo(item.daily_timezone or "Europe/London")
                    ).date()
                    prior = next((b for b in reversed(item.bars) if b.date < quote_day), None)
                    if prior and prior.close is not None and prior.close > 0:
                        # Require the prior expected session; never bridge a missing close.
                        prior_expected = completed_session(
                            datetime.combine(
                                quote_day,
                                datetime.min.time(),
                                ZoneInfo(item.daily_timezone or "Europe/London"),
                            ).replace(hour=12),
                            item.daily_timezone or "Europe/London",
                        )
                        if prior.date == prior_expected:
                            quote.change = quote.price / prior.close - 1
                            quote.comparison_date = prior.date
                row = MonitorRow(
                    pair=pair,
                    quote=quote,
                    metrics=metrics,
                    daily_retrieved_at=item.daily_retrieved_at,
                    daily_timezone=item.daily_timezone,
                    daily_error=item.daily_error,
                    sparkline=[p.z_score for p in points[-30:]],
                )
                rows.append(row)
                histories[pair.id] = HistoryResponse(
                    snapshot_id=snapshot_id, lookback=lookback, row=row, points=points
                )
            rows.sort(
                key=lambda r: (
                    r.metrics.status != "eligible",
                    -abs(r.metrics.z_score) if r.metrics.z_score is not None else 0,
                    r.pair.id,
                )
            )
            response = MonitorResponse(
                snapshot_id=snapshot_id,
                generated_at=now,
                lookback=lookback,
                market_status="open" if market_open(now) else "closed",
                expected_session=completed_session(now),
                rows=rows,
                refresh=refresh,
            )
            self.snapshots[snapshot_id] = response, histories
            self.keys[key] = snapshot_id
            while len(self.snapshots) > 12:
                expired, _ = self.snapshots.popitem(last=False)
                self.keys = {k: v for k, v in self.keys.items() if v != expired}
            return response

    def history(self, pair_id: str, lookback: int, snapshot_id: str | None) -> HistoryResponse:
        if snapshot_id is None:
            snapshot_id = self.monitor(lookback).snapshot_id
        with self.lock:
            if snapshot_id not in self.snapshots:
                raise KeyError("Snapshot expired. Reload the monitor.")
            response, histories = self.snapshots[snapshot_id]
            if response.lookback != lookback:
                raise KeyError("Snapshot uses a different baseline. Reload the monitor.")
            return histories[pair_id]
