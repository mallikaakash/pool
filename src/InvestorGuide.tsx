import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Info, X } from "lucide-react";
import type { Snapshot } from "./types";

export const WalletUX = createContext<{
  connected: boolean;
  pending: boolean;
} | null>(null);
export const useWalletUX = () => useContext(WalletUX);

export function InvestorGuide({
  s,
  account,
  busy,
  connect,
  faucet,
  navigate,
  deposit,
}: {
  s: Snapshot;
  account?: string;
  busy: boolean;
  connect: () => void;
  faucet: () => void;
  navigate: (page: string) => void;
  deposit: () => void;
}) {
  const connected = Boolean(account);
  const funded = connected && s.investor.cash > 0;
  const deposited =
    connected && (s.investor.shares > 0 || s.yield.pt > 0 || s.yield.yt > 0);
  const split = connected && (s.yield.pt > 0 || s.yield.yt > 0);
  const steps = [
    {
      title: "Connect your wallet",
      detail: "Use MetaMask on Arbitrum Sepolia. Test ETH pays network fees.",
      done: connected,
      action: connect,
      label: "Connect to start",
    },
    {
      title: "Get test dollars",
      detail:
        "Already have tUSD? Use your balance. Otherwise claim free test tokens.",
      done: funded || deposited,
      action: faucet,
      label: "Get test dollars",
    },
    {
      title: "Deposit into the pool",
      detail:
        "Receive pCREDIT: shares in the lending vault. Borrower interest grows their value.",
      done: deposited,
      action: deposit,
      label: "Go to deposit",
    },
    {
      title: "Explore principal + yield",
      detail:
        "Optional: split your lending position into PT and YT in Yield lab.",
      done: split,
      action: () => navigate("yield"),
      label: "Open Yield lab",
    },
  ];
  const next = steps.findIndex((step) => !step.done);
  return (
    <section className="investor-guide" aria-labelledby="guide-title">
      <div className="guide-heading">
        <div>
          <span className="eyebrow">INVESTOR WALKTHROUGH</span>
          <h2 id="guide-title">
            {next === -1
              ? "Your position is ready to explore."
              : "Your first lending position, step by step."}
          </h2>
        </div>
        <span className="guide-counter">
          {steps.filter((step) => step.done).length} / 4 ready
        </span>
      </div>
      <ol className="guide-steps">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className={`${step.done ? "is-complete" : ""} ${next === i ? "is-current" : ""}`}
            aria-current={next === i ? "step" : undefined}
          >
            <span className="guide-number">
              {step.done ? <Check size={15} /> : i + 1}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              {next === i && (
                <button
                  className="text-link"
                  disabled={
                    busy ||
                    (i > 0 && !connected) ||
                    (i === 3 && s.yield.expired)
                  }
                  onClick={step.action}
                >
                  {i === 3 && s.yield.expired
                    ? "This series has matured"
                    : step.label}
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!connected && (
        <p className="guide-preview">
          You are browsing live testnet data. The example investor’s balances
          are a preview, not your wallet.
        </p>
      )}
    </section>
  );
}

export function Disclosures() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <>
      <button className="disclosures-link" onClick={() => setOpen(true)}>
        <Info size={15} /> Important disclosures
      </button>
      <dialog
        ref={dialog}
        className="disclosures-dialog"
        aria-labelledby="disclosure-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="dialog-title">
          <h2 id="disclosure-title">Before you use Pool</h2>
          <button
            autoFocus
            aria-label="Close disclosures"
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <dl>
          <div>
            <dt>Test funds only</dt>
            <dd>
              All tUSD amounts represent tokens with no monetary value. The five
              invoices are synthetic. No real business is being financed.
            </dd>
          </div>
          <div>
            <dt>What you own</dt>
            <dd>
              pCREDIT is a share in a lending vault, not direct invoice
              ownership. PT represents principal exposure; YT represents future
              lending yield. PT is not capital protected.
            </dd>
          </div>
          <div>
            <dt>What creates income</dt>
            <dd>
              Borrowers pay interest. The demo uses a fixed 12% annual borrowing
              rate. The lender rate varies with utilization; the displayed APY
              is an estimate, not a promised return.
            </dd>
          </div>
          <div>
            <dt>Liquidity and losses</dt>
            <dd>
              Cash withdrawals need available Morpho liquidity. A secondary
              trade needs a funded buyer. Credit losses can reduce the lending
              position’s value.
            </dd>
          </div>
          <div>
            <dt>What the proof establishes</dt>
            <dd>
              The attestor signed a portfolio commitment. This does not prove
              offchain ownership, enforceability or payment. Source-verified
              contracts are not independently audited.
            </dd>
          </div>
          <div>
            <dt>Who operates the demo</dt>
            <dd>
              Pool operates these Morpho and Pendle instances on Arbitrum
              Sepolia. The configured operator also provides seed liquidity and
              acts as the demo secondary buyer.
            </dd>
          </div>
        </dl>
      </dialog>
    </>
  );
}
