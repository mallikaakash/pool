import { useEffect, useState, useRef, useMemo } from "react";
import {
  hashTypedData,
  verifyTypedData,
  keccak256,
  stringToHex,
  parseUnits,
  decodeEventLog,
  type Address,
  type Hex,
} from "viem";
import {
  Overview,
  Receivables,
  YieldLab,
  Servicing,
  ActivityPage,
} from "./App";
import type { Snapshot, Transaction } from "./types";
import {
  client,
  connect,
  wallet,
  ensureChain,
  chain,
  read,
  send,
  approve,
  artifact,
  publicSnapshot,
  publicAction,
  validateManifest,
  type Manifest,
} from "./lib/public-client";
import { newManifest, runDeployment } from "./lib/deployment.mjs";
import {
  claimDomain,
  claimTypes,
  revokeTypes,
  bidDomain,
  bidTypes,
  portfolioRoot,
  json,
} from "./lib/claims.mjs";
import config from "../config/arbitrum-sepolia.json";
import "./testnet.css";
const storage = "pool.testnet.deployment.v1";
const short = (s?: string) =>
  s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "Disconnected";
function download(name: string, data: string) {
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function errorText(e: unknown) {
  return (
    (e as { shortMessage?: string; message?: string }).shortMessage ??
    (e as Error).message ??
    String(e)
  );
}
function checked(m: Manifest) {
  if (m.schema !== 1 || m.chainId !== chain.id)
    throw Error("This bundle is not an Arbitrum Sepolia Pool release.");
  for (const [role, address] of Object.entries(config.roles))
    if (m.roles?.[role]?.toLowerCase() !== address.toLowerCase())
      throw Error(`Unexpected ${role} wallet in bundle.`);
  if (
    m.claim &&
    (m.claim.pool !== m.addresses.ReceivablePool ||
      m.claim.currency !== m.addresses.TestDollar ||
      m.uid !==
        hashTypedData({
          domain: claimDomain(chain.id, m.addresses.AttestationRegistry),
          types: claimTypes,
          primaryType: "Claim",
          message: m.claim,
        }))
  )
    throw Error("Claim target or UID mismatch.");
  if (m.evidence) {
    if (m.claim?.root !== portfolioRoot(m.evidence.entries))
      throw Error("Portfolio commitment mismatch.");
    m.evidence.entries.forEach((e, i) => {
      if (e.evidence !== keccak256(stringToHex(m.evidence!.documents[i])))
        throw Error(`Evidence document ${i + 1} has changed.`);
    });
  }
  return m;
}
function saved() {
  try {
    const raw = localStorage.getItem(storage);
    return raw ? checked(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export default function TestnetApp() {
  const [m, setM] = useState<Manifest | null>(saved),
    [account, setAccount] = useState<Address>(),
    [s, setS] = useState<Snapshot | null>(null);
  const [page, setPage] = useState(location.hash.slice(1) || "overview"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0);
  const [bid, setBid] = useState<BidPacket | null>(null),
    [eligibility, setEligibility] = useState<boolean | null>(null),
    [artifacts, setArtifacts] = useState<Record<string, unknown> | null>(null);
  const [shortSeries, setShortSeries] = useState(false);
  const activeM = useMemo(
    () =>
      m && shortSeries && m.maturity
        ? {
            ...m,
            expiry: m.maturity.expiry,
            addresses: { ...m.addresses, ...m.maturity.addresses },
            codeHashes: { ...m.codeHashes, ...m.maturity.codeHashes },
          }
        : m,
    [m, shortSeries],
  );
  const guard = useRef(false),
    history = useRef<Transaction[]>([]);
  const persist = (value: Manifest) => {
    const copy = JSON.parse(json(value));
    localStorage.setItem(storage, json(copy));
    setM(copy);
  };
  const work = async (fn: () => Promise<unknown>) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      setTick((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const navigate = (p: string) => {
    location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const fn = () => setPage(location.hash.slice(1) || "overview");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    let disposed = false;
    if (!m)
      fetch("/deployment.json", { cache: "no-cache" })
        .then((r) => r.json())
        .then((value) => {
          if (!disposed && value.status === "ready") setM(checked(value));
        })
        .catch((e) => {
          if (!disposed) setError(errorText(e));
        });
    return () => {
      disposed = true;
    };
  }, [m]);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const changed = () => {
      setAccount(undefined);
      setS(null);
      setNotice("Wallet changed. Connect again to refresh your position.");
    };
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", changed);
    return () => {
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("chainChanged", changed);
    };
  }, []);
  useEffect(() => {
    if (!m || m.status !== "ready" || busy) return;
    let disposed = false,
      running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        await validateManifest(m);
        const [state, valid] = await Promise.all([
          publicSnapshot(activeM!, account),
          read(m, "AttestationRegistry", "isValid", [m.uid]),
        ]);
        state.transactions = [...history.current, ...(m.transactions ?? [])]
          .filter((t, i, a) => a.findIndex((x) => x.hash === t.hash) === i)
          .sort((a, b) => b.block - a.block);
        if (!disposed) {
          setS(state as Snapshot);
          setEligibility(Boolean(valid));
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(errorText(e));
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [m, activeM, account, busy, tick]);
  const act = async (name: string, args: Record<string, unknown> = {}) =>
    work(async () => {
      if (!m || !account)
        throw Error("Connect MetaMask to perform this action.");
      const hash = await publicAction(activeM!, account, name, args, setNotice);
      const receipt = await client.getTransactionReceipt({ hash });
      history.current.unshift({
        hash,
        label: name,
        role: short(account),
        block: Number(receipt.blockNumber),
        time: Number(
          (await client.getBlock({ blockNumber: receipt.blockNumber }))
            .timestamp,
        ),
        status: "success",
      });
      setNotice(`Confirmed ${name} · ${hash}`);
    });
  const importBundle = async (file: File) =>
    work(async () => {
      const value = checked(JSON.parse(await file.text()));
      await validateManifest(value);
      if (
        m?.addresses.ReceivablePool &&
        value.addresses.ReceivablePool !== m.addresses.ReceivablePool
      )
        throw Error(
          "A different pool is already selected. Use a separate browser profile for a separate deployment.",
        );
      if (
        value.signature &&
        !(await verifyTypedData({
          address: value.roles.attestor,
          domain: claimDomain(chain.id, value.addresses.AttestationRegistry),
          types: claimTypes,
          primaryType: "Claim",
          message: value.claim!,
          signature: value.signature,
        }))
      )
        throw Error("Invalid attestor signature.");
      persist(value);
      setNotice("Bundle verified and imported.");
    });
  const deploy = (prepareMaturity = false) =>
    work(async () => {
      if (!account) throw Error("Connect the operator wallet first.");
      const current = m ?? newManifest(config);
      let compiled = artifacts;
      if (!compiled) {
        const response = await fetch("/setup/artifacts.json");
        if (!response.ok) throw Error("Deployment artifacts unavailable.");
        compiled = await response.json();
        setArtifacts(compiled);
      }
      await runDeployment({
        client,
        wallet: wallet(),
        artifacts: compiled,
        manifest: current,
        save: persist,
        progress: setNotice,
        prepareMaturity,
      });
    });
  const sign = () =>
    work(async () => {
      if (!m?.claim || !account)
        throw Error(
          "Import the prepared deployment bundle and connect the attestor wallet.",
        );
      if (account.toLowerCase() !== m.roles.attestor.toLowerCase())
        throw Error("Connect the designated attestor.");
      await ensureChain();
      const signature = await wallet().signTypedData({
        account,
        domain: claimDomain(chain.id, m.addresses.AttestationRegistry),
        types: claimTypes,
        primaryType: "Claim",
        message: m.claim,
      });
      const value = { ...m, signature };
      persist(value);
      download("pool-signed-attestation.json", json(value));
      setNotice(
        "Attestation signed. Send the exported bundle to the operator to publish.",
      );
    });
  const nav = [
    "overview",
    "receivables",
    "yield",
    "trade",
    "servicing",
    "evidence",
    "activity",
    "setup",
  ];
  return (
    <div className="app-shell testnet-app">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          pool<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">PUBLIC TESTNET</div>
        <nav aria-label="Main navigation">
          {nav.map((p) => (
            <button
              key={p}
              className={page === p ? "nav-active" : ""}
              onClick={() => navigate(p)}
            >
              {p === "yield" ? "Yield lab" : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-box">
            ◈ Arbitrum Sepolia
            <small>Real transactions · synthetic assets</small>
          </div>
          <p>Morpho · Pendle · Pool attestations</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <b>Pool / {page}</b>
          <div className="topbar-right">
            <span>Arbitrum Sepolia</span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void work(async () => {
                  const a = await connect();
                  setAccount(a);
                  setNotice(`Connected ${a}`);
                })
              }
            >
              {account ? short(account) : "Connect MetaMask"}
            </button>
          </div>
        </header>
        <main>
          <div className="environment-strip">
            <span>TESTNET SHOWCASE</span>
            <p>
              Synthetic receivables · test dollars · Pool-operated protocol
              instances
            </p>
          </div>
          {notice && (
            <div className="note" role="status">
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="note warning" role="alert">
              <span>
                {error}
                {s ? " Displayed balances may be stale." : ""}
              </span>
            </div>
          )}
          {page === "setup" ? (
            <>
              <section className="page-heading compact">
                <div>
                  <span className="eyebrow">OPERATOR WORKSPACE</span>
                  <h1>Deploy. Attest. Publish.</h1>
                  <p>
                    Each transaction is reviewed in MetaMask. Completed steps
                    survive a refresh.
                  </p>
                </div>
              </section>
              <section className="card">
                <h2>Release status: {m?.status ?? "not deployed"}</h2>
                <p>
                  Operator {config.roles.operator}
                  <br />
                  Attestor {config.roles.attestor}
                  <br />
                  Investor {config.roles.investor}
                </p>
                <div className="release-actions">
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !account ||
                      account.toLowerCase() !==
                        config.roles.operator.toLowerCase() ||
                      m?.status === "ready"
                    }
                    onClick={() => void deploy()}
                  >
                    {m?.status === "awaiting_attestation"
                      ? "Publish attestation & finish setup"
                      : "Prepare / resume deployment"}
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      busy ||
                      !account ||
                      account.toLowerCase() !==
                        config.roles.operator.toLowerCase() ||
                      m?.status !== "ready" ||
                      Boolean(m?.maturity)
                    }
                    onClick={() => void deploy(true)}
                  >
                    Prepare real-time maturity demo
                  </button>
                  <button
                    className="secondary"
                    disabled={!m}
                    onClick={() => download("pool-deployment.json", json(m))}
                  >
                    Export deployment bundle
                  </button>
                  <label className="secondary file-label">
                    Import deployment bundle
                    <input
                      type="file"
                      accept=".json"
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void importBundle(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p>
                  Prepare contracts first. Export the bundle, have the attestor
                  import and sign it, then import the signed bundle here and
                  resume. Export the final manifest for the public frontend.
                </p>
                <p>
                  The operator supplies 375,000 test dollars. The investor
                  receives 75,000 test dollars; their deposit and the operator’s
                  borrowing remain visible wallet actions.
                </p>
                <ol>
                  {Object.keys(m?.steps ?? {}).map((label) => (
                    <li key={label}>{label} ✓</li>
                  ))}
                </ol>
              </section>
            </>
          ) : page === "evidence" ? (
            <Evidence
              m={m}
              account={account}
              valid={eligibility}
              busy={busy}
              sign={sign}
              work={work}
              notice={setNotice}
              importBundle={importBundle}
              persist={persist}
            />
          ) : !m || m.status !== "ready" ? (
            <section className="loading-card">
              <h1>The testnet release is being prepared.</h1>
              <p>
                The public contracts have not been activated in this release
                yet.
              </p>
              <button className="primary" onClick={() => navigate("setup")}>
                Open deployment workspace
              </button>
              <a href="#evidence">Review or sign an attestation</a>
            </section>
          ) : !s ? (
            <section className="loading-card">
              <h1>Reading the public contracts…</h1>
              <button
                className="secondary"
                onClick={() => setTick((n) => n + 1)}
              >
                Retry
              </button>
            </section>
          ) : (
            <>
              {eligibility === false && (
                <div className="note warning">
                  Attestation expired or revoked. New borrowing is blocked;
                  repayments remain available.
                </div>
              )}
              {!account && (
                <div className="note">
                  Viewing the configured investor’s position. Connect your
                  wallet to view and transact with your own funds.
                </div>
              )}
              {page === "overview" && (
                <>
                  <button
                    className="secondary"
                    disabled={busy || !account}
                    onClick={() => void act("faucet")}
                  >
                    Claim 10,000 test dollars · once per day
                  </button>
                  <Overview
                    s={s}
                    act={act}
                    busy={busy || !account}
                    navigate={navigate}
                  />
                </>
              )}
              {page === "receivables" && <Receivables s={s} />}
              {page === "yield" && (
                <>
                  {m.maturity && (
                    <label className="note">
                      <input
                        type="checkbox"
                        checked={shortSeries}
                        onChange={(e) => {
                          setS(null);
                          setShortSeries(e.target.checked);
                        }}
                      />{" "}
                      View prepared short-maturity series · expires{" "}
                      {new Date(m.maturity.expiry * 1000).toLocaleString()}
                    </label>
                  )}
                  <YieldLab s={s} act={act} busy={busy || !account} />
                </>
              )}
              {page === "servicing" && (
                <>
                  <div className="note">
                    Operator actions require {short(m.roles.operator)}.
                    Repayment and liquidations are permissionless. Time advances
                    naturally on this network.
                  </div>
                  <Servicing s={s} act={act} busy={busy || !account} />
                </>
              )}
              {page === "trade" && (
                <Trade
                  m={m}
                  account={account}
                  busy={busy}
                  work={work}
                  notice={setNotice}
                  bid={bid}
                  setBid={setBid}
                />
              )}
              {page === "activity" && (
                <>
                  <ActivityPage s={s} />
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void work(async () => {
                        history.current = await recentEvents(m);
                        setNotice(
                          "Loaded recent on-chain events (up to 10,000 blocks).",
                        );
                      })
                    }
                  >
                    Refresh public event history
                  </button>
                </>
              )}
              <footer>
                <span>
                  Block {s.network.block} ·{" "}
                  {new Date(s.network.timestamp * 1000).toLocaleString()}
                </span>
                <button
                  className="secondary"
                  onClick={() => setTick((n) => n + 1)}
                >
                  Refresh
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function Evidence({
  m,
  account,
  valid,
  busy,
  sign,
  work,
  notice,
  importBundle,
  persist,
}: {
  m: Manifest | null;
  account?: Address;
  valid: boolean | null;
  busy: boolean;
  sign: () => Promise<void>;
  work: (fn: () => Promise<unknown>) => Promise<void>;
  notice: (s: string) => void;
  importBundle: (f: File) => Promise<void>;
  persist: (m: Manifest) => void;
}) {
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">PUBLIC CLAIMS / INSPECTABLE EVIDENCE</span>
          <h1>Who attested to what?</h1>
          <p>
            Signatures identify the claimant. They do not establish external
            ownership or debtor payment.
          </p>
        </div>
      </section>
      <section className="card">
        <label className="secondary file-label">
          Import bundle to review
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void importBundle(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        {!m?.claim ? (
          <p>
            Prepare a deployment or import its evidence bundle to review the
            claim.
          </p>
        ) : (
          <>
            <h2>
              {valid === true
                ? "Active onchain attestation"
                : valid === false
                  ? "Inactive attestation"
                  : m.signature
                    ? "Signed · publication not yet checked"
                    : "Awaiting attestor signature"}
            </h2>
            <p>Attestor: {m.roles.attestor}</p>
            <p>
              Valid until:{" "}
              {new Date(Number(m.claim.validUntil) * 1000).toLocaleString()}
            </p>
            <p>
              Claim UID: <code>{m.uid}</code>
            </p>
            <pre>{json(m.claim)}</pre>
            <div className="release-actions">
              <button
                className="primary"
                disabled={
                  busy ||
                  !account ||
                  account.toLowerCase() !== m.roles.attestor.toLowerCase()
                }
                onClick={() => void sign()}
              >
                Sign reviewed portfolio
              </button>
              <button
                className="secondary"
                onClick={() => download("pool-evidence-bundle.json", json(m))}
              >
                Download full evidence bundle
              </button>
              <button
                className="secondary danger"
                disabled={
                  busy ||
                  !account ||
                  account.toLowerCase() !== m.roles.attestor.toLowerCase() ||
                  valid !== true
                }
                onClick={() =>
                  void work(async () => {
                    await ensureChain();
                    const message = {
                      uid: m.uid!,
                      deadline: (
                        (await client.getBlock()).timestamp + 3600n
                      ).toString(),
                    };
                    const signature = await wallet().signTypedData({
                      account: account!,
                      domain: claimDomain(
                        chain.id,
                        m.addresses.AttestationRegistry,
                      ),
                      types: revokeTypes,
                      primaryType: "Revoke",
                      message,
                    });
                    const value = {
                      ...m,
                      revocation: { ...message, signature },
                    };
                    persist(value);
                    download("pool-revocation.json", json(value));
                    notice(
                      "Revocation signed. Operator can publish it without funding the attestor wallet.",
                    );
                  })
                }
              >
                Sign eligibility revocation
              </button>
              {m.revocation && (
                <button
                  className="secondary danger"
                  disabled={busy || !account || valid !== true}
                  onClick={() =>
                    void work(async () => {
                      const hash = await send(
                        m,
                        account!,
                        "AttestationRegistry",
                        "revokeSigned",
                        [
                          m.revocation!.uid,
                          BigInt(m.revocation!.deadline),
                          m.revocation!.signature,
                        ],
                        notice,
                      );
                      notice(`Revocation confirmed: ${hash}`);
                    })
                  }
                >
                  Publish signed revocation
                </button>
              )}
            </div>
            <p>
              All five invoices are synthetic. Signing endorses this exact demo
              portfolio commitment. Review the documents before signing.
            </p>
            <div className="contract-list">
              {m.evidence?.documents.map((document, i) => (
                <div key={i}>
                  <span>
                    Invoice SG-00{i + 1} ·{" "}
                    {short(String(m.evidence!.entries[i].evidence))}
                  </span>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(`synthetic-invoice-${i + 1}.json`, document)
                    }
                  >
                    Download exact bytes
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      {m && (
        <section className="card space-top">
          <h2>Public contracts</h2>
          <div className="contract-list">
            {Object.entries(m.addresses).map(([name, address]) => (
              <div key={name}>
                <span>{name}</span>
                <a
                  href={`https://sepolia.arbiscan.io/address/${address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(address)} ↗
                </a>
                {!name.startsWith("PendleCode") && (
                  <a
                    href={`https://repo.sourcify.dev/421614/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${name} source on Sourcify`}
                  >
                    Source ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
interface BidPacket {
  bid: {
    maker: Address;
    taker: Address;
    token: Address;
    amount: string;
    payment: string;
    deadline: string;
    nonce: string;
  };
  signature: Hex;
  chainId: number;
  market: Address;
}
function Trade({
  m,
  account,
  busy,
  work,
  notice,
  bid,
  setBid,
}: {
  m: Manifest;
  account?: Address;
  busy: boolean;
  work: (f: () => Promise<unknown>) => Promise<void>;
  notice: (s: string) => void;
  bid: BidPacket | null;
  setBid: (b: BidPacket) => void;
}) {
  const [token, setToken] = useState("PendleYieldToken"),
    [amount, setAmount] = useState("1000"),
    [payment, setPayment] = useState("5"),
    [taker, setTaker] = useState(m.roles.investor),
    [imported, setImported] = useState("");
  const verify = async (packet: BidPacket) => {
    if (
      packet.chainId !== chain.id ||
      packet.market.toLowerCase() !== m.addresses.QuoteMarket.toLowerCase()
    )
      throw Error("Quote targets a different network or market.");
    if (
      ![m.addresses.PendleYieldToken, m.addresses.PendlePrincipalToken].some(
        (a) => a.toLowerCase() === packet.bid.token.toLowerCase(),
      )
    )
      throw Error("Unsupported quote token.");
    if (
      !(await verifyTypedData({
        address: packet.bid.maker,
        domain: bidDomain(chain.id, packet.market),
        types: bidTypes,
        primaryType: "Bid",
        message: packet.bid,
        signature: packet.signature,
      }))
    )
      throw Error("Invalid quote signature.");
  };
  return (
    <>
      <section className="page-heading compact">
        <div>
          <span className="eyebrow">FIXED-SIZE SECONDARY TRADE</span>
          <h1>Sell the yield. Receive cash.</h1>
          <p>
            A signed bid exchanges PT or YT for test dollars atomically. No AMM
            or guaranteed liquidity.
          </p>
        </div>
      </section>
      <div className="lower-grid">
        <section className="card">
          <h2>Create a bid to buy</h2>
          <p>
            The connected maker funds the purchase. The named seller receives
            the payment.
          </p>
          <label>
            Token
            <select value={token} onChange={(e) => setToken(e.target.value)}>
              <option value="PendleYieldToken">YT</option>
              <option value="PendlePrincipalToken">PT</option>
            </select>
          </label>
          <label>
            Seller wallet
            <input
              value={taker}
              onChange={(e) => setTaker(e.target.value as Address)}
            />
          </label>
          <label>
            Token amount
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Total payment (tUSD)
            <input
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !account}
            onClick={() =>
              void work(async () => {
                if (!account) throw Error("Connect the quote maker.");
                const cash = parseUnits(payment, 6),
                  quantity = parseUnits(amount, 6);
                if (cash <= 0n || quantity <= 0n)
                  throw Error("Amounts must be positive.");
                if (
                  ((await read(m, "TestDollar", "balanceOf", [
                    account,
                  ])) as bigint) < cash
                )
                  throw Error("Insufficient test-dollar balance for this bid.");
                await approve(
                  m,
                  account,
                  "TestDollar",
                  m.addresses.QuoteMarket,
                  cash,
                  notice,
                );
                const now = (await client.getBlock()).timestamp;
                const b = {
                  maker: account,
                  taker,
                  token: m.addresses[token],
                  amount: quantity.toString(),
                  payment: cash.toString(),
                  deadline: (now + 3600n).toString(),
                  nonce: BigInt(
                    `0x${crypto.randomUUID().replaceAll("-", "")}`,
                  ).toString(),
                };
                await ensureChain();
                const signature = await wallet().signTypedData({
                  account,
                  domain: bidDomain(chain.id, m.addresses.QuoteMarket),
                  types: bidTypes,
                  primaryType: "Bid",
                  message: b,
                });
                const packet = {
                  bid: b,
                  signature,
                  chainId: chain.id,
                  market: m.addresses.QuoteMarket,
                };
                setBid(packet);
                download("pool-bid.json", json(packet));
                notice(
                  "Bid signed; expires in one hour. Share the downloaded quote with the seller.",
                );
              })
            }
          >
            Approve payment & sign bid
          </button>
        </section>
        <section className="card">
          <h2>Review and fill a bid</h2>
          <label>
            Signed bid JSON
            <textarea
              rows={5}
              value={imported}
              onChange={(e) => setImported(e.target.value)}
            />
          </label>
          <label className="secondary file-label">
            Load bid file
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void work(async () => setImported(await f.text()));
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="secondary"
            disabled={busy || !imported}
            onClick={() =>
              void work(async () => {
                const value = JSON.parse(imported);
                await verify(value);
                setBid(value);
                notice(
                  "Signature verified. Funding, expiry and allowance will be checked when filling.",
                );
              })
            }
          >
            Verify quote
          </button>
          {bid && (
            <>
              <pre>{json(bid.bid)}</pre>
              <p>
                {Number(bid.bid.amount) / 1e6} tokens for{" "}
                {Number(bid.bid.payment) / 1e6} tUSD total. Expires{" "}
                {new Date(Number(bid.bid.deadline) * 1000).toLocaleString()}.
              </p>
              <button
                className="primary"
                disabled={
                  busy ||
                  !account ||
                  account.toLowerCase() !== bid.bid.taker.toLowerCase()
                }
                onClick={() =>
                  void work(async () => {
                    await verify(bid);
                    const name =
                      bid.bid.token.toLowerCase() ===
                      m.addresses.PendleYieldToken.toLowerCase()
                        ? "PendleYieldToken"
                        : "PendlePrincipalToken";
                    await client.simulateContract({
                      account: account!,
                      address: m.addresses.QuoteMarket,
                      abi: artifact("QuoteMarket").abi,
                      functionName: "digest",
                      args: [bid.bid],
                    });
                    await approve(
                      m,
                      account!,
                      name,
                      m.addresses.QuoteMarket,
                      BigInt(bid.bid.amount),
                      notice,
                    );
                    const hash = await send(
                      m,
                      account!,
                      "QuoteMarket",
                      "fill",
                      [bid.bid, bid.signature],
                      notice,
                    );
                    notice(`Trade confirmed: ${hash}`);
                  })
                }
              >
                Sell tokens for test dollars
              </button>
              <button
                className="secondary"
                disabled={
                  busy ||
                  !account ||
                  account.toLowerCase() !== bid.bid.maker.toLowerCase()
                }
                onClick={() =>
                  void work(async () => {
                    const hash = await send(
                      m,
                      account!,
                      "QuoteMarket",
                      "cancel",
                      [BigInt(bid.bid.nonce)],
                      notice,
                    );
                    notice(`Bid cancelled: ${hash}`);
                  })
                }
              >
                Cancel my bid
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
async function recentEvents(m: Manifest) {
  const latest = await client.getBlockNumber(),
    start =
      latest - 10000n > BigInt(m.deploymentBlock ?? 0)
        ? latest - 10000n
        : BigInt(m.deploymentBlock ?? 0),
    transactions = new Map<string, Transaction>();
  for (let from = start; from <= latest; from += 1000n) {
    const logs = await client.getLogs({
      address: [...new Set(Object.values(m.addresses))],
      fromBlock: from,
      toBlock: from + 999n < latest ? from + 999n : latest,
    });
    for (const log of logs) {
      if (!log.transactionHash || !log.blockNumber) continue;
      const name = Object.keys(m.addresses).find(
        (n) => m.addresses[n].toLowerCase() === log.address.toLowerCase(),
      );
      if (!name) continue;
      try {
        const event = decodeEventLog({
          abi: artifact(name).abi,
          data: log.data,
          topics: log.topics,
        });
        transactions.set(log.transactionHash, {
          hash: log.transactionHash,
          label: `${name} · ${event.eventName}`,
          role: "onchain event",
          block: Number(log.blockNumber),
          time: 0,
          status: "success",
        });
      } catch {
        /* Upstream events outside the ABI do not affect balances. */
      }
    }
  }
  const result = [...transactions.values()]
    .sort((a, b) => b.block - a.block)
    .slice(0, 80);
  await Promise.all(
    result.map(async (t) => {
      t.time = Number(
        (await client.getBlock({ blockNumber: BigInt(t.block) })).timestamp,
      );
    }),
  );
  return result;
}
