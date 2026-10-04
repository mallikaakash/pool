# Pool presentation and hero loop

The editable film lives in `public/film/index.html`, with `film.css` and `film.js` beside it. It is independent of the wallet application and never sends transactions.

## Preview

```sh
python3 -m http.server 4176 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:4176/film/`. The page includes a two-minute, eight-chapter story and a separate 18-second hero loop. Playback, scrubbing, chapter selection, fullscreen, and keyboard controls are available. Reduced-motion preferences disable autoplay.

- Full story: `/film/`
- Hero preview: `/film/?mode=hero`
- Clean hero animation: `/film/?mode=hero&capture=1&autoplay=1`
- Encoded silent hero: `/film/pool-hero.mp4`
- Poster: `/film/pool-hero-poster.png`

The initial film uses the actual public release capture from 2026-10-04. Deposit, borrowing, PT/YT split, quote settlement, and collection scenes are illustrative and explicitly labeled. Replace these scenes or their status captions with actual public transaction evidence before presenting the film as a completed public lifecycle. No narration is included. This is a visual walkthrough, not the finished submission video.

## Deterministic rendering

All motion is controlled by `window.poolFilm.seek(seconds, mode)`, so screenshots do not depend on animation timing or RPC responses. Start the preview server, then:

```sh
node scripts/verify-film.mjs
node scripts/render-film.mjs hero
# Optional full two-minute MP4, 1920x1080:
FILM_WIDTH=1920 node scripts/render-film.mjs story
```

The renderer opens an isolated agent-browser session, captures 24 frames per second through Playwright, and invokes FFmpeg to create an H.264 MP4 with fast-start metadata. Intermediate frames go into ignored `.runtime/`; the MP4 and poster go into `public/film/`. Output duration and format are checked with ffprobe. The hero is 1280x720 by default; no audio stream is encoded.

## Hero integration

Use the short clip as a contained illustration next to readable HTML heading, body text, and a call to action. Do not rely on tiny text inside a background video to explain the product. Keep the full story behind a "See how it works" link. The current live application hero has not been replaced.

Example markup for a future landing page:

```html
<video
  id="pool-hero"
  muted
  loop
  playsinline
  preload="none"
  poster="/film/pool-hero-poster.png"
  aria-label="Illustration of attestation, borrowing, and principal/yield separation"
>
  <source src="/film/pool-hero.mp4" type="video/mp4" />
</video>
<button id="hero-motion" type="button">Play animation</button>
<script>
  const video = document.querySelector("#pool-hero");
  const button = document.querySelector("#hero-motion");
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    button.textContent = video.paused ? "Play animation" : "Pause animation";
  };
  button.addEventListener("click", () => {
    if (video.paused) video.play().catch(sync);
    else video.pause();
  });
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  preference.addEventListener("change", () => {
    if (preference.matches) video.pause();
  });
  if (!preference.matches) video.play().catch(sync);
</script>
```

The poster remains visible when autoplay is unavailable or motion is reduced. Keep the pause control available for an indefinitely looping hero. Restrict video width, preserve the 16:9 aspect ratio, and avoid `object-fit: cover` when it would crop financial labels.
