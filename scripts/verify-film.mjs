import fs from "node:fs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
const exec = promisify(execFile),
  session = "pool-film";
const cli = async (...args) =>
  (
    await exec("./node_modules/.bin/agent-browser", [
      "--session",
      session,
      ...args,
    ])
  ).stdout.trim();
let browser, context;
const errors = [],
  checks = [];
try {
  await cli("open", "http://127.0.0.1:4176/film/");
  browser = await chromium.connectOverCDP(await cli("get", "cdp-url"));
  context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4176/film/?autoplay=0");
  await expect(
    page.getByRole("button", { name: "Play presentation", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/film-page.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Play presentation", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.poolFilm.getState().time))
    .toBeGreaterThan(2);
  await page
    .getByRole("button", { name: "Pause presentation", exact: true })
    .click();
  checks.push("Play and pause controls advance deterministic timeline");
  const starts = [0, 3, 7, 13, 21, 29, 38, 46, 54, 62];
  for (let i = 0; i < starts.length; i++) {
    await page.evaluate(({ t }) => window.poolFilm.seek(t, "story"), {
      t: starts[i] + 2,
    });
    assert.equal(
      await page.locator(".scene.active").getAttribute("data-scene"),
      String(i),
    );
    assert.equal(
      await page
        .locator(".scene.active h1")
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
    );
    const outside = await page.locator(".scene.active").evaluate((scene) => {
      const bounds = document.querySelector("#stage").getBoundingClientRect();
      return [
        ...scene.querySelectorAll(
          "h1,p,.bottom-line,.evidence-panel,.fund-panel,.trade-board,.repay-board",
        ),
      ]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return (
            b.left < bounds.left ||
            b.right > bounds.right ||
            b.bottom > bounds.bottom
          );
        })
        .map((el) => el.tagName);
    });
    assert.deepEqual(outside, []);
    await page
      .locator("#stage")
      .screenshot({ path: `.runtime/film-scene-${i}.png` });
  }
  checks.push("All ten scenes render inside the frame");
  await page.getByRole("button", { name: "Hero cut 20s", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.poolFilm.getState())).duration,
    20,
  );
  for (const [t, scene] of [
    [1, "0"],
    [4, "1"],
    [8, "2"],
    [16, "3"],
  ]) {
    await page.evaluate((t) => window.poolFilm.seek(t, "hero"), t);
    assert.equal(
      await page.locator(".scene.active").getAttribute("data-scene"),
      scene,
    );
  }
  checks.push(
    "Hero mode establishes problem, financing and tokenization in 20 seconds",
  );
  // Verify actual path endpoints, not just a visually moving dot.
  await page.evaluate(() => window.poolFilm.seek(17, "story"));
  for (const id of ["pt-path", "yt-path"]) {
    const arrived = await page.evaluate((id) => {
      const path = document.getElementById(id);
      const end = path.getPointAtLength(path.getTotalLength());
      const dot = document.querySelector(`[data-follow="${id}"]`);
      return {
        progress: Number(dot.dataset.progress),
        x: Number(dot.getAttribute("cx")),
        y: Number(dot.getAttribute("cy")),
        endX: end.x,
        endY: end.y,
      };
    }, id);
    assert.equal(arrived.progress, 1);
    assert(
      Math.abs(arrived.x - arrived.endX) < 0.1 &&
        Math.abs(arrived.y - arrived.endY) < 0.1,
    );
  }
  assert.equal(await page.locator(".token.arrived").count(), 2);
  checks.push(
    "Both split particles reach their exact SVG endpoints and activate the received PT/YT tokens",
  );
  await page.evaluate(() => window.poolFilm.seek(18, "story"));
  const a = await page.locator("#stage").screenshot();
  await page.evaluate(() => window.poolFilm.seek(0, "story"));
  await page.evaluate(() => window.poolFilm.seek(18, "story"));
  const b = await page.locator("#stage").screenshot();
  assert(a.equals(b), "Seeking must produce deterministic frames");
  checks.push("Seeking backward and forward produces identical frames");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/film-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks.push("Mobile controls fit without horizontal overflow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:4176/film/?mode=hero&autoplay=1");
  assert.equal(
    (await page.evaluate(() => window.poolFilm.getState())).playing,
    false,
  );
  checks.push("Reduced-motion preference prevents autoplay");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "docs/film-verification.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, errors, passed: true },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checks, errors, passed: true }, null, 2));
} finally {
  await context?.close();
  await browser?.close();
  await cli("close").catch(() => {});
}
