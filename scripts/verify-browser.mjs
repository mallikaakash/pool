import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Requires `npm run dev`. Uses a separate browser session and disposable funds.
// Run against an unexpired series; restart the stack for a clean demo afterwards.
const exec = promisify(execFile),
  session = "pool-regression";
const cli = async (...args) =>
  (
    await exec("./node_modules/.bin/agent-browser", [
      "--session",
      session,
      ...args,
    ])
  ).stdout.trim();
await cli("open", "http://127.0.0.1:5173");
const cdp = await cli("get", "cdp-url");
const browser = await chromium.connectOverCDP(cdp);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
fs.mkdirSync("docs/screenshots", { recursive: true });
const state = async () =>
  await (await fetch("http://127.0.0.1:5173/api/state")).json();
async function clickAction(label) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/action") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
  const result = await response.json();
  assert.equal(response.status(), 200, result.error);
  await expect(page.getByRole("status")).toContainText("Transaction confirmed");
  return result.state;
}
async function navigate(label) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
try {
  await page.goto("http://127.0.0.1:5173");
  await expect(
    page.getByRole("heading", { name: "Trade income. On your terms." }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Deposit amount" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/overview.png",
    fullPage: true,
  });
  const before = await state();
  assert.equal(
    before.yield.expired,
    false,
    "Restart npm run dev: the series is already expired.",
  );
  await page.getByRole("spinbutton", { name: "Deposit amount" }).fill("42");
  let s = await clickAction("Deposit test dollars");
  assert.equal(s.investor.cash, before.investor.cash - 42);
  await navigate("Yield lab LAB");
  await page.getByRole("spinbutton", { name: "Shares to split" }).fill("1000");
  s = await clickAction("Mint PT + YT");
  assert.ok(s.yield.pt > before.yield.pt + 999);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make yield your own." }),
  ).toBeVisible();
  assert.ok((await state()).yield.pt > before.yield.pt + 999);
  await navigate("Servicing");
  s = await clickAction("+ 7 days");
  assert.ok(s.yield.claimable > 0);
  await navigate("Yield lab LAB");
  s = await clickAction("Claim accrued yield");
  assert.ok(s.yield.sy > 0);
  s = await clickAction("Unwrap to shares");
  assert.equal(s.yield.sy, 0);
  await page
    .getByRole("spinbutton", { name: "Yield tokens to transfer" })
    .fill("10");
  const yt = s.yield.yt;
  s = await clickAction("Transfer YT to demo trader");
  assert.ok(Math.abs(s.yield.yt - (yt - 10)) < 0.00001);
  await page.screenshot({
    path: "docs/screenshots/yield-lab.png",
    fullPage: true,
  });
  await navigate("Servicing");
  await page.getByRole("spinbutton", { name: "Received payment" }).fill("1000");
  s = await clickAction("Record settled test payment");
  assert.ok(s.pool.cash >= 1000);
  const debt = s.market.debt;
  s = await clickAction("Sweep into repayment");
  assert.ok(s.market.debt < debt - 999);
  // Severe impairment, funded liquidation and maturity redemption all traverse the UI/API/chain.
  await page.getByRole("spinbutton", { name: "New book value" }).fill("0");
  await clickAction("Recognize the loss");
  await page.getByRole("combobox", { name: "Invoice" }).selectOption("1");
  s = await clickAction("Recognize the loss");
  assert.ok(s.market.healthFactor < 1);
  await page
    .getByRole("spinbutton", { name: "Collateral shares to acquire" })
    .fill("100000");
  const cash = s.backstop.cash;
  s = await clickAction("Execute Morpho liquidation");
  assert.ok(s.backstop.cash < cash);
  await page.screenshot({
    path: "docs/screenshots/servicing.png",
    fullPage: true,
  });
  await clickAction("+ 100 days");
  await navigate("Yield lab LAB");
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await page.getByRole("spinbutton", { name: "PT to redeem" }).fill("100");
  s = await clickAction("Redeem to vault shares");
  assert.equal(s.yield.expired, true);
  await navigate("Receivables");
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect evidence for Straits Marine Supply" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic evidence · SG-001" }),
  ).toBeVisible();
  await navigate("Activity");
  await expect(
    page
      .getByRole("cell", {
        name: "Redeem Pendle position to vault shares",
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "What’s real?" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await navigate("Overview");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile page overflows horizontally",
  );
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await navigate("Yield lab LAB");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile yield page overflows",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "docs/browser-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        passed: [
          "desktop rendering",
          "deposit",
          "Pendle mint",
          "refresh persistence",
          "interest accrual",
          "claim and unwrap",
          "independent YT transfer",
          "collections and repayment sweep",
          "impairment and funded liquidation",
          "PT maturity redemption",
          "evidence disclosure",
          "transaction activity",
          "modal escape",
          "mobile navigation and width",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Browser verification passed: deposit → Pendle → collections → liquidation → maturity; desktop + mobile; zero console errors.",
  );
} finally {
  await context.close();
  await browser.close();
  await cli("close");
}
