from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import pandas as pd

BarInterval = Literal["1d", "1m"]


@dataclass(frozen=True)
class RawHistory:
    """Raw provider bars; session completion and quote freshness are not validated."""

    pair_id: str
    provider_symbol: str
    source: str
    interval: BarInterval
    retrieved_at: datetime
    bars: pd.DataFrame
