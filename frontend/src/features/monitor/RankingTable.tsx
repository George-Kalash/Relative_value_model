import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Star,
} from "lucide-react";
import { percent, price, signed, timestamp, tone } from "../../lib/format";
import type { MonitorRow } from "../../types/api";

export type SortKey = "deviation" | "pair" | "change" | "weekly" | "volatility";
interface Props {
  rows: MonitorRow[];
  selected: string | null;
  select: (id: string) => void;
  pinned: string[];
  togglePin: (id: string) => void;
  sort: SortKey;
  descending: boolean;
  onSort: (key: SortKey) => void;
  loading: boolean;
}
export function ScoreBar({ value }: { value: number | null }) {
  return (
    <div className="score-cell">
      <div
        className="score-track"
        title="Scale: −4 to +4 standard deviations. Longer deviations are clipped; exact value is shown."
      >
        <span className="score-zero" />
        {value != null && (
          <span
            className={`score-fill ${tone(value)}`}
            style={{
              width: `${(Math.min(Math.abs(value), 4) / 8) * 100}%`,
              left:
                value >= 0
                  ? "50%"
                  : `${50 - (Math.min(Math.abs(value), 4) / 8) * 100}%`,
            }}
          />
        )}
      </div>
      <span className={`score-value ${tone(value)}`}>{signed(value)}</span>
    </div>
  );
}
export function RankingTable({
  rows,
  selected,
  select,
  pinned,
  togglePin,
  sort,
  descending,
  onSort,
  loading,
}: Props) {
  const heading = (name: string, key: SortKey, title: string) => (
    <th
      scope="col"
      aria-sort={
        sort === key ? (descending ? "descending" : "ascending") : "none"
      }
    >
      <button
        className={`column-sort ${sort === key ? "active" : ""}`}
        onClick={() => onSort(key)}
        title={title}
      >
        {name}
        {sort === key ? (
          descending ? (
            <ArrowDown size={11} />
          ) : (
            <ArrowUp size={11} />
          )
        ) : (
          <ArrowUpDown size={11} />
        )}
      </button>
    </th>
  );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Currency pair ranking, scroll for more rows"
    >
      <table className="ranking-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Pin pair</span>
              <Star size={12} />
            </th>
            {heading("PAIR", "pair", "Sort alphabetically")}
            <th scope="col">LATEST / 1M</th>
            {heading(
              "DAY %",
              "change",
              "Latest quote versus previous completed provider-day close",
            )}
            {heading("Z-SCORE", "deviation", "Sort by absolute daily z-score")}
            {heading("Δ 5D", "weekly", "Change in z-score over five sessions")}
            {heading(
              "VOL %",
              "volatility",
              "Annualized volatility of 20 daily log returns",
            )}
            <th scope="col">
              <span className="sr-only">Detail</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.pair.id}
              className={selected === row.pair.id ? "selected" : ""}
            >
              <td>
                <button
                  className={`pin-button ${pinned.includes(row.pair.id) ? "pinned" : ""}`}
                  aria-label={`${pinned.includes(row.pair.id) ? "Unpin" : "Pin"} ${row.pair.label}`}
                  aria-pressed={pinned.includes(row.pair.id)}
                  onClick={() => togglePin(row.pair.id)}
                >
                  <Star size={14} />
                </button>
              </td>
              <th scope="row">
                <button
                  className="pair-button"
                  onClick={() => select(row.pair.id)}
                  aria-pressed={selected === row.pair.id}
                >
                  <span>
                    {row.pair.base}
                    <span className="pair-slash">/</span>
                    {row.pair.quote}
                  </span>
                  <small
                    className={
                      row.metrics.status === "eligible" ? "" : "warning-text"
                    }
                  >
                    {row.metrics.status === "eligible"
                      ? "Daily model"
                      : row.metrics.status.replaceAll("_", " ")}
                  </small>
                </button>
              </th>
              <td
                title={`${timestamp(row.quote.observed_at)} · ${row.quote.reason ?? "Latest completed minute bar"}`}
              >
                <span className="numeric">
                  {price(row.quote.price, row.pair.quote)}
                </span>
                <small className={`quote-status ${row.quote.status}`}>
                  {row.quote.status === "available"
                    ? "Latest available"
                    : row.quote.status}
                </small>
              </td>
              <td className={`numeric ${tone(row.quote.change, 100)}`}>
                {percent(row.quote.change)}
              </td>
              <td
                title={
                  row.metrics.reason ??
                  "Historical log-price deviation in standard deviations"
                }
              >
                <ScoreBar value={row.metrics.z_score} />
              </td>
              <td className={`numeric ${tone(row.metrics.weekly_z_change)}`}>
                {signed(row.metrics.weekly_z_change)}
              </td>
              <td className="numeric muted">
                {percent(row.metrics.volatility, false)}
              </td>
              <td>
                <button
                  className="detail-button"
                  onClick={() => select(row.pair.id)}
                  aria-label={`Inspect ${row.pair.label}`}
                >
                  <ChevronRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="empty-state">
          <strong>
            {loading ? "Loading the G10 universe" : "No pairs in this view"}
          </strong>
          <span>
            {loading
              ? "Retrieving source observations. The first load can take a minute."
              : "Try another currency, search, or pin pairs in the All pairs tab."}
          </span>
        </div>
      )}
    </div>
  );
}
