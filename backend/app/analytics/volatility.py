import numpy as np
import pandas as pd


def realized_volatility(closes: pd.Series) -> pd.Series:
    return np.log(closes).diff().rolling(20, min_periods=20).std(ddof=1) * np.sqrt(252)
