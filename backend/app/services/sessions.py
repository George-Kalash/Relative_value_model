"""Conservative provider-day finalization and an explicit weekly FX calendar."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

LONDON = ZoneInfo("Europe/London")
NEW_YORK = ZoneInfo("America/New_York")


def expected_day(day: date) -> bool:
    # Calendar policy, not a claim of a complete global holiday calendar.
    return day.weekday() < 5 and (day.month, day.day) not in ((1, 1), (12, 25))


def completed_session(now: datetime, zone: str = "Europe/London") -> date:
    # One-hour buffer after local midnight; excludes today's partial daily row.
    local = now.astimezone(ZoneInfo(zone)) - timedelta(hours=1)
    day = local.date() - timedelta(days=1)
    while not expected_day(day):
        day -= timedelta(days=1)
    return day


def session_index(start: date, end: date) -> pd.DatetimeIndex:
    return pd.DatetimeIndex([d for d in pd.date_range(start, end) if expected_day(d.date())])


def market_open(now: datetime) -> bool:
    local = now.astimezone(NEW_YORK)
    weekday = local.weekday()
    return not (
        weekday == 5 or (weekday == 4 and local.hour >= 17) or (weekday == 6 and local.hour < 17)
    )


def quote_status(observed: datetime | None, now: datetime) -> tuple[str, str | None]:
    if observed is None:
        return "unavailable", "No valid intraday observation."
    age = (now - observed).total_seconds()
    if age < -60:
        return "unavailable", "Provider timestamp is in the future."
    if market_open(now):
        if age <= 15 * 60:
            return "available", None
        return "stale", "Latest bar is more than 15 minutes old during the weekly FX session."
    local = now.astimezone(NEW_YORK)
    friday = local.date() - timedelta(days=(local.weekday() - 4) % 7)
    last_close = datetime.combine(friday, time(17), NEW_YORK).astimezone(UTC)
    if observed >= last_close - timedelta(hours=8):
        return "closed", "Weekly FX session closed; showing the last available bar."
    return "stale", "Observation predates the most recent weekly close by more than eight hours."
