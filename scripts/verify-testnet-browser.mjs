import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const exec = promisify(execFile),
  session = "pool-testnet-e2e";
const cli = async (...args) =>
  (
    await exec("./node_modules/.bin/agent-browser", [
      "--session",
      session,
      ...args,
    ])
  ).stdout.trim();
const anvil = spawn(
  "anvil",
  ["--port", "18547", "--chain-id", "421614", "--silent"],
  { stdio: "ignore" },
);
const rpc = async (method, params = []) => {
  const r = await fetch("http://127.0.0.1:18547", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw Error(d.error.message);
  return d.result;
};
let browser, context;
try {
  let accounts;
  for (let i = 0; i < 50; i++) {
    try {
      accounts = await rpc("eth_accounts");
      break;
    } catch {
      await delay(100);
    }
  }
  if (!accounts) throw Error("Preflight chain failed to start");
  await cli("open", "http://127.0.0.1:5174");
  browser = await chromium.connectOverCDP(await cli("get", "cdp-url"));
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  // Confined test context: official read RPC is redirected to disposable Anvil.
  // Production files and the real wallets are never changed or used.
  await context.route(
    "https://sepolia-rollup.arbitrum.io/**",
    async (route) => {
      try {
        const r = await fetch("http://127.0.0.1:18547", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: route.request().postData(),
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: await r.text(),
        });
      } catch (e) {
        await route.abort();
      }
    },
  );
  await context.route("**/config/arbitrum-sepolia.json*", async (route) => {
    const response = await route.fetch();
    let text = await response.text();
    for (const [real, index] of [
      ["0xEb3356a0b57e7dcCb9341fD40545a5dCb6239267", 0],
      ["0x45b16B03CA58Ac4E02e1522c8457F2BfEe4F8790", 1],
      ["0x68C6e946d815E9df17548f822379ADD9D9439530", 2],
    ])
      text = text.replaceAll(real, accounts[index]);
    await route.fulfill({ response, body: text });
  });
  await context.route("**/deployment.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "not deployed" }),
    }),
  );
  await context.exposeBinding("testWalletRpc", async (_, method, params) =>
    rpc(method, params),
  );
  await context.addInitScript(
    ({ operator }) => {
      let current = operator;
      const listeners = {};
      window.ethereum = {
        request: async ({ method, params = [] }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts")
            return [current];
          if (method === "wallet_switchEthereumChain") return null;
          return window.testWalletRpc(method, params);
        },
        on: (name, fn) => {
          (listeners[name] ??= []).push(fn);
        },
        removeListener: (name, fn) => {
          listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn);
        },
      };
      window.switchTestAccount = (a) => {
        current = a;
        for (const fn of listeners.accountsChanged ?? []) fn([a]);
      };
    },
    { operator: accounts[0] },
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
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
  const switchAccount = async (address) => {
    await page.evaluate((a) => window.switchTestAccount(a), address);
    await page
      .getByRole("button", { name: "Connect MetaMask", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Connected");
  };
  const click = async (label, confirmation) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("status")).toContainText(confirmation, {
      timeout: 60000,
    });
  };
  await page.goto("http://127.0.0.1:5174/#setup");
  await click("Connect MetaMask", "Connected");
  await click("Prepare / resume deployment", "Contracts prepared.");
  await nav("Evidence");
  await switchAccount(accounts[1]);
  await click("Sign reviewed portfolio", "Attestation signed.");
  await switchAccount(accounts[0]);
  await nav("Setup");
  await click("Publish attestation & finish setup", "Deployment complete.");
  await nav("Overview");
  await expect(
    page.getByRole("heading", { name: "Trade income. On your terms." }),
  ).toBeVisible({ timeout: 30000 });
  await switchAccount(accounts[2]);
  await page.getByRole("spinbutton", { name: "Deposit amount" }).fill("25000");
  await click("Deposit test dollars", "Confirmed deposit");
  await switchAccount(accounts[0]);
  await nav("Servicing");
  await page.getByText("Additional facility controls", { exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Additional draw" })
    .fill("250000");
  await click("Borrow test dollars", "Confirmed borrow");
  await switchAccount(accounts[2]);
  await nav("Yield lab");
  await page.getByRole("spinbutton", { name: "Shares to split" }).fill("5000");
  await click("Mint PT + YT", "Confirmed split");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make yield your own." }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Connect MetaMask" }).click(); // provider starts with operator after reload
  await nav("Trade");
  await page.getByRole("button", { name: "Review offer", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Review purchase offer" }),
  ).toBeVisible();
  await click("Approve payment & sign bid", "Bid signed");
  await switchAccount(accounts[2]);
  await click("Sell tokens for test dollars", "Trade confirmed");
  await nav("Evidence");
  await expect(
    page.getByRole("heading", { name: "Active onchain attestation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/testnet-evidence.png",
    fullPage: true,
  });
  await switchAccount(accounts[0]);
  await nav("Servicing");
  await page.getByRole("spinbutton", { name: "Received payment" }).fill("1000");
  await click("Record settled test payment", "Confirmed collect");
  await click("Sweep into repayment", "Confirmed sweep");
  await page.screenshot({
    path: "docs/screenshots/testnet-servicing.png",
    fullPage: true,
  });
  await nav("Overview");
  await page.screenshot({
    path: "docs/screenshots/testnet-overview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile horizontal overflow",
  );
  await page.screenshot({
    path: "docs/screenshots/testnet-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.getByRole("button", { name: "+ 7 days", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  const manifest = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pool.testnet.deployment.v1")),
  );
  fs.writeFileSync(
    "docs/testnet-browser-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Public frontend and wallet adapter against a disposable chain 421614; NOT a public deployment or real MetaMask extension test",
        checks: [
          "resumable deployment UI",
          "separate attestor signature",
          "publish and admission",
          "wallet role switching",
          "deposit",
          "borrow",
          "PT/YT mint",
          "refresh",
          "funded YT sale",
          "onchain attestation inspection",
          "collection and repayment",
          "mobile",
          "no time travel controls",
          "zero browser errors",
        ],
        transactions: manifest.transactions.length,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: public frontend → injected test wallet → disposable chain, including deployment, attestation, lending, YT sale, collection and repayment.",
  );
} finally {
  await context?.close();
  await browser?.close();
  await cli("close").catch(() => {});
  anvil.kill();
}
