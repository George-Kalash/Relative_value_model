from datetime import UTC, date, datetime, timedelta

import numpy as np
from fastapi.testclient import TestClient

from app.domain.pairs import PAIRS
from app.domain.schemas import DailyBar, PairData, Quote
from app.main import app
from app.services.market_data import MarketDataService
from app.services.monitor import MonitorService
from app.services.sessions import completed_session, session_index


def service(tmp_path):
    market = MarketDataService(cache_dir=tmp_path, pairs=(PAIRS[0], PAIRS[1]))
    now = datetime.now(UTC)
    cutoff = completed_session(now)
    days = session_index(cutoff - timedelta(days=500), cutoff)
    bars = [
        DailyBar(date=d.date(), close=float(np.exp(i * 0.001 + 0.02 * np.sin(i))))
        for i, d in enumerate(days)
    ]
    market.data[PAIRS[0].id] = PairData(
        bars=bars,
        daily_retrieved_at=now,
        quote=Quote(price=1.2, observed_at=now - timedelta(minutes=2), retrieved_at=now),
    )
    market.last_attempt = now  # Offline test; no network refresh.
    return MonitorService(market)


def test_api_contracts_partial_coverage_and_snapshot_consistency(tmp_path):
    with TestClient(app) as client:
        app.state.monitor = service(tmp_path)
        assert client.get("/api/health").json()["status"] == "ok"
        assert len(client.get("/api/pairs").json()) == 45
        response = client.get("/api/monitor?lookback=63")
        assert response.status_code == 200
        snapshot = response.json()
        assert snapshot["rows"][0]["metrics"]["status"] == "eligible"
        assert snapshot["rows"][1]["metrics"]["status"] == "unavailable"
        detail = client.get(
            f"/api/pairs/{PAIRS[0].id}/history",
            params={"lookback": 63, "snapshot_id": snapshot["snapshot_id"]},
        ).json()
        assert detail["row"] == snapshot["rows"][0]
        assert detail["points"][-1]["z_score"] == snapshot["rows"][0]["metrics"]["z_score"]
        assert client.get("/api/monitor?lookback=7").status_code == 422
        assert client.get("/api/monitor?lookback=abc").status_code == 422
        assert client.get("/api/pairs/BAD/history").status_code == 404
        assert client.get(f"/api/pairs/{PAIRS[0].id}/history?snapshot_id=old").status_code == 409
        assert (
            client.get(
                f"/api/pairs/{PAIRS[0].id}/history",
                params={"lookback": 252, "snapshot_id": snapshot["snapshot_id"]},
            ).status_code
            == 409
        )
        assert client.post("/api/refresh").status_code == 202
        assert len(client.get("/api/quotes").json()["quotes"]) == 2


def test_quote_change_uses_quote_date_not_latest_daily_row(tmp_path):
    svc = service(tmp_path)
    item = svc.market.data[PAIRS[0].id]
    item.quote = Quote(price=1.5, observed_at=datetime(2026, 9, 4, 15, tzinfo=UTC))
    item.bars = [DailyBar(date=date(2026, 9, d), close=p) for d, p in [(3, 1.25), (4, 1.4)]]
    row = next(
        r
        for r in svc.monitor(63, now=datetime(2026, 9, 5, 12, tzinfo=UTC)).rows
        if r.pair.id == PAIRS[0].id
    )
    assert abs(row.quote.change - 0.2) < 1e-12
    assert row.quote.comparison_date.isoformat() == "2026-09-03"
