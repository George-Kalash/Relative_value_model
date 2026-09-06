import { Activity, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="brand-header">
        <a className="brand" href="/" aria-label="G10 Monitor home">
          <span className="brand-mark">
            <Activity size={20} />
          </span>
          G10
          <span className="brand-divider" />{" "}
          <span className="brand-product">RELATIVE VALUE</span>
        </a>
        <div className="header-right">
          <span className="research-label">G10 FX / RESEARCH TERMINAL</span>
          <a href="/docs" target="_blank" rel="noreferrer">
            API <ArrowUpRight size={13} />
          </a>
        </div>
      </header>
      <main>{children}</main>
      <footer>
        <span>
          G10 MONITOR <span className="footer-divider">/</span> Yahoo Finance
          via yfinance
        </span>
        <span>Descriptive statistics · No economic fair-value estimate</span>
      </footer>
    </div>
  );
}
