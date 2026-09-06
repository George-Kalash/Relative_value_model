from typing import Protocol

from app.domain.market_data import BarInterval, RawHistory
from app.domain.pairs import CurrencyPair


class MarketDataUnavailable(RuntimeError):
    """The provider did not return usable data for a request."""


class MarketDataProvider(Protocol):
    def history(
        self, pair: CurrencyPair, *, period: str = "5y", interval: BarInterval = "1d"
    ) -> RawHistory: ...
