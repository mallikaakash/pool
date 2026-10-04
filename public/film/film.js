(() => {
  const names = [
    "The financing gap",
    "Attest the portfolio",
    "Supply capital",
    "Borrow against it",
    "Separate PT & YT",
    "Trade the yield",
    "Collect & repay",
    "Inspect the proof",
  ];
  const starts = [0, 14, 29, 44, 58, 76, 91, 106];
  const heroScenes = [1, 3, 4];
  const params = new URLSearchParams(location.search);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = params.get("mode") === "hero" ? "hero" : "story";
  let current = params.has("t")
    ? Number(params.get("t")) || 0
    : params.get("capture") === "1" || params.get("autoplay") === "1"
      ? 0
      : 1.8;
  let playing = params.get("autoplay") === "1" && !reducedMotion;
  let lastTimestamp = null;
  const stage = document.querySelector("#stage");
  const wrap = document.querySelector(".stage-wrap");
  const scenes = [...document.querySelectorAll(".scene")];
  const seek = document.querySelector("#seek");
  const play = document.querySelector("#play");
  const chapters = document.querySelector("#chapters");
  const ticks = document.querySelector("#film-ticks");
  const duration = () => (mode === "hero" ? 18 : 120);
  const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
  const clock = (t) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  document.body.classList.toggle("capture", params.get("capture") === "1");
  names.forEach((name, i) => {
    const button = document.createElement("button");
    button.innerHTML = `<span>${String(i + 1).padStart(2, "0")} / ${clock(starts[i])}</span>${name}`;
    button.addEventListener("click", () => {
      if (mode !== "story") setMode("story");
      current = starts[i] + (playing ? 0 : 1.8);
      render();
    });
    chapters.append(button);
    ticks.append(document.createElement("i"));
  });
  function fit() {
    const bounds = wrap.getBoundingClientRect();
    stage.style.transform = `scale(${Math.min(bounds.width / 1600, bounds.height / 900)})`;
  }
  function render() {
    current = Math.max(0, Math.min(duration(), current));
    const heroIndex = Math.min(2, Math.floor(current / 6));
    const index =
      mode === "hero"
        ? heroScenes[heroIndex]
        : starts.findLastIndex((start) => current >= start);
    const local =
      mode === "hero" ? current - heroIndex * 6 : current - starts[index];
    stage.classList.toggle("hero", mode === "hero");
    const sceneDuration =
      mode === "hero" ? 6 : (starts[index + 1] ?? 120) - starts[index];
    scenes.forEach((scene, i) => {
      scene.classList.toggle("active", i === index);
      scene.setAttribute("aria-hidden", String(i !== index));
      if (i !== index) return;
      const exit =
        mode === "hero"
          ? Math.min(1, Math.max(0, (sceneDuration - local) / 0.35))
          : 1;
      scene.style.opacity = exit;
      scene.style.setProperty("--flow", String((local % 2.5) / 2.5));
      scene.style.setProperty("--grow", String(ease(local / 1.4)));
      scene.querySelectorAll("[data-in]").forEach((el) => {
        const entrance = reducedMotion
          ? 1
          : ease((local - Number(el.dataset.in) * 0.13 + 0.08) / 0.8);
        el.style.opacity = String(entrance);
        el.style.transform = `translateY(${(1 - entrance) * 24}px)`;
      });
    });
    stage.setAttribute(
      "aria-label",
      `${names[index]}. ${mode === "hero" ? "Illustrative hero animation" : "Pool presentation"}.`,
    );
    document.querySelector("#chapter-label").textContent =
      names[index].toUpperCase();
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
    document.querySelector("#mode-description").textContent =
      mode === "hero"
        ? "An 18-second silent loop for a landing-page hero. Use a poster and respect reduced-motion preferences when embedding."
        : "A two-minute visual walkthrough. Future demo actions are labeled illustrative; the final scene uses an actual release capture.";
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
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input,button,a")) return;
    if (event.code === "Space") {
      event.preventDefault();
      toggle();
    }
    if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
      event.preventDefault();
      current += event.code === "ArrowRight" ? 5 : -5;
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    lastTimestamp = null;
  });
  const resize = new ResizeObserver(fit);
  resize.observe(wrap);
  function tick(timestamp) {
    if (playing && !document.hidden) {
      if (lastTimestamp !== null)
        current += Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      if (current >= duration()) {
        if (mode === "hero") current %= duration();
        else {
          current = duration();
          playing = false;
        }
      }
      render();
    }
    lastTimestamp = timestamp;
    requestAnimationFrame(tick);
  }
  // Frame capture API: no clock-dependent animations or network data in the film.
  window.poolFilm = {
    seek(seconds, nextMode = mode) {
      playing = false;
      mode = nextMode === "hero" ? "hero" : "story";
      current = Number(seconds) || 0;
      lastTimestamp = null;
      render();
      return { time: current, mode, duration: duration() };
    },
    getState() {
      return { time: current, mode, duration: duration(), playing };
    },
    setMode,
  };
  fit();
  render();
  requestAnimationFrame(tick);
})();
