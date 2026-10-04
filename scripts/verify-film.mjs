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
  await page.goto("http://127.0.0.1:4176/film/");
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
  const starts = [0, 14, 29, 44, 58, 76, 91, 106];
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
          "h1,p,.scene-note,.verification-card,.borrow-card,.trade-ticket,.collection-card",
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
  checks.push("All eight scenes render inside the frame");
  await page
    .getByRole("button", { name: "Hero loop 18s", exact: true })
    .click();
  assert.equal(
    (await page.evaluate(() => window.poolFilm.getState())).duration,
    18,
  );
  for (const [t, scene] of [
    [2, "1"],
    [8, "3"],
    [14, "4"],
  ]) {
    await page.evaluate((t) => window.poolFilm.seek(t, "hero"), t);
    assert.equal(
      await page.locator(".scene.active").getAttribute("data-scene"),
      scene,
    );
  }
  checks.push("Hero mode has an independent 18-second three-scene timeline");
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
