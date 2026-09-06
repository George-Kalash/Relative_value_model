export type Lookback = 63 | 126 | 252;
export interface CurrencyPair {
  id: string;
  label: string;
  base: string;
  quote: string;
  yahoo_symbol: string;
}
export interface Quote {
  price: number | null;
  observed_at: string | null;
  retrieved_at: string | null;
  status: "available" | "closed" | "stale" | "unavailable";
  reason: string | null;
  change: number | null;
  comparison_date: string | null;
  interval: "1m";
}
export interface Metrics {
  analytics_as_of: string | null;
  daily_close: number | null;
  baseline: number | null;
  z_score: number | null;
  weekly_z_change: number | null;
  daily_return: number | null;
  volatility: number | null;
  status: string;
  reason: string | null;
  observations: number;
}
export interface MonitorRow {
  pair: CurrencyPair;
  quote: Quote;
  metrics: Metrics;
  daily_retrieved_at: string | null;
  daily_timezone: string | null;
  daily_error: string | null;
  sparkline: (number | null)[];
}
export interface RefreshState {
  refreshing: boolean;
  completed: number;
  total: number;
  last_attempt: string | null;
  last_completed: string | null;
  error: string | null;
}
export interface MonitorResponse {
  snapshot_id: string;
  generated_at: string;
  source: string;
  lookback: Lookback;
  market_status: "open" | "closed";
  expected_session: string;
  rows: MonitorRow[];
  refresh: RefreshState;
}
export interface HistoryPoint {
  date: string;
  close: number | null;
  baseline: number | null;
  z_score: number | null;
}
export interface HistoryResponse {
  snapshot_id: string;
  lookback: Lookback;
  row: MonitorRow;
  points: HistoryPoint[];
}
