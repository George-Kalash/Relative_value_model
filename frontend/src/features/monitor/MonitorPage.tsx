import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowDownUp,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { number, shortDate, timestamp } from "../../lib/format";
import type { Lookback, MonitorRow } from "../../types/api";
import { Methodology } from "./Methodology";
const PairDetail = lazy(() =>
  import("./PairDetail").then((module) => ({ default: module.PairDetail })),
);
import { RankingTable } from "./RankingTable";
import type { SortKey } from "./RankingTable";
import { useMonitor } from "./useMonitor";
import { useWatchlist } from "./Watchlist";

const currencies = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "NOK",
  "SEK",
];
export function MonitorPage() {
  const [lookback, setLookback] = useState<Lookback>(252);
  const [automatic, setAutomatic] = useState(true);
  const [currency, setCurrency] = useState("ALL");
  const [search, setSearch] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>("EURUSD");
  const [sort, setSort] = useState<SortKey>("deviation");
  const [descending, setDescending] = useState(true);
  const [method, setMethod] = useState(false);
  const { data, error, refresh, requesting, retry } = useMonitor(
    lookback,
    automatic,
  );
  const { pinned, toggle, warning } = useWatchlist();
  const rows = useMemo(() => {
    const q = search.toUpperCase().replace(/[^A-Z]/g, "");
    const filtered = (data?.rows ?? []).filter(
      (r) =>
        (currency === "ALL" ||
          r.pair.base === currency ||
          r.pair.quote === currency) &&
        (!watchOnly || pinned.includes(r.pair.id)) &&
        r.pair.id.includes(q),
    );
    function value(r: MonitorRow): number | string | null {
      switch (sort) {
        case "pair":
          return r.pair.id;
        case "change":
          return r.quote.change;
        case "weekly":
          return r.metrics.weekly_z_change;
        case "volatility":
          return r.metrics.volatility;
        default:
          return r.metrics.z_score === null
            ? null
            : Math.abs(r.metrics.z_score);
      }
    }
    return filtered.sort((a, b) => {
      const va = value(a),
        vb = value(b);
      if (va === null || vb === null)
        return va === vb
          ? a.pair.id.localeCompare(b.pair.id)
          : va === null
            ? 1
            : -1;
      const delta =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : Number(va) - Number(vb);
      return (
        (descending ? -delta : delta) || a.pair.id.localeCompare(b.pair.id)
      );
    });
  }, [data, currency, watchOnly, pinned, search, sort, descending]);
  const active = rows.find((r) => r.pair.id === selected) ?? rows[0] ?? null;
  const eligible = rows.filter((r) => r.metrics.status === "eligible");
  const stretched = eligible.filter(
    (r) => Math.abs(r.metrics.z_score ?? 0) >= 2,
  );
  const mean = eligible.length
    ? eligible.reduce((s, r) => s + Math.abs(r.metrics.z_score!), 0) /
      eligible.length
    : null;
  const available = rows.filter((r) =>
    ["available", "closed"].includes(r.quote.status),
  ).length;
  const busy = requesting || Boolean(data?.refresh.refreshing);
  function onSort(key: SortKey) {
    if (sort === key) setDescending((v) => !v);
    else {
      setSort(key);
      setDescending(key !== "pair");
    }
  }
  function exportCsv() {
    if (!data) return;
    const headers = [
      "pair",
      "quote",
      "quote_as_of",
      "quote_status",
      "quote_change_fraction",
      "analytics_as_of",
      "z_score",
      "weekly_z_change",
      "volatility_fraction",
      "analytics_status",
      "lookback",
      "snapshot_id",
    ];
    const values = rows.map((r) => [
      r.pair.label,
      r.quote.price,
      r.quote.observed_at,
      r.quote.status,
      r.quote.change,
      r.metrics.analytics_as_of,
      r.metrics.z_score,
      r.metrics.weekly_z_change,
      r.metrics.volatility,
      r.metrics.status,
      lookback,
      data.snapshot_id,
    ]);
    const csv = [headers, ...values]
      .map((line) =>
        line.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `g10-rv-${data.expected_session}-${lookback}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">FX / RELATIVE VALUE / MONITOR</div>
          <h1>G10 relative value</h1>
          <p>Currency deviations · Daily analytics · Latest available quotes</p>
        </div>
        <div className="heading-actions">
          <button className="quiet-button" onClick={() => setMethod(true)}>
            <BookOpen size={15} />
            Methodology
          </button>
          <button
            className="primary-button"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw size={14} className={busy ? "spinning" : ""} />
            {busy ? "Refreshing" : "Refresh data"}
          </button>
          <span className="last-refresh">
            <Clock3 size={11} />
            {data?.refresh.last_completed
              ? `Fetched ${timestamp(data.refresh.last_completed)}`
              : "Waiting for source data"}
          </span>
        </div>
      </section>
      <div className="market-strip">
        <span>
          <i
            className={`status-dot ${data?.market_status === "open" ? "open" : ""}`}
          />
          {!data
            ? "Connecting to market data"
            : data.market_status === "open"
              ? "Weekly FX session open"
              : "Weekly FX session closed"}
        </span>
        <span>
          Daily model{" "}
          <strong>{data ? shortDate(data.expected_session) : "—"}</strong>
        </span>
        <span>
          10 currencies <b>·</b> 45 direct pairs
        </span>
        <button
          onClick={() => setAutomatic((v) => !v)}
          className={`auto-button ${automatic ? "on" : ""}`}
          aria-pressed={automatic}
        >
          <span className="toggle-track">
            <i />
          </span>
          Auto refresh {automatic ? "on" : "off"}
        </button>
      </div>
      {(error || data?.refresh.error || warning) && (
        <div className="error-banner" role="alert">
          <CircleHelp size={16} />
          <span>
            {error ?? data?.refresh.error ?? warning}
            {error && data && " Retaining the last loaded snapshot."}
          </span>
          <button onClick={retry}>Retry</button>
        </div>
      )}
      {data?.refresh.refreshing && (
        <div className="refresh-progress" role="status">
          <span
            style={{
              width: `${(data.refresh.completed / data.refresh.total) * 100}%`,
            }}
          />
          <small>
            Updating {data.refresh.completed} / {data.refresh.total} pairs ·
            available observations remain visible
          </small>
        </div>
      )}
      <section className="summary-grid" aria-label="Summary of filtered pairs">
        <div className="summary-card">
          <span className="summary-label">
            MODEL COVERAGE <Check size={13} />
          </span>
          <div className="summary-number">
            {data ? eligible.length : "—"}
            <small>/ {data ? rows.length : 45}</small>
          </div>
          <p>Pairs with a valid {lookback}-session score</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">
            BEYOND ±2σ <ArrowDownUp size={13} />
          </span>
          <div className="summary-number">
            {data ? stretched.length : "—"}
            <small>pairs</small>
          </div>
          <p>Historical deviations, not trade signals</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">
            MEAN ABSOLUTE Z-SCORE <SlidersHorizontal size={13} />
          </span>
          <div className="summary-number">
            {number(mean)}
            <small>σ</small>
          </div>
          <p>Average stretch across eligible pairs</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">
            QUOTE FRESHNESS <Clock3 size={13} />
          </span>
          <div className="summary-number">
            {data ? available : "—"}
            <small>/ {data ? rows.length : 45}</small>
          </div>
          <p>
            Fresh or recent close ·{" "}
            {rows.filter((r) => r.quote.status === "stale").length} stale
          </p>
        </div>
      </section>
      <section className="workspace-controls" aria-label="Monitor filters">
        <div className="tabs">
          <button
            className={!watchOnly ? "active" : ""}
            onClick={() => setWatchOnly(false)}
            aria-pressed={!watchOnly}
          >
            All pairs <span>{data?.rows.length ?? 45}</span>
          </button>
          <button
            className={watchOnly ? "active" : ""}
            onClick={() => setWatchOnly(true)}
            aria-pressed={watchOnly}
          >
            <Star size={13} />
            Watchlist <span>{pinned.length}</span>
          </button>
        </div>
        <div className="filters">
          <label className="select-label">
            BASELINE
            <select
              aria-label="Baseline lookback"
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value) as Lookback)}
            >
              <option value={63}>63 sessions</option>
              <option value={126}>126 sessions</option>
              <option value={252}>252 sessions</option>
            </select>
          </label>
          <label className="select-label">
            CURRENCY
            <select
              aria-label="Currency filter"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="ALL">All currencies</option>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="monitor-grid">
        <section
          className="ranking-panel panel"
          aria-labelledby="ranking-title"
        >
          <div className="ranking-heading">
            <div>
              <h2 id="ranking-title">
                <span className="section-code">01</span> Relative-value ranking
              </h2>
              <p>
                {rows.length} pairs in view <span>·</span>{" "}
                {sort === "deviation"
                  ? `Absolute z-score ${descending ? "high to low" : "low to high"}`
                  : "Custom sort"}
              </p>
            </div>
            <button
              className="icon-button"
              onClick={exportCsv}
              disabled={!rows.length}
              aria-label="Export filtered ranking as CSV"
              title="Export this view"
            >
              <Download size={16} />
            </button>
          </div>
          <div className="search-row">
            <Search size={15} />
            <input
              aria-label="Search currency pairs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a pair, e.g. EUR/USD"
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
            <span className="search-hint">G10 FX</span>
          </div>
          <RankingTable
            rows={rows}
            selected={active?.pair.id ?? null}
            select={setSelected}
            pinned={pinned}
            togglePin={toggle}
            sort={sort}
            descending={descending}
            onSort={onSort}
            loading={!data}
          />
          <div className="table-footer">
            <span>
              <i className="legend-square positive" />
              Above baseline <i className="legend-square negative" />
              Below baseline <i className="legend-square neutral" /> At baseline
            </span>
            <button className="text-button" onClick={() => setMethod(true)}>
              How to read this <CircleHelp size={12} />
            </button>
          </div>
        </section>
        <Suspense
          fallback={
            <aside className="panel chart-placeholder">
              Loading pair explorer…
            </aside>
          }
        >
          <PairDetail
            row={active}
            snapshot={data?.snapshot_id ?? null}
            lookback={lookback}
            pinned={pinned.includes(active?.pair.id ?? "")}
            togglePin={toggle}
            retry={retry}
          />
        </Suspense>
      </div>
      <div className="bottom-note">
        <InfoNote />
        Latest quotes and completed daily statistics use separate clocks. A
        fresh fetch does not guarantee a fresh price.
      </div>
      {method && <Methodology close={() => setMethod(false)} />}
    </>
  );
}
function InfoNote() {
  return <CircleHelp size={13} />;
}
