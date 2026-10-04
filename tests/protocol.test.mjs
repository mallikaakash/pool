import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createDemo, units } from "../scripts/chain.mjs";

let node, d, id;
before(
  async () => {
    node = spawn(
      "anvil",
      [
        "--host",
        "127.0.0.1",
        "--port",
        "18545",
        "--chain-id",
        "31337",
        "--silent",
      ],
      { stdio: "ignore" },
    );
    let startupError;
    node.on("error", (e) => (startupError = e));
    node.on(
      "exit",
      (code) => (startupError = Error(`Anvil test node exited ${code}`)),
    );
    for (let i = 0; i < 60; i++) {
      await delay(100);
      if (startupError) throw startupError;
      try {
        await fetch("http://127.0.0.1:18545");
        break;
      } catch {}
    }
    d = await createDemo("http://127.0.0.1:18545");
  },
  { timeout: 120000 },
);
after(() => node?.kill());
beforeEach(async () => {
  id = await d.client.request({ method: "evm_snapshot" });
});
afterEach(async () => {
  await d.client.request({ method: "evm_revert", params: [id] });
});

test("seeded facility is real Morpho with solvent collateral and lender shares", async () => {
  const s = await d.state();
  assert.equal(s.pool.nav, 485000);
  assert.equal(s.market.collateral, 485000);
  assert.ok(Math.abs(s.market.debt - 250000) < 1);
  assert.equal(s.investor.cash, 50000);
  assert.ok(s.market.healthFactor > 1.2);
  assert.equal(s.invoices.length, 5);
  assert.notEqual(
    await d.client.getCode({ address: d.addresses.Morpho }),
    "0x",
  );
});

test("deposits, limited withdrawals and repayments conserve actual token balances", async () => {
  await d.action("deposit", { amount: 1000 });
  const b = await d.read("TestDollar", "balanceOf", [d.actors.investor]);
  assert.equal(b, units(49000));
  await d.action("withdraw", { amount: 500 });
  assert.equal(
    await d.read("TestDollar", "balanceOf", [d.actors.investor]),
    units(49500),
  );
  await d.action("borrow", { amount: 40000 });
  await d.action("repay", { amount: 10000 });
  const s = await d.state();
  assert.ok(Math.abs(s.market.debt - 280000) < 2);
  await assert.rejects(d.action("borrow", { amount: 100000 }));
  // Large LP owns enough shares, but 280k of the supplied cash is on loan.
  await assert.rejects(
    d.write(
      "LenderVault",
      "withdraw",
      [units(200000), d.actors.liquidityProvider, d.actors.liquidityProvider],
      "liquidityProvider",
    ),
  );
});

test("collections replace receivables with cash; sweep can only repay facility debt", async () => {
  await d.action("collect", { id: 0, amount: 60000 });
  let s = await d.state();
  assert.equal(s.invoices[0].value, 58200);
  assert.equal(s.pool.cash, 60000);
  assert.equal(s.pool.nav, 486800); // Only 1,800 discount income, never double-count 60k.
  await d.action("sweep");
  s = await d.state();
  assert.equal(s.pool.cash, 0);
  assert.equal(s.pool.nav, 426800);
  assert.ok(Math.abs(s.market.debt - 190000) < 1);
  await assert.rejects(d.action("close"));
});

test("servicer authorization, input bounds and collateral redemption are enforced", async () => {
  await assert.rejects(
    d.write("ReceivablePool", "impair", [0n, 0n], "investor"),
  );
  await assert.rejects(
    d.write("ReceivablePool", "borrow", [units(1)], "investor"),
  );
  await assert.rejects(
    d.write("ReceivablePool", "collect", [0n, units(1)], "investor"),
  );
  await assert.rejects(d.action("impair", { id: 0, amount: 120000 }));
  await assert.rejects(d.action("collect", { id: 0, amount: 120001 }));
  await assert.rejects(d.action("redeemCollateral", { amount: 1 }));
  await assert.rejects(d.action("deposit", { amount: -1 }));
  await assert.rejects(d.action("advance", { days: 3650 }));
});

test("impairment enables actual Morpho liquidation; funded backstop spends cash", async () => {
  await assert.rejects(d.action("liquidate", { amount: 50000 }));
  await d.action("impair", { id: 0, amount: 0 });
  await d.action("impair", { id: 1, amount: 0 });
  const before = await d.state();
  assert.ok(before.market.healthFactor < 1);
  await d.action("liquidate", { amount: 100000 });
  const after = await d.state();
  assert.equal(after.backstop.collateral, 100000);
  assert.ok(after.backstop.cash < before.backstop.cash);
  assert.ok(after.market.debt < before.market.debt);
  assert.ok(after.market.liquidity > before.market.liquidity);
});

test("actual Pendle factory mints paired PT/YT; interest can be claimed and unwrapped", async () => {
  await d.action("split", { amount: 5000 });
  let s = await d.state();
  assert.ok(s.yield.pt >= 5000);
  assert.equal(s.yield.pt, s.yield.yt);
  assert.ok(Math.abs(s.investor.shares - 20000) < 0.001);
  await d.action("advance", { days: 30 });
  s = await d.state();
  assert.ok(s.yield.claimable > 20);
  await d.action("claim");
  s = await d.state();
  assert.ok(s.yield.sy > 20);
  await d.action("unwrap", { amount: s.yield.sy.toFixed(6) });
  assert.equal((await d.state()).yield.sy, 0);
});

test("repayment retires borrower collateral without diluting seized shares", async () => {
  await d.action("impair", { id: 0, amount: 0 });
  await d.action("impair", { id: 1, amount: 0 });
  await d.action("liquidate", { amount: 100000 });
  // Restore sufficient health for a cash redemption of the borrower's collateral.
  await d.action("repay", { amount: 120000 });
  await d.action("collect", { id: 2, amount: 10000 });
  const before = await d.state();
  await d.action("sweep");
  const after = await d.state();
  assert.equal(after.backstop.collateral, before.backstop.collateral);
  assert.ok(after.pool.shareSupply < before.pool.shareSupply);
  assert.ok(
    Math.abs(after.pool.collateralPrice - before.pool.collateralPrice) < 1e-10,
  );
  assert.ok(after.market.collateral < before.market.collateral);
  await assert.rejects(
    d.write("ReceivablePool", "onMorphoRepay", [units(1), "0x"], "investor"),
  );
});

test("before expiry redemption requires BOTH tokens; after expiry only PT", async () => {
  await d.action("split", { amount: 5000 });
  await d.action("redeem", { amount: 1000 });
  await d.action("transferYT", { amount: 4000 });
  await assert.rejects(d.action("redeem", { amount: 1000 }));
  await d.action("advance", { days: 100 });
  const before = await d.state();
  assert.equal(before.yield.expired, true);
  await d.action("redeem", { amount: 1000 });
  assert.ok((await d.state()).investor.shares > before.investor.shares);
  await assert.rejects(d.action("split", { amount: 100 }));
});

test("bad debt reaches the lender vault and PT; principal is not protected", async () => {
  await d.action("split", { amount: 5000 });
  for (let i = 0; i < 5; i++) await d.action("impair", { id: i, amount: 0 });
  await d.action("liquidate", { amount: 485000 }); // Zero recovery: Morpho writes off residual debt.
  let s = await d.state();
  assert.equal(s.market.debt, 0);
  assert.ok(s.yield.exchangeRate < 0.38);
  await d.action("advance", { days: 100 });
  const before = (await d.state()).investor.value;
  await d.action("redeem", { amount: 5000 });
  s = await d.state();
  assert.ok(s.investor.value - before < 1900); // $5k face does not become $5k cash.
});

test("closing repaid facility unlocks residual collateral and prevents reborrowing", async () => {
  await d.action("repayAll");
  await d.action("close");
  assert.equal((await d.state()).pool.closed, true);
  await assert.rejects(d.action("borrow", { amount: 1 }));
  await d.action("collect", { id: 0, amount: 120000 });
  await d.write(
    "ReceivablePool",
    "redeemCollateral",
    [units(1000)],
    "servicer",
  );
  assert.equal(await d.read("ReceivablePool", "totalSupply"), units(484000));
});

// Public-release guarantees, exercised against the same deployed protocol stack.
import {
  claimTypes,
  claimDomain,
  bidTypes,
  bidDomain,
  portfolioRoot,
} from "../src/lib/claims.mjs";
import { hashTypedData, maxUint256 } from "viem";

test("attestation binds signer, chain, registry, portfolio and values; nonce cannot replay", async () => {
  assert.equal(
    d.uid,
    hashTypedData({
      domain: claimDomain(31337, d.addresses.AttestationRegistry),
      types: claimTypes,
      primaryType: "Claim",
      message: d.claim,
    }),
  );
  assert.equal(await d.read("AttestationRegistry", "isValid", [d.uid]), true);
  await assert.rejects(
    d.write("AttestationRegistry", "publish", [d.claim, d.signature]),
  );
  const c = { ...d.claim, nonce: 2n };
  const sign = (wallet, domain, message = c) =>
    wallet.signTypedData({
      domain,
      types: claimTypes,
      primaryType: "Claim",
      message,
    });
  for (const signature of [
    await sign(
      d.wallets.investor,
      claimDomain(31337, d.addresses.AttestationRegistry),
    ),
    await sign(
      d.wallets.attestor,
      claimDomain(421614, d.addresses.AttestationRegistry),
    ),
    await sign(
      d.wallets.attestor,
      claimDomain(31337, d.addresses.ReceivablePool),
    ),
  ])
    await assert.rejects(
      d.write("AttestationRegistry", "publish", [c, signature]),
    );
  const signature = await sign(
    d.wallets.attestor,
    claimDomain(31337, d.addresses.AttestationRegistry),
  );
  await assert.rejects(
    d.write("AttestationRegistry", "publish", [
      { ...c, book: c.book - 1n },
      signature,
    ]),
  );
  await d.write("AttestationRegistry", "publish", [c, signature]);
  await assert.rejects(
    d.write("ReceivablePool", "admit", [d.uid, d.evidence.entries]),
  );
});

test("revoked and expired eligibility blocks borrowing, preserves actual repayment and cash collection", async () => {
  await assert.rejects(
    d.write("AttestationRegistry", "revoke", [d.uid], "investor"),
  );
  await d.write("AttestationRegistry", "revoke", [d.uid], "attestor");
  await assert.rejects(d.action("borrow", { amount: 1 }));
  await d.action("repay", { amount: 1000 });
  await d.action("collect", { id: 0, amount: 1000 });
  await d.action("sweep");
  assert.ok((await d.read("ReceivableOracle", "price")) > 0n);
});

test("expiry prevents borrowing without breaking oracle or permissionless debt repayment", async () => {
  await d.client.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(d.claim.validUntil)],
  });
  await d.client.request({ method: "evm_mine" });
  assert.equal(await d.read("AttestationRegistry", "isValid", [d.uid]), false);
  await assert.rejects(d.action("borrow", { amount: 1 }));
  await d.action("repay", { amount: 1000 });
  assert.ok((await d.read("ReceivableOracle", "price")) > 0n);
});

test("portfolio admission rejects different pool, bad commitments and duplicate IDs before minting", async () => {
  const a = JSON.parse(
    (await import("node:fs")).readFileSync(
      "artifacts/ReceivablePool.json",
      "utf8",
    ),
  );
  const hash = await d.wallets.servicer.deployContract({
    abi: a.abi,
    bytecode: a.bytecode,
    args: [
      d.addresses.TestDollar,
      d.actors.servicer,
      d.addresses.AttestationRegistry,
    ],
  });
  const receipt = await d.client.waitForTransactionReceipt({ hash });
  const pool = receipt.contractAddress;
  const write = async (uid, entries) => {
    const { request } = await d.client.simulateContract({
      address: pool,
      abi: a.abi,
      functionName: "admit",
      args: [uid, entries],
      account: d.actors.servicer,
    });
    return d.wallets.servicer.writeContract(request);
  };
  await assert.rejects(write(d.uid, d.evidence.entries));
  let nonce = 5n;
  for (const entries of [
    d.evidence.entries,
    [d.evidence.entries[0], d.evidence.entries[0]],
  ]) {
    const c = {
      ...d.claim,
      pool,
      root: portfolioRoot(entries),
      face: entries.reduce((s, e) => s + e.face, 0n),
      book: entries.reduce((s, e) => s + e.book, 0n),
      nonce: nonce++,
    };
    const signature = await d.wallets.attestor.signTypedData({
      domain: claimDomain(31337, d.addresses.AttestationRegistry),
      types: claimTypes,
      primaryType: "Claim",
      message: c,
    });
    await d.write("AttestationRegistry", "publish", [c, signature]);
    const uid = await d.read("AttestationRegistry", "digest", [c]);
    if (entries.length === 5)
      await assert.rejects(
        write(uid, [{ ...entries[0], book: 1n }, ...entries.slice(1)]),
      );
    else await assert.rejects(write(uid, entries));
  }
  assert.equal(
    await d.client.readContract({
      address: pool,
      abi: a.abi,
      functionName: "totalSupply",
    }),
    0n,
  );
});

async function bid(nonce = 1n) {
  await d.action("split", { amount: 5000 });
  await d.write(
    "TestDollar",
    "approve",
    [d.addresses.QuoteMarket, maxUint256],
    "trader",
  );
  await d.write(
    "PendleYieldToken",
    "approve",
    [d.addresses.QuoteMarket, maxUint256],
    "investor",
  );
  const message = {
    maker: d.actors.trader,
    taker: d.actors.investor,
    token: d.addresses.PendleYieldToken,
    amount: units(1000),
    payment: units(5),
    deadline: (await d.client.getBlock()).timestamp + 3600n,
    nonce,
  };
  const signature = await d.wallets.trader.signTypedData({
    domain: bidDomain(31337, d.addresses.QuoteMarket),
    types: bidTypes,
    primaryType: "Bid",
    message,
  });
  return [message, signature];
}
test("signed YT bid settles actual currency atomically, with replay/taker/tampering protection", async () => {
  const [b, s] = await bid();
  await assert.rejects(d.write("QuoteMarket", "fill", [b, s], "servicer"));
  await assert.rejects(
    d.write(
      "QuoteMarket",
      "fill",
      [{ ...b, payment: units(50) }, s],
      "investor",
    ),
  );
  const cash = await d.read("TestDollar", "balanceOf", [d.actors.investor]);
  await d.write("QuoteMarket", "fill", [b, s], "investor");
  assert.equal(
    await d.read("TestDollar", "balanceOf", [d.actors.investor]),
    cash + units(5),
  );
  assert.equal(
    await d.read("PendleYieldToken", "balanceOf", [d.actors.trader]),
    units(1000),
  );
  await assert.rejects(d.write("QuoteMarket", "fill", [b, s], "investor"));
});
test("cancelled, expired and unfunded bids cannot move the seller tokens", async () => {
  const [b, s] = await bid();
  await d.write(
    "TestDollar",
    "approve",
    [d.addresses.QuoteMarket, 0n],
    "trader",
  );
  const before = await d.read("PendleYieldToken", "balanceOf", [
    d.actors.investor,
  ]);
  await assert.rejects(d.write("QuoteMarket", "fill", [b, s], "investor"));
  assert.equal(
    await d.read("PendleYieldToken", "balanceOf", [d.actors.investor]),
    before,
  );
  assert.equal(
    await d.read("QuoteMarket", "usedNonce", [b.maker, b.nonce]),
    false,
  );
  await d.write(
    "TestDollar",
    "approve",
    [d.addresses.QuoteMarket, maxUint256],
    "trader",
  );
  await d.write("QuoteMarket", "cancel", [b.nonce], "trader");
  await assert.rejects(d.write("QuoteMarket", "fill", [b, s], "investor"));
  const [b2, s2] = await bid(2n);
  await d.client.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(b2.deadline + 1n)],
  });
  await d.client.request({ method: "evm_mine" });
  await assert.rejects(d.write("QuoteMarket", "fill", [b2, s2], "investor"));
});

test("sponsored revocation authenticates the attestor, deadline and UID, and rejects replay", async () => {
  const types = {
    Revoke: [
      { name: "uid", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const message = {
    uid: d.uid,
    deadline: (await d.client.getBlock()).timestamp + 3600n,
  };
  const signature = await d.wallets.attestor.signTypedData({
    domain: claimDomain(31337, d.addresses.AttestationRegistry),
    types,
    primaryType: "Revoke",
    message,
  });
  await assert.rejects(
    d.write("AttestationRegistry", "revokeSigned", [
      d.uid,
      message.deadline + 1n,
      signature,
    ]),
  );
  await d.write(
    "AttestationRegistry",
    "revokeSigned",
    [d.uid, message.deadline, signature],
    "servicer",
  );
  assert.equal(await d.read("AttestationRegistry", "isValid", [d.uid]), false);
  await assert.rejects(
    d.write("AttestationRegistry", "revokeSigned", [
      d.uid,
      message.deadline,
      signature,
    ]),
  );
});
