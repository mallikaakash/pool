import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { newManifest, runDeployment } from "../src/lib/deployment.mjs";
import { claimDomain, claimTypes, json } from "../src/lib/claims.mjs";
let node, client, wallet, accounts;
before(async () => {
  node = spawn(
    "anvil",
    ["--port", "18546", "--chain-id", "421614", "--silent"],
    { stdio: "ignore" },
  );
  node.on("error", (e) => {
    throw e;
  });
  client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http("http://127.0.0.1:18546"),
  });
  for (let i = 0; i < 50; i++) {
    try {
      accounts = await client.request({ method: "eth_accounts" });
      break;
    } catch {
      await delay(100);
    }
  }
  if (!accounts) throw Error("Anvil did not start");
  wallet = createWalletClient({
    account: accounts[0],
    chain: arbitrumSepolia,
    transport: http("http://127.0.0.1:18546"),
  });
});
after(() => node?.kill());
test(
  "browser deployment engine resumes, accepts a separately signed claim and activates exactly once",
  async () => {
    const artifacts = Object.fromEntries(
      fs
        .readdirSync("artifacts")
        .filter((f) => f.endsWith(".json"))
        .map((f) => [
          f.slice(0, -5),
          JSON.parse(fs.readFileSync(`artifacts/${f}`)),
        ]),
    );
    let stored;
    const save = (m) => {
      stored = JSON.parse(json(m));
    };
    const run = (manifest) =>
      runDeployment({
        client,
        wallet,
        artifacts,
        manifest,
        save,
        progress: () => {},
      });
    const m = newManifest({
      chainId: 421614,
      roles: {
        operator: accounts[0],
        attestor: accounts[1],
        investor: accounts[2],
      },
    });
    await run(m);
    assert.equal(stored.status, "awaiting_attestation");
    const nonce = await client.getTransactionCount({ address: accounts[0] });
    await run(stored);
    assert.equal(
      await client.getTransactionCount({ address: accounts[0] }),
      nonce,
    );
    const attestor = createWalletClient({
      account: accounts[1],
      chain: arbitrumSepolia,
      transport: http("http://127.0.0.1:18546"),
    });
    stored.signature = await attestor.signTypedData({
      domain: claimDomain(421614, stored.addresses.AttestationRegistry),
      types: claimTypes,
      primaryType: "Claim",
      message: stored.claim,
    });
    await run(stored);
    assert.equal(stored.status, "ready");
    const read = (name, fn, args = []) =>
      client.readContract({
        address: stored.addresses[name],
        abi: artifacts[name].abi,
        functionName: fn,
        args,
      });
    assert.equal(await read("ReceivablePool", "activated"), true);
    assert.equal(
      await read("ReceivablePool", "totalSupply"),
      parseUnits("485000", 6),
    );
    assert.equal(
      await read("LenderVault", "totalAssets"),
      parseUnits("375000", 6),
    );
    assert.equal(
      await read("TestDollar", "balanceOf", [accounts[2]]),
      parseUnits("75000", 6),
    );
    const finalNonce = await client.getTransactionCount({
      address: accounts[0],
    });
    await run(stored);
    assert.equal(
      await client.getTransactionCount({ address: accounts[0] }),
      finalNonce,
    );
    await runDeployment({
      client,
      wallet,
      artifacts,
      manifest: stored,
      save,
      progress: () => {},
      prepareMaturity: true,
    });
    assert.ok(
      stored.maturity.expiry > Number((await client.getBlock()).timestamp),
    );
    assert.equal(
      await client.readContract({
        address: stored.maturity.addresses.PendlePrincipalToken,
        abi: artifacts.PendlePrincipalToken.abi,
        functionName: "balanceOf",
        args: [accounts[2]],
      }),
      parseUnits("500", 6),
    );
    fs.mkdirSync(".runtime", { recursive: true });
    fs.writeFileSync(".runtime/testnet-preflight.json", json(stored));
  },
  { timeout: 120000 },
);
