(() => {
  const names = [
    "The hook",
    "Meet Pool",
    "Follow the money",
    "Split the position",
    "Attest",
    "Deposit & borrow",
    "Trade the yield",
    "Collect & repay",
    "Public proof",
    "Explore Pool",
  ];
  const starts = [0, 3, 7, 13, 21, 29, 38, 46, 54, 62];
  const heroStarts = [0, 2.5, 5, 11];
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const capture = params.get("capture") === "1";
  let mode = params.get("mode") === "hero" ? "hero" : "story";
  let current = Number(params.get("t")) || 0;
  let playing = !capture && params.get("autoplay") !== "0" && !reduced.matches;
  let lastTimestamp = null;
  const stage = document.querySelector("#stage"),
    wrap = document.querySelector(".stage-wrap");
  const scenes = [...document.querySelectorAll(".scene")],
    chapters = document.querySelector("#chapters");
  const seek = document.querySelector("#seek"),
    play = document.querySelector("#play"),
    ticks = document.querySelector("#film-ticks");
  const duration = () => (mode === "hero" ? 20 : 68);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 1 - (1 - clamp(x)) ** 3;
  const progress = (t, start, end) => clamp((t - start) / (end - start));
  const clock = (t) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el.textContent !== text) el.textContent = text;
  };
  const format = (n) => Math.round(n).toLocaleString("en-US");
  const pathCache = new Map();
  document.body.classList.toggle("capture", capture);
  names.forEach((name, i) => {
    const b = document.createElement("button");
    b.innerHTML = `<span>${clock(starts[i])}</span>${name}`;
    b.addEventListener("click", () => {
      mode = "story";
      current = starts[i];
      lastTimestamp = null;
      render();
    });
    chapters.append(b);
    ticks.append(document.createElement("i"));
  });
  function fit() {
    const b = wrap.getBoundingClientRect();
    stage.style.transform = `scale(${Math.min(b.width / 1600, b.height / 900)})`;
  }
  function pathMotion(id, value) {
    let data = pathCache.get(id);
    if (!data) {
      const path = document.getElementById(id);
      const length = path.getTotalLength();
      const trace = document.querySelector(`[data-path="${id}"]`);
      trace.setAttribute("d", path.getAttribute("d"));
      trace.style.strokeDasharray = String(length);
      data = {
        path,
        length,
        trace,
        packet: document.querySelector(`[data-follow="${id}"]`),
      };
      pathCache.set(id, data);
    }
    const p = clamp(value),
      point = data.path.getPointAtLength(p * data.length);
    data.trace.style.strokeDashoffset = String((1 - p) * data.length);
    data.packet.style.opacity = p > 0 && p < 1 ? "1" : "0";
    if (data.packet.tagName.toLowerCase() === "circle") {
      data.packet.setAttribute("cx", point.x);
      data.packet.setAttribute("cy", point.y);
    } else
      data.packet.setAttribute("transform", `translate(${point.x},${point.y})`);
    data.packet.dataset.progress = String(p);
  }
  function reveal(el, p, y = 18) {
    el.style.opacity = String(ease(p));
    el.style.transform = `translateY(${(1 - ease(p)) * y}px)`;
  }
  function choreography(index, t) {
    if (index === 0) {
      const art = document.querySelector(".hook-art");
      art.style.transform = `translateY(${-7 * ease(t / 3)}px) rotate(${-1.5 * ease(t / 3)}deg)`;
      document.querySelector(".waiting").style.opacity = String(
        1 - 0.45 * progress(t, 0.5, 2.3),
      );
    }
    if (index === 1)
      document.querySelector(".giant-brand").style.transform =
        `scale(${0.94 + 0.06 * ease(t / 2)})`;
    if (index === 2) {
      const speed = mode === "hero" ? 6 / 6 : 1;
      const time = t * speed;
      pathMotion("capital-path", progress(time, 0.3, 1.5));
      pathMotion("borrow-path", progress(time, 1.6, 2.9));
      pathMotion("interest-path", progress(time, 3.1, 5.6));
      document.querySelector(".facility").style.boxShadow =
        time >= 1.5 ? "0 0 0 3px #a7be8255" : "none";
      document.querySelector(".business").style.boxShadow =
        time >= 2.9 ? "0 0 0 3px #dfa07b55" : "none";
      setText(
        "flow-caption",
        time < 1.6
          ? "Investors supply cash and receive lender shares."
          : time < 3.1
            ? "The business borrows against its receivables."
            : "Borrower interest generates yield for the lenders.",
      );
    }
    if (index === 3) {
      const p = progress(t, 1.1, 3.6);
      pathMotion("pt-path", p);
      pathMotion("yt-path", p);
      const arrived = p === 1;
      document.querySelector(".split-parent").style.transform =
        `scale(${1 - 0.025 * progress(t, 1.1, 3.6)})`;
      for (const [i, token] of [
        ...document.querySelectorAll(".token"),
      ].entries()) {
        reveal(token, progress(t, 2.5, 3.8));
        const pulse = arrived
          ? Math.sin(progress(t, 3.6, 4.15) * Math.PI) * 0.1
          : 0;
        token.querySelector(".coin").style.transform = `scale(${1 + pulse})`;
        token.classList.toggle("arrived", arrived);
        token.style.boxShadow = arrived
          ? `0 0 0 3px ${i ? "#e9be9b55" : "#b7ce9455"}`
          : "none";
      }
      setText(
        "split-explain",
        t < 1.1
          ? "Start with one lending position."
          : t < 3.6
            ? "Wrap it. Split it. Receive both tokens."
            : t < 5.2
              ? "PT: the principal-side claim at maturity."
              : "YT: the future yield. Transfer or sell it separately.",
      );
    }
    if (index === 4) {
      [...document.querySelectorAll(".document-rows>div")].forEach((el, i) => {
        const p = progress(t, 0.15 + i * 0.4, 0.55 + i * 0.4);
        reveal(el, p, 9);
        el.querySelector("i").style.opacity = String(
          progress(t, 0.65 + i * 0.4, 0.95 + i * 0.4),
        );
      });
      const status = t < 2.8 ? "REVIEWING" : t < 4.7 ? "SIGNED" : "ADMITTED";
      setText("attest-status", status);
      [...document.querySelectorAll(".attest-progress>span")].forEach((el, i) =>
        el.classList.toggle("complete", t > i * 2.25),
      );
      reveal(
        document.querySelector(".evidence-panel footer"),
        progress(t, 2.8, 3.3),
      );
    }
    if (index === 5) {
      setText("deposit-number", format(25000 * ease(t / 1.8)));
      setText("borrow-number", format(250000 * ease((t - 2.4) / 2)));
      document
        .querySelector(".borrowing")
        .style.setProperty("--grow", String(ease((t - 2.4) / 2)));
      reveal(document.querySelector(".fund-result"), progress(t, 1.2, 2));
      setText(
        "fund-caption",
        t < 2.4
          ? "25,000 tUSD → approximately 25,000 lender shares."
          : t < 5.4
            ? "The loan is constrained by collateral value and the lending limit."
            : "Borrower interest creates lender yield. It is not invoice discount income.",
      );
    }
    if (index === 6) {
      pathMotion("sell-path", progress(t, 1.3, 4.2));
      pathMotion("pay-path", progress(t, 1.3, 4.2));
      setText(
        "trade-confirmation",
        t < 1.3
          ? "Quote signed · balances checked"
          : t < 4.2
            ? "YT and test dollars exchange together"
            : "Settled: investor has cash + PT; buyer has YT",
      );
      document.querySelector(".trade-confirmation").style.borderColor =
        t >= 4.2 ? "#c9f28a" : "#b6d79255";
    }
    if (index === 7) {
      reveal(document.querySelector(".payment-in"), progress(t, 0, 0.5));
      [...document.querySelectorAll(".ledger-row")].forEach((el, i) =>
        reveal(el, progress(t, 0.8 + i * 1.1, 1.3 + i * 1.1)),
      );
    }
    if (index === 8) {
      document
        .querySelector(".product-crop")
        .style.setProperty("--pan", String(ease((t - 1) / 5)));
      document.querySelector(".product-window").style.transform =
        `perspective(1600px) rotateY(${-4 + 4 * ease(t / 2)}deg)`;
    }
  }
  function render() {
    current = Math.max(0, Math.min(duration(), current));
    const timeline = mode === "hero" ? heroStarts : starts;
    const index = timeline.findLastIndex((t) => current >= t);
    const local = current - timeline[index];
    stage.classList.toggle("hero", mode === "hero");
    stage.classList.toggle("is-dark", [0, 1, 6, 9].includes(index));
    scenes.forEach((scene, i) => {
      scene.classList.toggle("active", i === index);
      scene.setAttribute("aria-hidden", String(i !== index));
      if (i !== index) return;
      scene.querySelectorAll("[data-in]").forEach((el) => {
        const delay = Number(el.dataset.in) * 0.2;
        const p = reduced.matches
          ? 1
          : progress(local + 0.22, delay, delay + 0.45);
        reveal(el, p, 24);
      });
    });
    choreography(index, reduced.matches ? Math.max(local, 6) : local);
    stage.setAttribute("aria-label", `${names[index]}. Pool launch film.`);
    setText("chapter-label", names[index].toUpperCase());
    [...chapters.children].forEach((el, i) =>
      el.setAttribute("aria-current", String(i === index)),
    );
    [...ticks.children].forEach((el, i) =>
      el.classList.toggle("on", i <= index),
    );
    seek.max = duration();
    seek.value = current;
    document.querySelector("#time").value =
      `${clock(current)} / ${clock(duration())}`;
    play.textContent = playing ? "Ⅱ" : "▶";
    play.setAttribute(
      "aria-label",
      playing ? "Pause presentation" : "Play presentation",
    );
    document
      .querySelector("#story-mode")
      .setAttribute("aria-pressed", String(mode === "story"));
    document
      .querySelector("#hero-mode")
      .setAttribute("aria-pressed", String(mode === "hero"));
    setText(
      "mode-description",
      mode === "hero"
        ? "20 seconds: the problem, the capital flow, and principal/yield separation."
        : "The mechanism in 20 seconds. The evidence in 68. Illustrative actions are labeled.",
    );
  }
  function setMode(next) {
    mode = next === "hero" ? "hero" : "story";
    current = 0;
    lastTimestamp = null;
    render();
  }
  function toggle() {
    if (current >= duration()) current = 0;
    playing = !playing;
    lastTimestamp = null;
    render();
  }
  play.addEventListener("click", toggle);
  document.querySelector("#restart").addEventListener("click", () => {
    current = 0;
    lastTimestamp = null;
    render();
  });
  document
    .querySelector("#story-mode")
    .addEventListener("click", () => setMode("story"));
  document
    .querySelector("#hero-mode")
    .addEventListener("click", () => setMode("hero"));
  document.querySelector("#fullscreen").addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrap.requestFullscreen();
  });
  seek.addEventListener("input", () => {
    current = Number(seek.value);
    lastTimestamp = null;
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,button,a")) return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    }
    if (["ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
      current += e.code === "ArrowRight" ? 3 : -3;
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    lastTimestamp = null;
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) playing = false;
    render();
  });
  new ResizeObserver(fit).observe(wrap);
  function tick(ts) {
    if (playing && !document.hidden) {
      if (lastTimestamp !== null)
        current += Math.min(0.1, (ts - lastTimestamp) / 1000);
      if (current >= duration()) {
        if (mode === "hero") current %= duration();
        else {
          current = duration();
          playing = false;
        }
      }
      render();
    }
    lastTimestamp = ts;
    requestAnimationFrame(tick);
  }
  window.poolFilm = {
    seek(seconds, nextMode = mode) {
      playing = false;
      mode = nextMode === "hero" ? "hero" : "story";
      current = Number(seconds) || 0;
      lastTimestamp = null;
      render();
      return this.getState();
    },
    getState() {
      return {
        time: current,
        mode,
        duration: duration(),
        playing,
        starts,
        heroStarts,
      };
    },
    setMode,
  };
  fit();
  render();
  requestAnimationFrame(tick);
})();
