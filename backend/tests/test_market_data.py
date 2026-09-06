from datetime import UTC, date, datetime, timedelta
from threading import Event

import pandas as pd
import pytest

from app.domain.market_data import RawHistory
from app.domain.pairs import PAIRS, SEED_PAIRS
from app.domain.schemas import DailyBar, PairData, Quote
from app.providers.base import MarketDataUnavailable
from app.services.market_data import MarketDataService
from app.services.normalization import normalize_daily, normalize_quote
from app.services.sessions import completed_session, market_open, quote_status


def raw(dates, values, interval="1d", zone="Europe/London"):
    return RawHistory(
        "EURUSD",
        "EURUSD=X",
        "test",
        interval,
        datetime.now(UTC),
        pd.DataFrame({"Close": values}, index=pd.DatetimeIndex(dates, tz=zone)),
    )


def test_registry_covers_all_unique_g10_pairs():
    assert len(PAIRS) == 45
    assert len({frozenset((p.base, p.quote)) for p in PAIRS}) == 45
    assert len(SEED_PAIRS) == 9


def test_finalization_uses_local_day_buffer_and_skips_weekends():
    now = datetime(2026, 9, 7, 0, 30, tzinfo=UTC)  # 01:30 London Monday
    bars, zone = normalize_daily(
        raw(["2026-09-04", "2026-09-06", "2026-09-07"], [1.1, 1.2, 1.3]), now
    )
    assert zone == "Europe/London"
    assert [b.date for b in bars] == [date(2026, 9, 4)]
    assert completed_session(datetime(2026, 9, 8, 0, 0, tzinfo=UTC)) == date(2026, 9, 7)
    assert completed_session(datetime(2026, 9, 7, 23, 30, tzinfo=UTC)) == date(2026, 9, 4)


def test_quote_rejects_future_partial_and_invalid_prices():
    now = datetime(2026, 9, 7, 12, tzinfo=UTC)
    data = raw(
        ["2026-09-07 11:57", "2026-09-07 11:58", "2026-09-07 11:59:30", "2026-09-07 12:01"],
        [1.1, 0, 1.2, 9],
        "1m",
        "UTC",
    )
    result = normalize_quote(data, now)
    assert result.price == 1.1
    assert result.observed_at == datetime(2026, 9, 7, 11, 57, tzinfo=UTC)


def test_naive_timestamps_fail_explicitly():
    data = raw(["2026-09-04"], [1.1], zone=None)
    with pytest.raises(MarketDataUnavailable):
        normalize_daily(data, datetime.now(UTC))


def test_market_hours_follow_new_york_dst_and_stale_weekends():
    assert not market_open(datetime(2026, 9, 6, 20, 59, tzinfo=UTC))
    assert market_open(datetime(2026, 9, 6, 21, 0, tzinfo=UTC))
    assert not market_open(datetime(2026, 1, 4, 21, 59, tzinfo=UTC))
    assert market_open(datetime(2026, 1, 4, 22, 0, tzinfo=UTC))
    saturday = datetime(2026, 9, 5, 12, tzinfo=UTC)
    assert quote_status(datetime(2026, 9, 4, 20, 59, tzinfo=UTC), saturday)[0] == "closed"
    assert quote_status(datetime(2026, 8, 28, 20, 59, tzinfo=UTC), saturday)[0] == "stale"


def test_provider_failure_preserves_cached_observations(tmp_path):
    class Failing:
        def history(self, *args, **kwargs):
            raise MarketDataUnavailable("Provider offline")

    market = MarketDataService(Failing(), tmp_path, (PAIRS[0],))
    original = PairData(
        bars=[DailyBar(date=date(2026, 1, 2), close=1.1)],
        quote=Quote(price=1.2, observed_at=datetime(2026, 1, 2, tzinfo=UTC)),
    )
    market.data[PAIRS[0].id] = original
    result = market._pair(PAIRS[0])
    assert result.bars == original.bars
    assert result.quote.price == original.quote.price
    assert result.daily_error == result.quote_error == "Provider offline"
    assert original.daily_error is None
    market.data[PAIRS[0].id] = result
    market._save()
    restored = MarketDataService(Failing(), tmp_path, (PAIRS[0],))
    assert restored.data[PAIRS[0].id] == result


def test_corrupt_cache_is_ignored(tmp_path):
    (tmp_path / "market-v1.json").write_text("not json")
    assert MarketDataService(cache_dir=tmp_path).data == {}


def test_refresh_is_deduplicated_and_throttled(tmp_path):
    entered, release = Event(), Event()

    class BlockingMarket(MarketDataService):
        def _pair(self, pair):
            entered.set()
            assert release.wait(5)
            return PairData()

    market = BlockingMarket(cache_dir=tmp_path, pairs=(PAIRS[0],))
    try:
        assert market.request_refresh()
        assert entered.wait(2)
        assert not market.request_refresh(manual=True)
    finally:
        release.set()
        market.worker.join(5)
    assert market.view()[2].completed == 1
    assert not market.request_refresh(manual=True)
    market.last_attempt = datetime.now(UTC) - timedelta(minutes=10)
    assert market.request_refresh()
    market.worker.join(5)
