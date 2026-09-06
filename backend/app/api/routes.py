from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.domain.pairs import PAIR_MAP, PAIRS, CurrencyPair
from app.domain.schemas import HistoryResponse, MonitorResponse, RefreshState
from app.services.monitor import MonitorService

router = APIRouter()


def service(request: Request) -> MonitorService:
    return request.app.state.monitor


def baseline(lookback: int = Query(default=252)) -> int:
    if lookback not in (63, 126, 252):
        raise HTTPException(422, "lookback must be 63, 126, or 252 sessions")
    return lookback


Service = Annotated[MonitorService, Depends(service)]
Baseline = Annotated[int, Depends(baseline)]


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "stage": "ready"}


@router.get("/pairs", response_model=list[CurrencyPair], tags=["universe"])
def pairs() -> list[CurrencyPair]:
    return list(PAIRS)


@router.get("/monitor", response_model=MonitorResponse, tags=["monitor"])
def monitor(svc: Service, lookback: Baseline) -> MonitorResponse:
    svc.market.request_refresh()
    return svc.monitor(lookback)


@router.get("/quotes", tags=["market data"])
def quotes(svc: Service):
    svc.market.request_refresh()
    snapshot = svc.monitor(252)
    return {
        "snapshot_id": snapshot.snapshot_id,
        "generated_at": snapshot.generated_at,
        "market_status": snapshot.market_status,
        "refresh": snapshot.refresh,
        "quotes": [{"pair_id": r.pair.id, **r.quote.model_dump()} for r in snapshot.rows],
    }


@router.get("/pairs/{pair_id}/history", response_model=HistoryResponse, tags=["market data"])
def history(
    pair_id: str,
    svc: Service,
    lookback: Baseline,
    snapshot_id: str | None = Query(default=None, max_length=64),
) -> HistoryResponse:
    if pair_id not in PAIR_MAP:
        raise HTTPException(404, "Unknown G10 pair")
    svc.market.request_refresh()
    try:
        return svc.history(pair_id, lookback, snapshot_id)
    except KeyError as exc:
        raise HTTPException(409, str(exc.args[0])) from exc


@router.post("/refresh", response_model=RefreshState, status_code=202, tags=["market data"])
def refresh(svc: Service) -> RefreshState:
    svc.market.request_refresh(manual=True)
    return svc.market.view()[2]
