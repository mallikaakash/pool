import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownLeft,
  Layers3,
  LayoutDashboard,
  BriefcaseBusiness,
  SlidersHorizontal,
  Activity,
  Split,
  Check,
  Copy,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Info,
  LoaderCircle,
  X,
  ExternalLink,
  Wallet,
  Building2,
  Clock,
  TriangleAlert,
  RefreshCw,
  FileCheck2,
  Menu,
  Download,
  CheckCircle2,
} from "lucide-react";
import type { Snapshot, Invoice, Transaction } from "./types";
import { useWalletUX } from "./InvestorGuide";

type Page = "overview" | "receivables" | "yield" | "servicing" | "activity";
type Action = (name: string, args?: Record<string, unknown>) => Promise<void>;
const money = (n: number, d = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  }).format(n) + " tUSD";
const number = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n);
const percent = (n: number) => `${(n * 100).toFixed(2)}%`;
const date = (n: number) =>
  new Date(n * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const pages: { id: Page; label: string; icon: typeof Layers3 }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "receivables", label: "Receivables", icon: BriefcaseBusiness },
  { id: "yield", label: "Yield lab", icon: Split },
  { id: "servicing", label: "Servicing", icon: SlidersHorizontal },
  { id: "activity", label: "Activity", icon: Activity },
];

function Tag({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`tag ${tone}`}>
      <span />
      {children}
    </span>
  );
}
function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function CardHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}
export function CopyButton({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy"
      title={label?.startsWith("Copy ") ? label : `Copy ${label ?? "address"}`}
      aria-label={
        label?.startsWith("Copy ") ? label : `Copy ${label ?? "address"}`
      }
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => setCopied(false));
      }}
    >
      {label ?? short(value)}
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}
function Note({
  children,
  warn = false,
}: {
  children: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className={`note ${warn ? "warning" : ""}`}>
      {warn ? <TriangleAlert size={16} /> : <Info size={16} />}
      <span>{children}</span>
    </div>
  );
}
function AmountForm({
  label,
  button,
  defaultValue = "1000",
  max,
  busy,
  onSubmit,
  unit = "tUSD",
  hint,
}: {
  label: string;
  button: string;
  defaultValue?: string;
  max?: number;
  busy: boolean;
  onSubmit: (amount: string) => Promise<void>;
  unit?: string;
  hint?: ReactNode;
}) {
  const [amount, setAmount] = useState(defaultValue);
  const walletUX = useWalletUX();
  const pending = walletUX ? walletUX.pending : busy;
  function submit(e: FormEvent) {
    e.preventDefault();
    void onSubmit(amount);
  }
  return (
    <form onSubmit={submit} className="amount-form">
      <label>
        <span>{label}</span>
        <div className="amount-input">
          <input
            aria-label={label}
            inputMode="decimal"
            type="number"
            min="0.000001"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <span>{unit}</span>
        </div>
      </label>
      {max !== undefined && (
        <div className="balance">
          <span>
            {walletUX && !walletUX.connected
              ? "Connect to see your balance"
              : `Available: ${number(max, 6)} ${unit}`}
          </span>
          <button
            type="button"
            disabled={Boolean(walletUX && !walletUX.connected)}
            onClick={() => setAmount((Math.floor(max * 1e6) / 1e6).toFixed(6))}
          >
            MAX
          </button>
        </div>
      )}
      {hint && <p className="form-hint">{hint}</p>}
      <button
        className="primary"
        type="submit"
        disabled={
          busy ||
          !Number.isFinite(Number(amount)) ||
          Number(amount) <= 0 ||
          (max !== undefined && Number(amount) > max)
        }
      >
        {pending ? <LoaderCircle size={17} className="spin" /> : null}
        {pending ? "Awaiting wallet / confirmation…" : button}
        <ArrowUpRight size={17} />
      </button>
      {walletUX && !walletUX.connected && (
        <p className="form-hint">
          Connect your wallet to use this action with your own test tokens.
        </p>
      )}
    </form>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const hash = location.hash.slice(1);
    return pages.some((p) => p.id === hash) ? (hash as Page) : "overview";
  });
  const [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<"boundaries" | "contracts" | null>(null),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const change = () => {
      const hash = location.hash.slice(1);
      if (pages.some((p) => p.id === hash)) setPage(hash as Page);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const r = await fetch("/api/state", { signal: controller.signal });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setState(data);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        fetching = false;
      }
    }
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [busy, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [modal]);
  const navigate = (p: Page) => {
    setPage(p);
    location.hash = p;
    setMenu(false);
    window.scrollTo({ top: 0 });
  };
  const act: Action = async (action, args = {}) => {
    if (busy) return;
    setBusy(true);
    setToast(null);
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...args }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setState(result.state);
      setToast({ text: `Transaction confirmed · ${short(result.hash)}` });
    } catch (e) {
      setToast({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="app-shell">
      <aside
        aria-label="Workspace navigation"
        className={`sidebar ${menu ? "is-open" : ""}`}
      >
        <a
          href="#overview"
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Pool overview"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          pool<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">CAPITAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={page === id ? "nav-active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {id === "yield" && <span className="new-label">LAB</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-box">
            <div>
              <span className="live-dot" />
              Local testnet
            </div>
            <small>Real contracts. Test funds.</small>
          </div>
          <button className="subtle" onClick={() => setModal("boundaries")}>
            <Info size={16} />
            Demo boundaries
            <ArrowUpRight size={14} />
          </button>
          <div className="built-with">
            COMPOSED WITH <b>Morpho · Pendle</b>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{pages.find((p) => p.id === page)?.label}</b>
          </div>
          <div className="topbar-right">
            <button
              className="network-trigger"
              onClick={() => setModal("contracts")}
            >
              <span className="network-icon">◈</span>Local · 31337
              <ChevronDown size={13} />
            </button>
            <div className="wallet-pill">
              <span className="avatar">AK</span>
              <span>
                Demo investor
                <small>
                  {state ? short(state.actors.investor) : "Connecting…"}
                </small>
              </span>
              <Wallet size={16} />
            </div>
          </div>
        </header>
        <main>
          <div className="environment-strip">
            <span>
              <span className="live-dot" />
              DISPOSABLE DEMO
            </span>
            <p>Synthetic receivables · Local blockchain · No real money</p>
            <button onClick={() => setModal("boundaries")}>
              What’s real?
              <ArrowUpRight size={13} />
            </button>
          </div>
          {!state ? (
            <div className="loading-card">
              {error ? (
                <>
                  <TriangleAlert size={32} />
                  <h1>Connection unavailable</h1>
                  <p>{error}</p>
                  <p>
                    Start the local stack with <code>npm run dev</code>.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setRefresh((n) => n + 1)}
                  >
                    Retry connection
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spin" size={30} />
                  <h1>Reading your workspace</h1>
                  <p>Fetching balances from the local chain…</p>
                </>
              )}
            </div>
          ) : (
            <>
              {error && (
                <Note warn>
                  Connection interrupted. These balances may be stale: {error}
                </Note>
              )}
              {page === "overview" && (
                <Overview s={state} act={act} busy={busy} navigate={navigate} />
              )}
              {page === "receivables" && <Receivables s={state} />}
              {page === "yield" && <YieldLab s={state} act={act} busy={busy} />}
              {page === "servicing" && (
                <Servicing s={state} act={act} busy={busy} />
              )}
              {page === "activity" && <ActivityPage s={state} />}
              <footer>
                <span>POOL / TRADE CREDIT, COMPOSED</span>
                <span>
                  <span className="live-dot" />
                  Block {number(state.network.block, 0)}
                  <i />
                  Chain time {date(state.network.timestamp)}
                  <button
                    aria-label="Refresh balances"
                    className="icon-button"
                    onClick={() => setRefresh((n) => n + 1)}
                  >
                    <RefreshCw size={13} />
                  </button>
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? (
            <TriangleAlert size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">A CLEAR TRUST BOUNDARY</span>
            <h2 id="modal-title">
              {modal === "contracts"
                ? "Deployed on your local chain"
                : "Real mechanics. Synthetic assets."}
            </h2>
            {modal === "contracts" && state ? (
              <div className="contract-list">
                {Object.entries(state.addresses)
                  .filter(([k]) => k !== "ERC1967Proxy")
                  .map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <CopyButton value={v} />
                    </div>
                  ))}
              </div>
            ) : (
              <>
                <div className="boundary-item">
                  <CheckCircle2 />
                  <div>
                    <h3>Runs onchain</h3>
                    <p>
                      Actual Morpho Blue lending and liquidation. Actual Pendle
                      PT/YT contracts. Pool’s own vault, oracle, SY adapter and
                      atomic router.
                    </p>
                  </div>
                </div>
                <div className="boundary-item">
                  <Building2 />
                  <div>
                    <h3>Simulated for this demo</h3>
                    <p>
                      Every debtor, invoice and collection. Legal assignment,
                      valuation and payment confirmation are assumed. Names are
                      fictional and do not imply partnerships. Test currency and
                      disposable local accounts only.
                    </p>
                  </div>
                </div>
                <div className="boundary-item">
                  <TriangleAlert />
                  <div>
                    <h3>Still needed for a real launch</h3>
                    <p>
                      Verified enforceable assets, independent servicing and
                      valuation, compliant investor access, committed
                      liquidation capital, audits, and a funded secondary
                      market. This demo is neither an Arbitrum deployment nor a
                      live Pendle AMM listing.
                    </p>
                  </div>
                </div>
                <Note>
                  PT is exposed to credit losses. Maturity returns vault shares;
                  converting those shares to cash depends on available loan
                  liquidity. The demo rate model is a fixed 12% APR.
                </Note>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export function Overview({
  s,
  act,
  busy,
  navigate,
}: {
  s: Snapshot;
  act: Action;
  busy: boolean;
  navigate: (p: Page) => void;
}) {
  const walletUX = useWalletUX();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">YOUR CAPITAL, CONNECTED</span>
          <h1>
            Trade income.
            <br />
            <span>On your terms.</span>
          </h1>
          <p>
            Finance a portfolio of receivables.
            <br className="mobile-break" /> Choose how you hold the yield.
          </p>
        </div>
        <div className="heading-aside">
          <span className="eyebrow">YOUR LENDING POSITION</span>
          <strong>
            {walletUX && !walletUX.connected ? "—" : money(s.investor.value, 2)}
          </strong>
          <span>
            {walletUX && !walletUX.connected
              ? "Connect to view your position"
              : `${number(s.investor.shares)} pCREDIT shares`}
          </span>
          <button className="text-link" onClick={() => navigate("yield")}>
            Explore yield strategies
            <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
      <section className="metrics-grid" aria-label="Facility metrics">
        <Metric
          label="SUPPLIED CAPITAL"
          value={money(s.market.totalSupply)}
          note="Across all facility lenders"
        />
        <Metric
          label="INDICATIVE SUPPLY APY"
          value={percent(s.market.supplyAPY)}
          note={
            s.market.totalBorrow === 0
              ? "No borrowing yet · idle capital earns no interest"
              : "Annualized estimate · not earned cash"
          }
          accent
        />
        <Metric
          label="AVAILABLE LIQUIDITY"
          value={money(s.market.liquidity)}
          note={`${percent(s.market.utilization)} of capital is on loan`}
        />
        <Metric
          label="COLLATERAL BOOK NAV"
          value={money(s.pool.nav)}
          note="Servicer-valued receivables + cash"
        />
      </section>
      <details className="yield-explainer">
        <summary>
          {s.market.totalBorrow === 0
            ? "Why is the yield 0%?"
            : "Where does this yield come from?"}
        </summary>
        <p>
          {s.market.totalBorrow === 0
            ? "Capital is available, but the business has not borrowed it yet. Interest starts when the operator draws a loan."
            : "The business pays borrowing interest. That income is shared across all supplied capital, including the idle portion."}
        </p>
        <div className="yield-equation">
          <span>
            <b>12%</b> fixed demo borrow APR
          </span>
          <span>×</span>
          <span>
            <b>{percent(s.market.utilization)}</b> capital in use
          </span>
          <span>≈</span>
          <span>
            <b>{percent(0.12 * s.market.utilization)}</b> indicative lender APR
          </span>
        </div>
        <p>
          APY is an annualized compounding estimate. Accrued interest is income
          earned over time; cash you can withdraw also depends on available
          liquidity. PT/YT separates the claim—it does not create extra income.
        </p>
      </details>
      <div className="overview-grid">
        <div className="overview-main">
          <section className="card pool-card">
            <CardHead
              eyebrow="FEATURED FACILITY · SG-001"
              title="Singapore trade credit"
              right={
                <Tag
                  tone={
                    s.pool.closed
                      ? "neutral"
                      : s.market.healthFactor !== null &&
                          s.market.healthFactor < 1
                        ? "red"
                        : "green"
                  }
                >
                  {s.pool.closed
                    ? "Closed"
                    : s.market.healthFactor !== null &&
                        s.market.healthFactor < 1
                      ? "At risk"
                      : "Active facility"}
                </Tag>
              }
            />
            <div className="pool-card-body">
              <div className="pool-description">
                <p>
                  One portfolio. Five businesses.
                  <br />
                  Working capital that keeps trade moving.
                </p>
                <div className="chips">
                  <span>Assigned receivables</span>
                  <span>Isolated market</span>
                  <span>USD</span>
                </div>
                <div className="pool-facts">
                  <div>
                    <span>Outstanding debt</span>
                    <b>{money(s.market.debt)}</b>
                  </div>
                  <div>
                    <span>Liquidation threshold</span>
                    <b>{percent(s.market.lltv)}</b>
                  </div>
                  <div>
                    <span>Collateral health</span>
                    <b
                      className={
                        s.market.healthFactor !== null &&
                        s.market.healthFactor < 1
                          ? "red-text"
                          : "green-text"
                      }
                    >
                      {s.market.healthFactor === null
                        ? "Debt-free"
                        : `${s.market.healthFactor.toFixed(2)}×`}
                    </b>
                  </div>
                </div>
              </div>
              <div className="trade-art" aria-hidden="true">
                <div className="art-grid" />
                <div className="block block-one">
                  <span>01</span>
                </div>
                <div className="block block-two">
                  <span>02</span>
                </div>
                <div className="block block-three">
                  <span>03</span>
                </div>
                <div className="art-caption">
                  REAL-WORLD PROCESS
                  <br />
                  ONCHAIN EXPOSURE
                </div>
              </div>
            </div>
            <div className="pool-card-footer">
              <span>
                <ShieldCheck size={15} />
                Synthetic assigned portfolio · 5 receivables
              </span>
              <button
                className="text-link"
                onClick={() => navigate("receivables")}
              >
                Inspect the assets
                <ArrowUpRight size={16} />
              </button>
            </div>
          </section>
          <div className="lower-grid">
            <section className="card allocation-card">
              <CardHead
                title="Capital at work"
                right={<span className="muted-label">LIVE</span>}
              />
              <div className="allocation">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(var(--orange) 0 ${s.market.utilization * 100}%, var(--soft) ${s.market.utilization * 100}% 100%)`,
                  }}
                >
                  <div>
                    <strong>
                      {(s.market.utilization * 100).toFixed(1)}
                      <small>%</small>
                    </strong>
                    <span>UTILIZATION</span>
                  </div>
                </div>
                <div className="legend">
                  <div>
                    <i className="orange-dot" />
                    <span>
                      On loan<b>{money(s.market.totalBorrow)}</b>
                    </span>
                  </div>
                  <div>
                    <i className="gray-dot" />
                    <span>
                      Available cash<b>{money(s.market.liquidity)}</b>
                    </span>
                  </div>
                </div>
              </div>
              <p className="fine-print">
                Withdrawals are limited to cash available in Morpho.
              </p>
            </section>
            <section className="card strategy-card">
              <span className="eyebrow">ONE POSITION. TWO POSSIBILITIES.</span>
              <div className="split-symbol">
                <span>PT</span>
                <Split size={23} />
                <span>YT</span>
              </div>
              <h2>
                Separate principal
                <br />
                from future yield.
              </h2>
              <p>Split your lender shares into independent Pendle tokens.</p>
              <button className="text-link" onClick={() => navigate("yield")}>
                Open yield lab
                <ArrowRight size={16} />
              </button>
            </section>
          </div>
        </div>
        <aside aria-label="Investment actions" className="card transact-card">
          <CardHead title="Put capital to work" />
          <div className="segmented">
            <button
              aria-pressed={mode === "deposit"}
              className={mode === "deposit" ? "selected" : ""}
              onClick={() => setMode("deposit")}
            >
              Deposit
            </button>
            <button
              aria-pressed={mode === "withdraw"}
              className={mode === "withdraw" ? "selected" : ""}
              onClick={() => setMode("withdraw")}
            >
              Withdraw
            </button>
          </div>
          <AmountForm
            key={mode}
            label={mode === "deposit" ? "Deposit amount" : "Withdrawal amount"}
            button={
              mode === "deposit"
                ? "Deposit test dollars"
                : "Withdraw test dollars"
            }
            max={mode === "deposit" ? s.investor.cash : s.investor.withdrawable}
            busy={busy}
            onSubmit={(amount) => act(mode, { amount })}
          />
          <div className="receipt-rows">
            <div>
              <span>You {mode === "deposit" ? "receive" : "spend"}</span>
              <b>{mode === "deposit" ? "pCREDIT shares" : "pCREDIT shares"}</b>
            </div>
            <div>
              <span>Share value</span>
              <b>{money(s.yield.exchangeRate, 6)}</b>
            </div>
            <div>
              <span>Protocol</span>
              <b>
                <span className="tiny-diamond" />
                Morpho Blue
              </b>
            </div>
            <div>
              <span>Wallet</span>
              {walletUX && !walletUX.connected ? (
                <b>Not connected</b>
              ) : (
                <CopyButton value={s.actors.investor} />
              )}
            </div>
          </div>
          <Note>
            Returns come from borrower interest. Capital is exposed to debtor
            losses and withdrawal delays.
          </Note>
          <div className="test-fund-line">
            <Wallet size={14} />
            {s.network.chainId === 31337
              ? "Uses a pre-funded disposable demo wallet"
              : walletUX && !walletUX.connected
                ? "Public facility data · connect to transact"
                : "Your connected wallet · test dollars only"}
          </div>
        </aside>
      </div>
      <section className="process-strip">
        <span className="eyebrow">FOLLOW THE CASH FLOW</span>
        <div>
          <span>
            <b>01</b>Assigned receivables
          </span>
          <ArrowRight />
          <span>
            <b>02</b>Morpho financing
          </span>
          <ArrowRight />
          <span>
            <b>03</b>Lender yield
          </span>
          <ArrowRight />
          <span>
            <b>04</b>Pendle PT / YT
          </span>
        </div>
      </section>
    </>
  );
}

export function Receivables({ s }: { s: Snapshot }) {
  const [selected, setSelected] = useState<Invoice | null>(null);
  const max = Math.max(...s.invoices.map((i) => i.face));
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">SG-001 / COLLATERAL PORTFOLIO</span>
          <h1>Behind the yield.</h1>
          <p>
            Outstanding invoices, collection dates, and recognized credit
            losses.
          </p>
        </div>
        <Tag tone="neutral">Synthetic data</Tag>
      </section>
      <div className="metrics-grid">
        <Metric
          label="RECEIVABLES BOOK VALUE"
          value={money(s.pool.nav - s.pool.cash)}
          note="Net of collections and recognized losses"
        />
        <Metric
          label="UNCOLLECTED FACE"
          value={money(s.pool.face)}
          note="Contractual amounts, not guaranteed cash"
        />
        <Metric
          label="COLLECTIONS HELD"
          value={money(s.pool.cash)}
          note="Available to sweep into debt repayment"
        />
        <Metric
          label="RECOGNIZED IMPAIRMENT"
          value={money(s.pool.impairment)}
          note="Cumulative servicer write-downs"
        />
      </div>
      <section className="portfolio-risk" aria-label="Portfolio risk summary">
        <div>
          <span>Largest debtor concentration</span>
          <strong>
            {percent(
              Math.max(0, ...s.invoices.map((i) => i.face - i.collected)) /
                Math.max(s.pool.face, 1),
            )}
          </strong>
          <small>Share of uncollected face value</small>
        </div>
        <div>
          <span>Overdue invoices</span>
          <strong>
            {
              s.invoices.filter(
                (i) => i.due < s.network.timestamp && i.collected < i.face,
              ).length
            }{" "}
            / {s.invoices.length}
          </strong>
          <small>Unpaid after contractual due date</small>
        </div>
        <div>
          <span>Oldest overdue payment</span>
          <strong>
            {Math.max(
              0,
              ...s.invoices
                .filter((i) => i.collected < i.face)
                .map((i) => Math.floor((s.network.timestamp - i.due) / 86400)),
            )}{" "}
            days
          </strong>
          <small>Overdue amounts are not automatically impaired</small>
        </div>
      </section>
      <section className="card receivables-register">
        <CardHead
          eyebrow="THE UNDERLYING ASSETS"
          title="Receivables register"
          right={<span className="muted-label">5 FICTIONAL BUYERS</span>}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Debtor / invoice</th>
                <th scope="col">Uncollected face</th>
                <th scope="col">Book value</th>
                <th scope="col">Due date</th>
                <th scope="col">Status</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {s.invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="buyer-cell">
                      <span className="buyer-icon">
                        <Building2 size={17} />
                      </span>
                      <div>
                        <b>{i.buyer}</b>
                        <small>
                          SG-00{i.id + 1} · {i.sector}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{money(i.face - i.collected)}</td>
                  <td>{money(i.value)}</td>
                  <td>{date(i.due)}</td>
                  <td>
                    <Tag
                      tone={
                        i.status === "Impaired"
                          ? "red"
                          : i.status === "Past due"
                            ? "amber"
                            : i.status === "Collected"
                              ? "neutral"
                              : "green"
                      }
                    >
                      {i.status}
                    </Tag>
                  </td>
                  <td>
                    <button
                      className="icon-button evidence"
                      aria-label={`Inspect evidence for ${i.buyer}`}
                      onClick={() => {
                        setSelected(i);
                        requestAnimationFrame(() =>
                          document
                            .querySelector(".evidence-detail")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            }),
                        );
                      }}
                    >
                      <FileCheck2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <Info size={14} />
          Evidence hashes identify synthetic records. They do not verify
          ownership, assignment or debtor payment.
        </div>
      </section>
      <div className="lower-grid space-top">
        <section className="card">
          <CardHead
            title="Collection schedule"
            right={<span className="muted-label">CONTRACTUAL FACE</span>}
          />
          <div className="maturity-chart">
            {s.invoices.map((i) => (
              <div key={i.id}>
                <span>{date(i.due).slice(0, -5)}</span>
                <div>
                  <i
                    style={{
                      width: `${((i.face - i.collected) / max) * 100}%`,
                    }}
                  />
                </div>
                <b>{money(i.face - i.collected)}</b>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Dates are contractual due dates; collections require actual
            settlement.
          </p>
        </section>
        <section className="card">
          <CardHead title="What the token represents" />
          <div className="explanation">
            <p>
              <b>rINV is the collateral.</b> It represents this portfolio’s
              residual assets. The facility pledges it to Morpho to borrow
              working capital.
            </p>
            <p>
              <b>pCREDIT is the lender’s position.</b> It holds a supply
              position in Morpho. Its income comes from borrowing interest,
              rather than directly owning invoices.
            </p>
            <p>
              <b>Book NAV is an estimate.</b> The servicer recognizes
              impairment. A lower value can trigger liquidation; recovery still
              depends on a funded buyer and enforceable rights.
            </p>
          </div>
        </section>
      </div>
      {selected && (
        <section className="card evidence-detail space-top" aria-live="polite">
          <CardHead
            title={`Synthetic evidence · SG-00${selected.id + 1}`}
            right={
              <button
                className="icon-button"
                aria-label="Close evidence"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            }
          />
          <dl className="invoice-detail-facts">
            <div>
              <dt>Debtor</dt>
              <dd>{selected.buyer}</dd>
            </div>
            <div>
              <dt>Book value</dt>
              <dd>{money(selected.value)}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{date(selected.due)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
          </dl>
          <details className="utility-details">
            <summary>Evidence hash</summary>
            <code>{selected.evidence}</code>
          </details>
          <p>
            Hash of the exact UTF-8 synthetic evidence document. No live
            TradeTrust, InvoiceNow, registry or bank connection.
          </p>
          <CopyButton value={selected.evidence} label="Copy evidence hash" />
        </section>
      )}
    </>
  );
}

export function YieldLab({
  s,
  act,
  busy,
  onTrade,
}: {
  s: Snapshot;
  act: Action;
  busy: boolean;
  onTrade?: () => void;
}) {
  const walletUX = useWalletUX();
  const [mode, setMode] = useState<"split" | "redeem">("split");
  const days = Math.max(
    0,
    Math.ceil((s.yield.expiry - s.network.timestamp) / 86400),
  );
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">POWERED BY PENDLE CORE</span>
          <h1>Make yield your own.</h1>
          <p>Separate the lending position’s principal and future interest.</p>
        </div>
        <div className="expiry-badge">
          <Clock size={18} />
          <div>
            <small>{s.yield.expired ? "MATURITY REACHED" : "MATURITY"}</small>
            <b>{date(s.yield.expiry)}</b>
          </div>
          <span>{days}d</span>
        </div>
      </section>
      <section
        className="token-explainer"
        aria-label="Principal and yield explained"
      >
        <div>
          <b>pCREDIT</b>
          <span>Your share in the lending vault</span>
        </div>
        <ArrowRight size={20} />
        <div>
          <b>PT · principal claim</b>
          <span>Redeem into vault shares at maturity; losses still apply</span>
        </div>
        <span className="split-plus">+</span>
        <div>
          <b>YT · yield claim</b>
          <span>Receive lending yield generated before expiry</span>
        </div>
      </section>
      <div className="yield-grid">
        <section className="card token-card principal">
          <div className="token-top">
            <span className="token-symbol">PT</span>
            <Tag tone="neutral">Principal token</Tag>
          </div>
          <h2>A claim at maturity.</h2>
          <p>
            Redeem principal exposure to the lending vault. Credit losses still
            apply.
          </p>
          <div className="token-balance">
            <span>
              {walletUX && !walletUX.connected
                ? "CONNECT TO VIEW YOUR PT"
                : "YOUR PT BALANCE"}
            </span>
            <strong>
              {walletUX && !walletUX.connected ? "—" : number(s.yield.pt, 4)}
              <small>PT</small>
            </strong>
          </div>
          <dl>
            <div>
              <dt>At maturity</dt>
              <dd>PT → vault shares</dd>
            </div>
            <div>
              <dt>Principal protected</dt>
              <dd>No</dd>
            </div>
            <div>
              <dt>Underlying</dt>
              <dd>pCREDIT via SY</dd>
            </div>
          </dl>
          <CopyButton value={s.addresses.PendlePrincipalToken} />
        </section>
        <section className="card token-card yield">
          <div className="token-top">
            <span className="token-symbol">YT</span>
            <Tag tone="orange">Yield token</Tag>
          </div>
          <h2>The income until then.</h2>
          <p>
            Hold the right to the lending yield generated before the expiry
            checkpoint.
          </p>
          <div className="token-balance">
            <span>
              {walletUX && !walletUX.connected
                ? "CONNECT TO VIEW YOUR YT"
                : "YOUR YT BALANCE"}
            </span>
            <strong>
              {walletUX && !walletUX.connected ? "—" : number(s.yield.yt, 4)}
              <small>YT</small>
            </strong>
          </div>
          <dl>
            <div>
              <dt>Claimable now</dt>
              <dd>
                {walletUX && !walletUX.connected
                  ? "—"
                  : `${number(s.yield.claimable, 6)} SY`}
              </dd>
            </div>
            <div>
              <dt>Return profile</dt>
              <dd>Variable interest</dd>
            </div>
            <div>
              <dt>Value after expiry</dt>
              <dd>Accrued interest only</dd>
            </div>
          </dl>
          <CopyButton value={s.addresses.PendleYieldToken} />
        </section>
        <section className="card transact-card">
          <CardHead title="Shape your position" />
          <div className="segmented">
            <button
              aria-pressed={mode === "split"}
              className={mode === "split" ? "selected" : ""}
              onClick={() => setMode("split")}
            >
              Split shares
            </button>
            <button
              aria-pressed={mode === "redeem"}
              className={mode === "redeem" ? "selected" : ""}
              onClick={() => setMode("redeem")}
            >
              Redeem
            </button>
          </div>
          {mode === "split" && s.yield.expired ? (
            <Note warn>
              This series has matured. New PT/YT can no longer be minted.
            </Note>
          ) : (
            <AmountForm
              key={mode}
              label={mode === "split" ? "Shares to split" : "PT to redeem"}
              unit={mode === "split" ? "pCREDIT" : "PT"}
              button={
                mode === "split" ? "Mint PT + YT" : "Redeem to vault shares"
              }
              max={
                mode === "split"
                  ? s.investor.shares
                  : s.yield.expired
                    ? s.yield.pt
                    : Math.min(s.yield.pt, s.yield.yt)
              }
              busy={busy}
              onSubmit={(amount) => act(mode, { amount })}
              hint={
                mode === "split"
                  ? "Your vault shares are wrapped into SY and split atomically."
                  : s.yield.expired
                    ? "After expiry, only PT is needed."
                    : "Before expiry, matching amounts of PT and YT are required."
              }
            />
          )}
          <div className="receipt-rows">
            <div>
              <span>SY exchange rate</span>
              <b>{s.yield.exchangeRate.toFixed(6)}</b>
            </div>
            <div>
              <span>Yield source</span>
              <b>Morpho borrower interest</b>
            </div>
          </div>
          <Note>
            Maturity delivers vault shares. Cash withdrawal remains limited by
            available Morpho liquidity.
          </Note>
        </section>
      </div>
      <div className="lower-grid space-top">
        <section className="card">
          <CardHead
            title="Harvest your interest"
            right={<ArrowDownLeft size={21} />}
          />
          <div className="claim-value">
            <strong>
              {walletUX && !walletUX.connected
                ? "—"
                : number(s.yield.claimable, 6)}
            </strong>
            <span>SY available to claim</span>
          </div>
          <button
            className="secondary full-width"
            disabled={busy || s.yield.claimable < 0.000001}
            onClick={() => void act("claim")}
          >
            Claim accrued yield
            <ArrowUpRight size={16} />
          </button>
          <div className="unwrap-row">
            <span>
              Claimed SY balance{" "}
              <b>
                {walletUX && !walletUX.connected ? "—" : number(s.yield.sy, 6)}
              </b>
            </span>
            <button
              className="text-link"
              disabled={busy || s.yield.sy <= 0}
              onClick={() =>
                void act("unwrap", { amount: s.yield.sy.toFixed(6) })
              }
            >
              Unwrap to shares
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
        {onTrade ? (
          <section className="card">
            <CardHead title="Sell a component" right={<Split size={21} />} />
            <p className="body-copy">
              A buyer can offer test dollars for your PT or YT. Review the
              signed offer and settle the trade from your own wallet.
            </p>
            <button className="secondary full-width" onClick={onTrade}>
              Open Market <ArrowUpRight size={16} />
            </button>
            <p className="fine-print">
              Requires a second, funded wallet. There is no standing buyer or
              automatic exit.
            </p>
          </section>
        ) : (
          <section className="card">
            <CardHead
              title="Transfer the income rights"
              right={<Split size={21} />}
            />
            <p className="body-copy">
              Send YT to a separate demo trader while keeping your PT. This
              demonstrates independent ownership of future income.
            </p>
            <AmountForm
              label="Yield tokens to transfer"
              button="Transfer YT to demo trader"
              defaultValue="100"
              unit="YT"
              max={s.yield.yt}
              busy={busy}
              onSubmit={(amount) => act("transferYT", { amount })}
            />
            <p className="fine-print">
              A transfer does not pay you. Open Market to sell PT or YT against
              a funded, signed offer; there is no guaranteed buyer.
            </p>
          </section>
        )}
      </div>
      <div className="space-top">
        <Note>
          Yield tokens are not a first-loss tranche. Losses in the lender vault
          can reduce principal value and stop yield accrual until the exchange
          rate recovers. Standard Pendle expiry accounting uses the first
          post-expiry index checkpoint.
        </Note>
      </div>
    </>
  );
}

export function Servicing({
  s,
  act,
  busy,
}: {
  s: Snapshot;
  act: Action;
  busy: boolean;
}) {
  const [invoiceId, setInvoiceId] = useState(0),
    [loss, setLoss] = useState("0");
  const walletUX = useWalletUX();
  const inv = s.invoices[invoiceId];
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">ORIGINATOR / SERVICER CONTROLS</span>
          <h1>Run the full lifecycle.</h1>
          <p>
            Collect, repay, recognize a loss — and see who carries the risk.
          </p>
        </div>
        <Tag tone="amber">Privileged demo role</Tag>
      </section>
      <Note>
        {s.network.chainId === 421614
          ? "The configured operator serves as the servicer and finite demo backstop. "
          : "These controls use separate disposable servicer and backstop wallets. "}
        Real payment confirmation, asset valuation and legal enforcement remain
        offchain dependencies.
      </Note>
      <div className="metrics-grid space-top">
        <Metric
          label="FACILITY DEBT"
          value={money(s.market.debt, 2)}
          note="Principal plus accrued borrowing interest"
        />
        <Metric
          label="CURRENT LOAN-TO-VALUE"
          value={percent(s.market.ltv)}
          note={`Liquidation threshold ${percent(s.market.lltv)}`}
        />
        <Metric
          label="COLLECTIONS TO SWEEP"
          value={money(s.pool.cash)}
          note="Cash controlled by the portfolio contract"
        />
        <Metric
          label="LIQUIDATION WALLET CASH"
          value={walletUX && !walletUX.connected ? "—" : money(s.backstop.cash)}
          note={
            walletUX && !walletUX.connected
              ? "Connect to view your available funds"
              : `${number(s.backstop.collateral)} rINV acquired`
          }
        />
      </div>
      <div className="servicing-grid">
        <section className="card">
          <CardHead eyebrow="01 / CASH ARRIVES" title="Record a collection" />
          <label className="select-label">
            Invoice
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(Number(e.target.value))}
            >
              {s.invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  SG-00{i.id + 1} · {i.buyer}
                </option>
              ))}
            </select>
          </label>
          <AmountForm
            key={invoiceId}
            label="Received payment"
            defaultValue="10000"
            button="Record settled test payment"
            max={inv.face - inv.collected}
            busy={busy}
            onSubmit={(amount) => act("collect", { id: invoiceId, amount })}
          />
          <p className="fine-print">
            Transfers actual test dollars from the servicer wallet. Removes the
            corresponding receivable book value.
          </p>
        </section>
        <section className="card">
          <CardHead
            eyebrow="02 / PAY DOWN THE FACILITY"
            title="Route the collections"
          />
          <div className="sweep-amount">
            {money(s.pool.cash, 2)}
            <span>held in the collateral portfolio</span>
          </div>
          <div className="mini-flow">
            <span>Collections</span>
            <ArrowRight size={16} />
            <span>Morpho debt</span>
          </div>
          <button
            className="primary"
            disabled={
              busy || s.pool.cash <= 0 || s.market.debt <= 0 || s.pool.closed
            }
            onClick={() => void act("sweep")}
          >
            Sweep into repayment
            <ArrowUpRight size={17} />
          </button>
          <p className="fine-print">
            The contract can send swept cash only to its configured Morpho debt.
            Any excess remains in the portfolio.
          </p>
        </section>
        <section className="card">
          <CardHead
            eyebrow="03 / TEST THE DOWNSIDE"
            title="Recognize impairment"
          />
          <p className="body-copy">
            Selected: <b>{inv.buyer}</b>
            <br />
            Current book value: {money(inv.value)}
          </p>
          <form
            className="amount-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act("impair", { id: invoiceId, amount: loss });
            }}
          >
            <label>
              New book value
              <div className="amount-input">
                <input
                  aria-label="New book value"
                  type="number"
                  min="0"
                  max={Math.max(0, inv.value - 0.000001)}
                  step=".000001"
                  value={loss}
                  onChange={(e) => setLoss(e.target.value)}
                  required
                />
                <span>tUSD</span>
              </div>
            </label>
            <button
              className="secondary danger"
              disabled={busy || Number(loss) >= inv.value || Number(loss) < 0}
            >
              Recognize the loss
              <TriangleAlert size={16} />
            </button>
          </form>
          <p className="fine-print">
            Updates the book-NAV oracle immediately. A lower valuation can make
            the position liquidatable.
          </p>
        </section>
        <section className="card">
          <CardHead
            eyebrow="04 / EXERCISE THE BACKSTOP"
            title="Liquidate collateral"
            right={
              <Tag
                tone={
                  s.market.healthFactor !== null && s.market.healthFactor < 1
                    ? "red"
                    : "green"
                }
              >
                {s.market.healthFactor !== null && s.market.healthFactor < 1
                  ? "Liquidatable"
                  : "Healthy"}
              </Tag>
            }
          />
          <AmountForm
            label="Collateral shares to acquire"
            unit="rINV"
            defaultValue="100000"
            max={s.market.collateral}
            button="Execute Morpho liquidation"
            busy={
              busy ||
              s.market.healthFactor === null ||
              s.market.healthFactor >= 1
            }
            onSubmit={(amount) => act("liquidate", { amount })}
          />
          <p className="fine-print">
            The backstop pays tUSD to Morpho and receives rINV. Its{" "}
            {money(s.backstop.cash)} wallet is finite; it is not insurance.
          </p>
        </section>
      </div>
      {s.network.chainId === 31337 && (
        <section className="card space-top">
          <CardHead title="Move through time" right={<Clock size={20} />} />
          <div className="clock-controls">
            <div>
              <strong>{date(s.network.timestamp)}</strong>
              <p>Local chain time. Advancing accrues real protocol interest.</p>
            </div>
            <div>
              {[7, 30, 100].map((days) => (
                <button
                  key={days}
                  className="secondary"
                  disabled={busy}
                  onClick={() => void act("advance", { days })}
                >
                  + {days} days
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <details className="card advanced space-top">
        <summary>
          Additional facility controls
          <ChevronDown size={18} />
        </summary>
        <div className="servicing-grid">
          <AmountForm
            label="Additional draw"
            button="Borrow test dollars"
            busy={busy || s.pool.closed}
            onSubmit={(amount) => act("borrow", { amount })}
          />
          <AmountForm
            label="Direct repayment"
            button="Repay from originator wallet"
            busy={busy || s.market.debt <= 0}
            onSubmit={(amount) => act("repay", { amount })}
          />
          <div className="control-stack">
            <h3>Close the facility</h3>
            <p>
              Repay debt first, then release residual collateral. Closing
              disables future borrowing.
            </p>
            <button
              className="secondary"
              disabled={busy || s.market.debt <= 0}
              onClick={() => void act("repayAll")}
            >
              Repay all debt
            </button>
            <button
              className="secondary"
              disabled={busy || s.market.debt > 0 || s.pool.closed}
              onClick={() => void act("close")}
            >
              {s.pool.closed ? "Facility closed" : "Close debt-free facility"}
            </button>
          </div>
          <AmountForm
            label="Recovered collateral to redeem"
            unit="rINV"
            button="Redeem backstop collateral"
            busy={busy || !s.pool.closed}
            max={s.backstop.collateral}
            onSubmit={(amount) => act("redeemCollateral", { amount })}
            hint="Requires a closed facility and sufficient collected cash."
          />
        </div>
      </details>
    </>
  );
}

export function ActivityPage({ s }: { s: Snapshot }) {
  const [expanded, setExpanded] = useState<Transaction | null>(null);
  function download() {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pool-chain-${s.network.block}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">EVERY ACTION, ACCOUNTED FOR</span>
          <h1>The transaction trail.</h1>
          <p>Confirmed transactions from {s.network.name}.</p>
        </div>
        <button className="secondary" onClick={download}>
          <Download size={16} />
          Export snapshot
        </button>
      </section>
      <section className="card">
        <CardHead
          title="Recent transactions"
          right={
            <span className="muted-label">LATEST {s.transactions.length}</span>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Block</th>
                <th scope="col">Status</th>
                <th scope="col">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {s.transactions.map((t) => (
                <tr key={t.hash}>
                  <td>
                    <b>{t.label}</b>
                    <small>{date(t.time)}</small>
                  </td>
                  <td>
                    <span className="role-label">{t.role}</span>
                  </td>
                  <td className="mono">{t.block}</td>
                  <td>
                    <Tag>Confirmed</Tag>
                  </td>
                  <td>
                    <button
                      className="text-link mono"
                      onClick={() =>
                        setExpanded(expanded?.hash === t.hash ? null : t)
                      }
                    >
                      {short(t.hash)}
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {expanded && (
        <section className="card space-top">
          <CardHead
            title={expanded.label}
            right={
              <button
                className="icon-button"
                aria-label="Close transaction details"
                onClick={() => setExpanded(null)}
              >
                <X size={18} />
              </button>
            }
          />
          <code className="long-code">{expanded.hash}</code>
          <p>
            Block {expanded.block} · {expanded.role} · successful receipt on
            chain {s.network.chainId}
          </p>
          <CopyButton value={expanded.hash} label="Copy transaction hash" />
          <p className="fine-print">
            {s.network.chainId === 31337 ? (
              "Local RPC: http://127.0.0.1:8545 · No public explorer"
            ) : (
              <a
                href={`https://sepolia.arbiscan.io/tx/${expanded.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View confirmed transaction on Arbiscan ↗
              </a>
            )}
          </p>
        </section>
      )}
    </>
  );
}
