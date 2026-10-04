import fs from "node:fs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
import { keccak256, stringToHex } from "viem";
const exec = promisify(execFile);
const session = "pool-public-release";
const reportDir = process.env.POOL_VERIFICATION_DIR ?? "docs";
fs.mkdirSync(`${reportDir}/screenshots`, { recursive: true });
const url = process.env.POOL_PUBLIC_URL ?? "https://pool-omega-five.vercel.app";
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
  await cli("open", url);
  browser = await chromium.connectOverCDP(await cli("get", "cdp-url"));
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  const nav = async (label) => {
    const target = page.getByRole("button", { name: label, exact: true });
    if (await target.isVisible()) {
      await target.click();
      return;
    }
    const group = {
      Overview: "Invest",
      "Yield lab": "Invest",
      Receivables: "Portfolio",
      Trade: "Market",
      Evidence: "Proof",
      Activity: "Proof",
      Servicing: "Operator",
      Setup: "Operator",
    }[label];
    const menu = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    if (await menu.isVisible()) await menu.click();
    if (group === "Operator")
      await page.locator(".workspace-menu summary").click();
    else
      await page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("button", { name: group, exact: true })
        .click();
    await target.click();
  };
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  await expect(
    page.getByRole("heading", { name: "Trade credit, made composable." }),
  ).toBeVisible();
  await expect(page.locator(".live-card-footer")).toContainText("block", {
    timeout: 60000,
  });
  await expect(
    page.getByRole("heading", {
      name: "The work is done. The cash is still waiting.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `${reportDir}/screenshots/public-home.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Watch the film", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  assert(
    await page
      .locator("dialog video")
      .evaluate((v) => v.currentSrc.includes("pool-story.mp4")),
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  checks.push(
    "New homepage and launch film dialog render; Escape dismisses the film",
  );
  await page
    .getByRole("button", { name: "Explore the pool", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Trade income/ })).toBeVisible(
    { timeout: 60000 },
  );
  await expect(
    page.getByRole("button", { name: "Connect MetaMask" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Your first lending position, step by step.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect to start", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Deposit test dollars", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Important disclosures", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Before you use Pool" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  checks.push(
    "Investor checklist is actionable; disconnected deposit is disabled; disclosures work with keyboard",
  );
  const manifest = await (
    await context.request.get(`${url}/deployment.json`)
  ).json();
  const local = JSON.parse(fs.readFileSync("public/deployment.json"));
  assert.deepEqual(manifest, local);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("pool.testnet.deployment.v1"),
    ),
    null,
  );
  checks.push(
    "Fresh visitor loads hosted manifest and live RPC state without a wallet or local storage",
  );
  await page.screenshot({
    path: `${reportDir}/screenshots/public-overview.png`,
    fullPage: true,
  });
  await nav("Evidence");
  await expect(
    page.getByRole("heading", { name: "Active onchain attestation" }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByText("Technical attestation details", { exact: true })
    .click();
  await expect(page.getByText(manifest.uid, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /source on Sourcify/ }),
  ).toHaveCount(15);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full evidence bundle" })
    .click();
  const download = await downloadEvent;
  const evidence = JSON.parse(fs.readFileSync(await download.path()));
  assert.deepEqual(evidence, manifest);
  evidence.evidence.documents.forEach((doc, i) =>
    assert.equal(
      keccak256(stringToHex(doc)),
      evidence.evidence.entries[i].evidence,
    ),
  );
  checks.push(
    "Public attestation active; downloaded evidence bytes match all five committed hashes; source links present",
  );
  await page.screenshot({
    path: `${reportDir}/screenshots/public-evidence.png`,
    fullPage: true,
  });
  for (const [tab, heading] of [
    ["Receivables", "Behind the yield."],
    ["Yield lab", "Make yield your own."],
    ["Trade", "Sell the yield. Receive cash."],
    ["Servicing", "Run the full lifecycle."],
    ["Activity", "The transaction trail."],
    ["Setup", "Deploy. Attest. Publish."],
  ]) {
    await nav(tab);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    checks.push(`${tab} renders without errors`);
  }
  await expect(
    page.getByRole("heading", { name: "Release status: ready" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}/#home`);
  await expect(
    page.getByRole("heading", { name: "Trade credit, made composable." }),
  ).toBeVisible();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile home overflow",
  );
  await page.screenshot({
    path: `${reportDir}/screenshots/public-home-mobile.png`,
    fullPage: true,
  });
  await nav("Evidence");
  checks.push("Mobile home has no overflow; mobile menu navigates to evidence");
  await expect(
    page.getByRole("heading", { name: "Active onchain attestation" }),
  ).toBeVisible({ timeout: 60000 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile horizontal overflow",
  );
  await page.screenshot({
    path: `${reportDir}/screenshots/public-mobile.png`,
    fullPage: true,
  });
  checks.push("Mobile evidence deep link renders without horizontal overflow");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${reportDir}/public-browser-verification.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        url,
        chainId: 421614,
        scope:
          "Read-only public deployment: actual RPC, no mock wallet, no intercepted requests, no transactions sent",
        checks,
        errors,
        passed: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: true, checks, errors }, null, 2));
} finally {
  await context?.close();
  await browser?.close();
  await cli("close").catch(() => {});
}
