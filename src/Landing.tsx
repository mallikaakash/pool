import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Pause,
  X,
  ShieldCheck,
  Layers,
  Split,
  FileCheck2,
  CircleDollarSign,
  Fingerprint,
} from "lucide-react";
import type { Snapshot } from "./types";

const cash = (value?: number) =>
  value === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        value,
      );
export default function Landing({
  s,
  eligibility,
  navigate,
}: {
  s: Snapshot | null;
  eligibility: boolean | null;
  navigate: (page: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(false);
  const [filmOpen, setFilmOpen] = useState(false);
  const showFilm = () => setFilmOpen(true);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const sync = () => {
      if (preference.matches || !visible) el.pause();
      else void el.play().catch(() => {});
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    preference.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", sync);
      el.pause();
    };
  }, []);
  useEffect(() => {
    if (!filmOpen) return;
    const el = dialog.current;
    el?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    video.current?.pause();
    return () => {
      el?.close();
      document.body.style.overflow = previous;
    };
  }, [filmOpen]);
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-copy">
          <span className="lime-label">
            <i /> Real cash flows. New possibilities.
          </span>
          <h1 id="hero-title">
            Trade credit,
            <br />
            <span>made composable.</span>
          </h1>
          <p>
            Finance a portfolio of receivables. Hold the lending position, or
            separate principal from future yield. All in one onchain flow.
          </p>
          <div className="landing-actions">
            <button
              className="round-cta white-cta"
              onClick={() => navigate("overview")}
            >
              Explore the pool{" "}
              <span>
                <ArrowUpRight size={18} />
              </span>
            </button>
            <button className="round-cta outline-cta" onClick={showFilm}>
              Watch the film{" "}
              <span>
                <Play size={15} fill="currentColor" />
              </span>
            </button>
          </div>
          <div className="hero-position-label">
            <span>ONE POSITION. MORE POSSIBILITIES.</span>
            <span>PT / YT</span>
          </div>
          <button className="position-teaser" onClick={() => navigate("yield")}>
            <div className="teaser-art" aria-hidden="true">
              <div className="token-disc principal-disc">PT</div>
              <div className="token-disc yield-disc">YT</div>
              <div className="disc-orbit" />
            </div>
            <div className="teaser-bottom">
              <div>
                <span className="tiny-lime">PRINCIPAL + YIELD</span>
                <strong>A different way to hold.</strong>
                <small>Explore the components of your credit position</small>
              </div>
              <span className="teaser-arrow">
                <ArrowUpRight size={20} />
              </span>
            </div>
          </button>
          <div className="hero-built">
            <span>BUILT WITH</span>
            <b>
              <span className="protocol-glyph">◇</span> Morpho
            </b>
            <b>
              <Split size={16} /> Pendle
            </b>
            <b>
              <span className="protocol-glyph">◈</span> Arbitrum
            </b>
          </div>
        </div>
        <div className="hero-media">
          <div className="hero-media-top">
            <button className="watch-chip" onClick={showFilm}>
              <Play size={15} fill="currentColor" /> Watch the film{" "}
              <span>1:08</span>
            </button>
            <span className="testnet-pill">
              <i /> PUBLIC TESTNET
            </span>
          </div>
          <div className="hero-video-wrap">
            <video
              ref={video}
              muted
              loop
              playsInline
              preload="metadata"
              poster="/film/pool-hero-poster.png?v=3"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              aria-label="Pool film showing receivables financing and principal/yield separation"
            >
              <source src="/film/pool-hero.mp4?v=3" type="video/mp4" />
            </video>
          </div>
          <div className="hero-media-bottom">
            <div className="media-caption">
              <span>
                FROM RECEIVABLE
                <br />
                TO LENDING POSITION.
              </span>
              <p>
                Attest. Finance.
                <br />
                <em>Compose.</em>
              </p>
              <button
                className="motion-control"
                aria-label={
                  playing ? "Pause hero animation" : "Play hero animation"
                }
                onClick={() => {
                  if (video.current?.paused)
                    void video.current.play().catch(() => {});
                  else video.current?.pause();
                }}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
                <span>{playing ? "Pause motion" : "Play motion"}</span>
              </button>
            </div>
            <div className="live-pool-card" aria-label="Live pool status">
              <div className="live-card-title">
                <span>Pool, right now</span>
                <button
                  aria-label="Open live pool"
                  onClick={() => navigate("overview")}
                >
                  <ArrowUpRight size={23} />
                </button>
              </div>
              <div className="live-number">
                <strong>{cash(s?.market.totalSupply)}</strong>
                <span>tUSD supplied</span>
              </div>
              <div className="live-number lime">
                <strong>{cash(s?.pool.nav)}</strong>
                <span>tUSD collateral book value</span>
              </div>
              <div className="live-card-footer">
                <i />
                <span>
                  {s
                    ? `Arbitrum Sepolia · block ${s.network.block}`
                    : "Reading public contracts…"}
                </span>
              </div>
            </div>
          </div>
          <div className="media-orbit" aria-hidden="true" />
        </div>
      </section>
      <section className="landing-trust" aria-label="Deployment status">
        <span>
          <i className="status-dot" />{" "}
          {eligibility === true
            ? "Active onchain attestation"
            : eligibility === false
              ? "Attestation inactive"
              : "Checking attestation"}
        </span>
        <span>
          <ShieldCheck size={16} /> Public contract sources
        </span>
        <span>
          <Fingerprint size={16} /> Inspectable evidence
        </span>
        <button onClick={() => navigate("evidence")}>
          See the proof <ArrowUpRight size={16} />
        </button>
      </section>
      <section className="landing-how">
        <div className="section-intro">
          <span className="section-kicker">THE FLOW / 01</span>
          <h2>
            Work delivered.
            <br />
            <span>Capital keeps moving.</span>
          </h2>
          <p>
            A business needs cash before its invoices are paid. Investors supply
            the financing. Pool connects the claim, the loan, and the way
            investors hold its yield.
          </p>
        </div>
        <div className="journey-cards">
          <button onClick={() => navigate("evidence")}>
            <div className="journey-top">
              <FileCheck2 size={27} />
              <span>01</span>
            </div>
            <h3>Attest the portfolio.</h3>
            <p>
              A designated signer commits to the receivables, their values, and
              the evidence.
            </p>
            <span className="journey-link">
              Inspect the evidence <ArrowRight size={17} />
            </span>
          </button>
          <button onClick={() => navigate("overview")}>
            <div className="journey-top">
              <CircleDollarSign size={27} />
              <span>02</span>
            </div>
            <h3>Finance the business.</h3>
            <p>
              Investors supply capital through Morpho. The business borrows
              against the portfolio.
            </p>
            <span className="journey-link">
              Explore the facility <ArrowRight size={17} />
            </span>
          </button>
          <button onClick={() => navigate("yield")}>
            <div className="journey-top">
              <Split size={27} />
              <span>03</span>
            </div>
            <h3>Choose your exposure.</h3>
            <p>
              Hold lender shares, or use Pendle to separate principal from
              future yield.
            </p>
            <span className="journey-link">
              Open yield lab <ArrowRight size={17} />
            </span>
          </button>
        </div>
      </section>
      <section className="landing-facility">
        <div className="facility-visual" aria-hidden="true">
          <div className="folio folio-back" />
          <div className="folio folio-front">
            <span>POOL / SG-001</span>
            <FileCheck2 size={38} />
            <b>5 receivables.</b>
            <span>ONE ATTESTED PORTFOLIO</span>
            <div className="folio-lines">
              <i />
              <i />
              <i />
            </div>
            <small>SYNTHETIC DEMO ASSETS</small>
          </div>
          <span className="folio-seal">
            <ShieldCheck size={22} />
          </span>
        </div>
        <div className="facility-copy">
          <span className="section-kicker">THE FACILITY / 02</span>
          <h2>
            Singapore trade credit.
            <br />
            <span>Open to inspect.</span>
          </h2>
          <p>
            Five synthetic receivables. One isolated lending market. Follow the
            portfolio evidence, the capital supplied, and every confirmed
            transaction.
          </p>
          <div className="facility-mini-stats">
            <div>
              <span>Portfolio face value</span>
              <b>
                {cash(s?.pool.face)} <small>tUSD</small>
              </b>
            </div>
            <div>
              <span>Borrowed capital</span>
              <b>
                {cash(s?.market.totalBorrow)} <small>tUSD</small>
              </b>
            </div>
          </div>
          <button
            className="round-cta lime-cta"
            onClick={() => navigate("receivables")}
          >
            Inside the portfolio{" "}
            <span>
              <ArrowUpRight size={18} />
            </span>
          </button>
        </div>
      </section>
      <section className="landing-boundaries">
        <div>
          <Layers size={20} />
          <h3>A testnet showcase, with clear boundaries.</h3>
        </div>
        <p>
          Receivables and test dollars are synthetic. Morpho and Pendle
          instances are operated by Pool. Signatures identify claims; they do
          not prove offchain ownership. Returns depend on borrower payments, and
          capital can be lost. PT is not capital protected; withdrawals and
          secondary trades depend on available liquidity.
        </p>
        <button onClick={() => navigate("evidence")}>
          Review evidence & contracts <ArrowUpRight size={17} />
        </button>
      </section>
      <footer className="landing-footer">
        <a className="landing-footer-brand" href="#home">
          pool<span>.</span>
        </a>
        <span>Trade credit, composed.</span>
        <a
          href="https://github.com/mallikaakash/pool"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight size={13} />
        </a>
        <a href="/film/">
          Launch film <ArrowUpRight size={13} />
        </a>
        <span>Arbitrum Sepolia · test funds only</span>
      </footer>
      <dialog
        ref={dialog}
        className="film-dialog"
        aria-labelledby="film-dialog-title"
        onClose={() => setFilmOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setFilmOpen(false);
        }}
      >
        <div className="film-dialog-heading">
          <h2 id="film-dialog-title">Pool — credit, made composable.</h2>
          <button
            autoFocus
            onClick={() => setFilmOpen(false)}
            aria-label="Close film"
          >
            <X size={22} />
          </button>
        </div>
        {filmOpen && (
          <video
            src="/film/pool-story.mp4?v=3"
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster="/film/pool-story-poster.png?v=3"
            aria-label="68-second Pool launch film"
          />
        )}
        <div className="film-dialog-caption">
          An illustrated walkthrough · synthetic assets · see Evidence for the
          current public state.
        </div>
      </dialog>
    </div>
  );
}
