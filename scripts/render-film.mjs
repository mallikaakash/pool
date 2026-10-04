// Run a local public/ server first. Renders deterministic HTML frames, never wallet actions.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
const exec = promisify(execFile);
const mode = process.argv[2] ?? "hero";
assert(["hero", "story"].includes(mode), "Mode must be hero or story");
const width = Number(process.env.FILM_WIDTH ?? 1280),
  height = (width * 9) / 16;
const fps = 24,
  seconds = mode === "hero" ? 20 : 68;
assert(
  Number.isInteger(height) && width % 2 === 0 && height % 2 === 0,
  "Use even 16:9 dimensions",
);
const url = process.env.FILM_URL ?? "http://127.0.0.1:4176/film/";
const session = `pool-film-render-${mode}`;
const cli = async (...args) =>
  (
    await exec("./node_modules/.bin/agent-browser", [
      "--session",
      session,
      ...args,
    ])
  ).stdout.trim();
const dir = path.resolve(".runtime", `film-${mode}-frames`);
fs.mkdirSync(dir, { recursive: true });
let browser, context;
try {
  await cli("open", url);
  browser = await chromium.connectOverCDP(await cli("get", "cdp-url"));
  context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${url}?mode=${mode}&capture=1`);
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  );
  await page.evaluate(() => document.fonts.ready);
  const frames = seconds * fps;
  for (let frame = 0; frame < frames; frame++) {
    await page.evaluate(({ t, mode }) => window.poolFilm.seek(t, mode), {
      t: frame / fps,
      mode,
    });
    await page.screenshot({
      path: path.join(dir, `${String(frame).padStart(5, "0")}.png`),
      animations: "disabled",
    });
    if (frame % (fps * 3) === 0)
      console.log(`Rendered ${frame / fps}s / ${seconds}s`);
  }
  assert.deepEqual(errors, []);
  const output = path.resolve("public/film", `pool-${mode}.mp4`);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(fps),
      "-i",
      path.join(dir, "%05d.png"),
      "-frames:v",
      String(frames),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      mode === "hero" ? "23" : "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      output,
    ],
    { stdio: "inherit" },
  );
  await new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`ffmpeg exit ${code}`)),
    );
  });
  await page.evaluate(({ mode }) => window.poolFilm.seek(2, mode), { mode });
  await page.screenshot({
    path: path.resolve("public/film", `pool-${mode}-poster.png`),
  });
  const metadata = JSON.parse(
    (
      await exec("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,width,height,r_frame_rate",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  assert(Math.abs(Number(metadata.format.duration) - seconds) < 0.1);
  fs.writeFileSync(
    `docs/film-${mode}-render.json`,
    JSON.stringify(
      {
        renderedAt: new Date().toISOString(),
        mode,
        fps,
        seconds,
        frames,
        output: `public/film/pool-${mode}.mp4`,
        metadata,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ output, metadata }, null, 2));
} finally {
  await context?.close();
  await browser?.close();
  await cli("close").catch(() => {});
}
