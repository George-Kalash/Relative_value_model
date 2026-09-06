from itertools import combinations

from pydantic import BaseModel, ConfigDict

# Canonical quote direction; one representation per unordered currency pair.
G10_CURRENCIES = ("EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "NOK", "SEK", "JPY")


class CurrencyPair(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str
    label: str
    base: str
    quote: str
    yahoo_symbol: str


PAIRS = tuple(
    CurrencyPair(
        id=f"{base}{quote}",
        label=f"{base}/{quote}",
        base=base,
        quote=quote,
        yahoo_symbol=f"{quote}=X" if base == "USD" else f"{base}{quote}=X",
    )
    for base, quote in combinations(G10_CURRENCIES, 2)
)
PAIR_MAP = {pair.id: pair for pair in PAIRS}
SEED_PAIRS = tuple(pair for pair in PAIRS if "USD" in (pair.base, pair.quote))
