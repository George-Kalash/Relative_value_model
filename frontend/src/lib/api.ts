import type {
  HistoryResponse,
  Lookback,
  MonitorResponse,
  RefreshState,
} from "../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  signal?: AbortSignal,
  method = "GET",
): Promise<T> {
  const response = await fetch(`/api${path}`, { signal, method });
  if (!response.ok) {
    throw new ApiError(
      response.status === 409
        ? "This snapshot expired. Refresh the monitor."
        : `Unable to load market data (HTTP ${response.status}).`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export const getMonitor = (lookback: Lookback, signal?: AbortSignal) =>
  request<MonitorResponse>(`/monitor?lookback=${lookback}`, signal);
export const getHistory = (
  pair: string,
  lookback: Lookback,
  snapshot: string,
  signal?: AbortSignal,
) =>
  request<HistoryResponse>(
    `/pairs/${encodeURIComponent(pair)}/history?lookback=${lookback}&snapshot_id=${snapshot}`,
    signal,
  );
export const refreshMarket = (signal?: AbortSignal) =>
  request<RefreshState>("/refresh", signal, "POST");
