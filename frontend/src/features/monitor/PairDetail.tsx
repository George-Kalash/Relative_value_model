import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Info, Star } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError, getHistory } from "../../lib/api";
import {
  number,
  percent,
  price,
  shortDate,
  signed,
  timestamp,
  tone,
} from "../../lib/format";
import type { HistoryResponse, Lookback, MonitorRow } from "../../types/api";

interface Props {
  row: MonitorRow | null;
  snapshot: string | null;
  lookback: Lookback;
  pinned: boolean;
  togglePin: (id: string) => void;
  retry: () => void;
}
const tooltipStyle = {
  background: "#111416",
  border: "1px solid #50565c",
  borderRadius: 2,
  fontSize: 12,
  color: "#e4eaf0",
};
const tickStyle = {
  fill: "#a1a7ae",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
};
export function PairDetail({
  row,
  snapshot,
  lookback,
  pinned,
  togglePin,
  retry,
}: Props) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(126);
  const pairId = row?.pair.id;
  useEffect(() => {
    if (!pairId || !snapshot) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    setError(null);
    getHistory(pairId, lookback, snapshot, controller.signal)
      .then((value) => {
        if (active) setHistory(value);
      })
      .catch((e) => {
        if (!active) return;
        setError(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "Unable to load this pair’s history.",
        );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [pairId, snapshot, lookback]);
  if (!row)
    return (
      <aside className="detail-panel panel">
        <div className="empty-state">
          <Info size={24} />
          <strong>Select a currency pair</strong>
          <span>Inspect its price, baseline, and daily deviation.</span>
        </div>
      </aside>
    );
  const ready =
    history?.snapshot_id === snapshot && history?.row.pair.id === pairId;
  const points = ready
    ? history.points
        .slice(-range)
        .map((p) => ({ ...p, time: Date.parse(`${p.date}T12:00:00Z`) }))
    : [];
  const enough = points.filter((p) => p.close !== null).length >= 8;
  const xAxis = (
    <XAxis
      dataKey="time"
      type="number"
      domain={["dataMin", "dataMax"]}
      scale="time"
      tickFormatter={(v) => shortDate(new Date(v).toISOString())}
      tick={tickStyle}
      axisLine={false}
      tickLine={false}
      minTickGap={45}
    />
  );
  const subtitle = points.length
    ? `${shortDate(points[0].date)} – ${shortDate(points[points.length - 1].date)} · ${lookback}-session baseline`
    : `${lookback}-session baseline`;
  return (
    <aside
      className="detail-panel panel"
      aria-label={`${row.pair.label} pair detail`}
    >
      <div className="detail-heading">
        <div>
          <p className="eyebrow">02 / PAIR EXPLORER</p>
          <h2>
            {row.pair.base}
            <span className="pair-slash"> / </span>
            {row.pair.quote}
          </h2>
        </div>
        <button
          className={`pin-large ${pinned ? "pinned" : ""}`}
          aria-label={`${pinned ? "Unpin" : "Pin"} selected ${row.pair.label}`}
          aria-pressed={pinned}
          onClick={() => togglePin(row.pair.id)}
        >
          <Star size={16} />
          {pinned ? "Pinned" : "Pin pair"}
        </button>
      </div>
      <div className="quote-hero">
        <span>{price(row.quote.price, row.pair.quote)}</span>
        <span className={`quote-change ${tone(row.quote.change, 100)}`}>
          {percent(row.quote.change)}
          <small>vs prior daily close</small>
        </span>
      </div>
      <div className={`observation ${row.quote.status}`}>
        <Clock3 size={12} />
        {timestamp(row.quote.observed_at)}
        <span className="status-pill">
          {row.quote.status === "available"
            ? "Latest 1m bar"
            : row.quote.status}
        </span>
      </div>
      {row.quote.reason && <p className="data-note">{row.quote.reason}</p>}
      <div className="detail-metrics">
        <div>
          <span>DAILY Z-SCORE</span>
          <strong className={tone(row.metrics.z_score)}>
            {signed(row.metrics.z_score)}
            <small>σ</small>
          </strong>
        </div>
        <div>
          <span>5-SESSION Δ</span>
          <strong className={tone(row.metrics.weekly_z_change)}>
            {signed(row.metrics.weekly_z_change)}
            <small>σ</small>
          </strong>
        </div>
        <div>
          <span>20D VOL / ANN.</span>
          <strong>{percent(row.metrics.volatility, false)}</strong>
        </div>
      </div>
      {row.metrics.reason && (
        <div className="inline-warning">
          <Info size={14} />
          {row.metrics.reason}
        </div>
      )}
      {row.daily_error && (
        <div className="inline-warning">
          <Info size={14} />
          Daily refresh failed: {row.daily_error}{" "}
          {row.daily_retrieved_at && "Showing retained history."}
        </div>
      )}
      <div className="chart-heading">
        <h3>Price & baseline</h3>
        <div className="segmented small" aria-label="Chart range">
          {[
            [63, "3M"],
            [126, "6M"],
            [252, "1Y"],
          ].map(([n, label]) => (
            <button
              key={n}
              onClick={() => setRange(Number(n))}
              aria-pressed={range === n}
              className={range === n ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="chart-subtitle">
        {subtitle}
        <br />
        {row.pair.quote} per {row.pair.base} · Focused price scale
      </p>
      <div className="chart-legend">
        <span>
          <i className="legend-line price-line" />
          Daily close
        </span>
        <span>
          <i className="legend-line baseline-line dashed" />
          Historical baseline
        </span>
      </div>
      {error ? (
        <div className="empty-state">
          <span>{error}</span>
          <button className="text-button" onClick={retry}>
            Reload monitor
          </button>
        </div>
      ) : !ready ? (
        <div className="chart-placeholder" role="status">
          Loading history…
        </div>
      ) : !enough ? (
        <div className="chart-placeholder">
          Not enough daily observations to chart.
        </div>
      ) : (
        <>
          <div
            className="price-chart"
            role="img"
            aria-label={`Daily ${row.pair.label} close and ${lookback}-session geometric mean`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="#292e33"
                  vertical={false}
                  strokeDasharray="2 4"
                />
                {xAxis}
                <YAxis
                  domain={["auto", "auto"]}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  tickFormatter={(v) =>
                    number(v, row.pair.quote === "JPY" ? 1 : 3)
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) =>
                    new Date(Number(v)).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(value, name) => [
                    price(Number(value), row.pair.quote),
                    name,
                  ]}
                />
                <Line
                  type="linear"
                  dataKey="close"
                  name="Daily close"
                  stroke="var(--chart-price)"
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="var(--chart-baseline)"
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-heading second">
            <h3>Z-score history</h3>
            <span className="muted">Standard deviations</span>
          </div>
          <div
            className="z-chart"
            role="img"
            aria-label={`${row.pair.label} historical daily z-score with zero and plus or minus two reference lines`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 10, right: 8, left: -10, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="#292e33"
                  vertical={false}
                  strokeDasharray="2 4"
                />
                {xAxis}
                <YAxis
                  domain={[
                    (min: number) => Math.floor(Math.min(min, -2.5)),
                    (max: number) => Math.ceil(Math.max(max, 2.5)),
                  ]}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <ReferenceLine y={0} stroke="#5b626b" />
                <ReferenceLine
                  y={2}
                  stroke="#5b626b"
                  strokeDasharray="4 4"
                  label={{
                    value: "+2σ",
                    position: "insideTopRight",
                    fill: "#a1a7ae",
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  y={-2}
                  stroke="#5b626b"
                  strokeDasharray="4 4"
                  label={{
                    value: "−2σ",
                    position: "insideBottomRight",
                    fill: "#a1a7ae",
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) =>
                    new Date(Number(v)).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(value) => [
                    `${signed(Number(value))}σ`,
                    "Z-score",
                  ]}
                />
                <Line
                  type="linear"
                  dataKey="z_score"
                  stroke="var(--chart-price)"
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <div className="detail-source">
        <span>
          Daily model through{" "}
          <strong>{shortDate(row.metrics.analytics_as_of)}</strong>
        </span>
        <span>Daily data fetched {timestamp(row.daily_retrieved_at)}</span>
        <span>Quote fetched {timestamp(row.quote.retrieved_at)}</span>
        {row.quote.comparison_date && (
          <span>
            Quote return reference: {shortDate(row.quote.comparison_date)}
          </span>
        )}
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(row.pair.yahoo_symbol)}/`}
          target="_blank"
          rel="noreferrer"
        >
          View source on Yahoo Finance <ArrowUpRight size={12} />
        </a>
      </div>
    </aside>
  );
}
