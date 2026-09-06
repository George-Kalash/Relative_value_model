"""Thread-safe refresh with bounded concurrency and an atomic local cache."""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock, Thread
from time import sleep

from pydantic import ValidationError

from app.core.config import settings
from app.domain.pairs import PAIRS, CurrencyPair
from app.domain.schemas import PairData, RefreshState
from app.providers.base import MarketDataProvider, MarketDataUnavailable
from app.providers.yahoo import YahooFinanceProvider
from app.services.normalization import normalize_daily, normalize_quote
from app.services.sessions import completed_session

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(
        self,
        provider: MarketDataProvider | None = None,
        cache_dir: Path | None = None,
        pairs: tuple[CurrencyPair, ...] = PAIRS,
    ):
        self.provider = provider or YahooFinanceProvider()
        self.cache_dir = cache_dir if cache_dir is not None else settings.cache_dir
        self.pairs = pairs
        self.lock = Lock()
        self.data: dict[str, PairData] = {}
        self.version = 0
        self.refreshing = False
        self.completed = 0
        self.last_attempt: datetime | None = None
        self.last_completed: datetime | None = None
        self.error: str | None = None
        self.worker: Thread | None = None
        self._load()

    def _load(self) -> None:
        try:
            payload = json.loads((self.cache_dir / "market-v1.json").read_text())
            if payload.get("schema") != 1:
                return
            data = {
                key: PairData.model_validate(value)
                for key, value in payload["pairs"].items()
                if key in {p.id for p in self.pairs}
            }
            self.data = data
            self.version = 1
        except FileNotFoundError:
            pass
        except (OSError, ValueError, KeyError, TypeError, ValidationError):
            logger.warning("Ignoring unreadable market cache", exc_info=True)

    def _save(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        with self.lock:
            payload = {
                "schema": 1,
                "pairs": {k: v.model_dump(mode="json") for k, v in self.data.items()},
            }
        temporary = self.cache_dir / "market-v1.tmp"
        temporary.write_text(json.dumps(payload, allow_nan=False))
        temporary.replace(self.cache_dir / "market-v1.json")

    def view(self) -> tuple[int, dict[str, PairData], RefreshState]:
        with self.lock:
            return (
                self.version,
                dict(self.data),
                RefreshState(
                    refreshing=self.refreshing,
                    completed=self.completed,
                    total=len(self.pairs),
                    last_attempt=self.last_attempt,
                    last_completed=self.last_completed,
                    error=self.error,
                ),
            )

    def request_refresh(self, manual: bool = False) -> bool:
        now = datetime.now(UTC)
        with self.lock:
            minimum = 60 if manual else settings.refresh_seconds
            if self.refreshing or (
                self.last_attempt and (now - self.last_attempt).total_seconds() < minimum
            ):
                return False
            self.refreshing, self.completed, self.last_attempt, self.error = True, 0, now, None
            self.worker = Thread(target=self._refresh, name="g10-refresh", daemon=True)
            self.worker.start()
            return True

    def _fetch(self, pair: CurrencyPair, interval: str):
        for attempt in range(2):
            try:
                return self.provider.history(
                    pair, period="5y" if interval == "1d" else "5d", interval=interval
                )
            except MarketDataUnavailable:
                if attempt:
                    raise
                sleep(0.4)

    def _pair(self, pair: CurrencyPair) -> PairData:
        now = datetime.now(UTC)
        with self.lock:
            previous = self.data.get(pair.id, PairData())
        result = previous.model_copy(deep=True)
        daily_age = (
            (now - previous.daily_retrieved_at).total_seconds()
            if previous.daily_retrieved_at
            else float("inf")
        )
        cutoff = completed_session(now, previous.daily_timezone or "Europe/London")
        needs_daily = (
            daily_age >= settings.history_ttl_seconds
            or not previous.bars
            or previous.bars[-1].date < cutoff
        )
        if needs_daily:
            try:
                raw = self._fetch(pair, "1d")
                result.bars, result.daily_timezone = normalize_daily(raw, now)
                result.daily_retrieved_at = raw.retrieved_at
                result.daily_error = None
            except MarketDataUnavailable as exc:
                result.daily_error = str(exc)
        try:
            result.quote = normalize_quote(self._fetch(pair, "1m"), datetime.now(UTC))
            result.quote_error = None
        except MarketDataUnavailable as exc:
            result.quote_error = str(exc)
        return result

    def _refresh(self) -> None:
        try:
            with ThreadPoolExecutor(max_workers=4, thread_name_prefix="yahoo") as pool:
                futures = {pool.submit(self._pair, p): p for p in self.pairs}
                for future in as_completed(futures):
                    pair = futures[future]
                    try:
                        result = future.result()
                    except Exception:
                        logger.exception("Unexpected error refreshing %s", pair.id)
                        with self.lock:
                            result = self.data.get(pair.id, PairData()).model_copy(deep=True)
                        result.daily_error = result.quote_error = (
                            "Unexpected provider error; try refresh again."
                        )
                    with self.lock:
                        self.data[pair.id] = result
                        self.completed += 1
                        self.version += 1
            self._save()
        except Exception:
            logger.exception("Refresh or cache write failed")
            with self.lock:
                self.error = "Refresh or cache write failed; available observations are retained."
        finally:
            with self.lock:
                self.refreshing = False
                self.last_completed = datetime.now(UTC)

    def close(self) -> None:
        if self.worker:
            self.worker.join(timeout=2)
