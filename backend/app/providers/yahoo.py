from datetime import UTC, datetime

import yfinance as yf

from app.core.config import settings
from app.domain.market_data import BarInterval, RawHistory
from app.domain.pairs import CurrencyPair
from app.providers.base import MarketDataUnavailable


class YahooFinanceProvider:
    """Yahoo download adapter; the service owns normalization, retries, and caching."""

    def history(
        self, pair: CurrencyPair, *, period: str = "5y", interval: BarInterval = "1d"
    ) -> RawHistory:
        try:
            bars = yf.Ticker(pair.yahoo_symbol).history(
                period=period,
                interval=interval,
                auto_adjust=False,
                actions=False,
                timeout=settings.yfinance_timeout_seconds,
                raise_errors=True,
            )
        except Exception as exc:
            raise MarketDataUnavailable(f"Yahoo request failed for {pair.id}") from exc

        if bars.empty or "Close" not in bars or bars["Close"].dropna().empty:
            raise MarketDataUnavailable(f"Yahoo returned no close observations for {pair.id}")

        return RawHistory(
            pair_id=pair.id,
            provider_symbol=pair.yahoo_symbol,
            source="Yahoo Finance via yfinance",
            interval=interval,
            retrieved_at=datetime.now(UTC),
            bars=bars,
        )
