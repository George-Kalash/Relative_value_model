import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Methodology({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="method-dialog"
      aria-labelledby="method-title"
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">MODEL NOTES</p>
          <h2 id="method-title">Reading relative value</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close methodology"
        >
          <X size={20} />
        </button>
      </div>
      <p>
        This monitor measures how far a currency pair sits from its own price
        history. It does not estimate economic fair value or predict a reversal.
      </p>
      <dl className="definitions">
        <dt>Historical baseline</dt>
        <dd>
          The geometric mean of daily closes over 63, 126, or 252 sessions. The
          current completed daily close is included.
        </dd>
        <dt>Daily z-score</dt>
        <dd>
          (Log close − mean log close) ÷ sample standard deviation of log
          closes. A positive value means the base currency is above its
          historical baseline.
        </dd>
        <dt>Five-session change</dt>
        <dd>
          Today's daily z-score minus its value five sessions earlier. Each
          score uses its own trailing window.
        </dd>
        <dt>Realized volatility</dt>
        <dd>
          The sample standard deviation of 20 daily log returns, annualized
          using √252.
        </dd>
        <dt>Latest quote & daily change</dt>
        <dd>
          The last valid completed one-minute bar. Change compares it with the
          prior provider-day close, based on the quote's date. Quotes do not
          enter the daily model.
        </dd>
        <dt>Session & data policy</dt>
        <dd>
          Daily bars finalize one hour after their provider-local day ends.
          Weekend daily rows are excluded. Expected sessions are weekdays
          excluding January 1 and December 25; this is a conservative calendar,
          not a full holiday service. Missing or invalid observations break
          calculation windows.
        </dd>
        <dt>Freshness</dt>
        <dd>
          The weekly FX session is Sunday 17:00 to Friday 17:00 New York time.
          During that session, a minute bar older than 15 minutes is stale.
          Weekend observations remain dated. Yahoo quotes are latest available
          observations, not guaranteed live or executable prices.
        </dd>
        <dt>Coverage</dt>
        <dd>
          All 45 unique G10 pairs are requested directly. Missing crosses remain
          unavailable. A failed refresh retains prior observations with an
          explicit warning. Daily analytics and quotes have independent
          timestamps.
        </dd>
      </dl>
      <p className="data-note">
        ±2σ is a visual reference, not a probability or trading threshold.
        Currency pairs are correlated, and price levels can trend. Carry, macro
        factors, transaction costs, and execution are outside this model.
      </p>
      <button className="primary-button" onClick={close}>
        Back to monitor
      </button>
    </dialog>
  );
}
