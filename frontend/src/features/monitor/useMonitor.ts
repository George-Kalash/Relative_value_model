import { useCallback, useEffect, useState } from "react";
import { getMonitor, refreshMarket } from "../../lib/api";
import type { Lookback, MonitorResponse } from "../../types/api";

export function useMonitor(lookback: Lookback, automatic: boolean) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [requesting, setRequesting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    async function poll() {
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const snapshot = await getMonitor(lookback, controller.signal);
        if (!active) return;
        setData(snapshot);
        setError(null);
        if (snapshot.refresh.refreshing || automatic)
          timer = setTimeout(poll, snapshot.refresh.refreshing ? 3000 : 30000);
      } catch (e) {
        if (!active) return;
        setError(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "The API request timed out. Try again.",
        );
        // A fresh effect creates a fresh AbortController on the next retry.
        if (automatic) timer = setTimeout(() => setReload((v) => v + 1), 15000);
      } finally {
        clearTimeout(timeout);
      }
    }
    void poll();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [lookback, automatic, reload]);

  const refresh = useCallback(async () => {
    setRequesting(true);
    try {
      await refreshMarket(AbortSignal.timeout(20000));
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRequesting(false);
    }
  }, []);
  return {
    data: data?.lookback === lookback ? data : null,
    error,
    refresh,
    requesting,
    retry: () => setReload((v) => v + 1),
  };
}
