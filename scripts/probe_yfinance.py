"""Manually check EUR/USD daily and intraday access without claiming freshness."""

from app.domain.pairs import SEED_PAIRS
from app.providers.base import MarketDataUnavailable
from app.providers.yahoo import YahooFinanceProvider


def main() -> None:
    provider = YahooFinanceProvider()
    pair = SEED_PAIRS[0]
    for interval, period in (("1d", "1mo"), ("1m", "5d")):
        try:
            result = provider.history(pair, period=period, interval=interval)
        except MarketDataUnavailable as exc:
            raise SystemExit(str(exc)) from exc
        closes = result.bars["Close"].dropna().sort_index()
        print(
            f"{pair.label} | interval={interval} | rows={len(closes)} | "
            f"last_bar={closes.index[-1]} | close={closes.iloc[-1]:.6f} | "
            f"retrieved_at={result.retrieved_at.isoformat()}"
        )
    print(
        "Raw provider observations only; session completion and freshness are not validated."
    )


if __name__ == "__main__":
    main()
