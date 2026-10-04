import fs from "node:fs";
import { snapshot, action } from "../src/lib/protocol.mjs";
export { snapshot, action } from "../src/lib/protocol.mjs";
import {
  fixture,
  portfolioRoot,
  claimTypes,
  claimDomain,
} from "../src/lib/claims.mjs";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseUnits,
  formatUnits,
  maxUint256,
} from "viem";
import { foundry } from "viem/chains";

const cache = new Map();
export function artifact(name) {
  if (!cache.has(name))
    cache.set(
      name,
      JSON.parse(fs.readFileSync(`artifacts/${name}.json`, "utf8")),
    );
  return cache.get(name);
}
export const units = (n) => parseUnits(String(n), 6);
const num = (n) => Number(formatUnits(n, 6));
const wad = (n) => Number(formatUnits(n, 18));

export async function createDemo(
  rpc = "http://127.0.0.1:8545",
  persist = false,
) {
  const client = createPublicClient({
    chain: foundry,
    transport: http(rpc),
    pollingInterval: 100,
  });
  if ((await client.getChainId()) !== 31337)
    throw Error("Only disposable local chain 31337 is supported.");
  // Anvil exposes disposable unlocked accounts. No wallet seed or private key is stored.
  const accounts = await client.request({ method: "eth_accounts" });
  const actors = Object.fromEntries(
    [
      "servicer",
      "investor",
      "liquidityProvider",
      "backstop",
      "trader",
      "attestor",
    ].map((r, i) => [r, accounts[i]]),
  );
  const wallets = Object.fromEntries(
    Object.entries(actors).map(([r, a]) => [
      r,
      createWalletClient({ account: a, chain: foundry, transport: http(rpc) }),
    ]),
  );
  const addresses = {};
  const transactions = [];
  const read = (name, fn, args = [], blockNumber) =>
    client.readContract({
      address: addresses[name],
      abi: artifact(name).abi,
      functionName: fn,
      args,
      blockNumber,
    });
  async function record(hash, label, role) {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw Error(`${label} reverted: ${hash}`);
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    transactions.unshift({
      hash,
      label,
      role,
      block: Number(receipt.blockNumber),
      time: Number(block.timestamp),
      status: receipt.status,
    });
    if (persist) {
      fs.mkdirSync(".runtime", { recursive: true });
      fs.writeFileSync(
        ".runtime/transactions.json",
        JSON.stringify(transactions),
      );
    }
    return receipt;
  }
  async function write(name, fn, args = [], role = "servicer", label = fn) {
    const { request } = await client.simulateContract({
      account: actors[role],
      address: addresses[name],
      abi: artifact(name).abi,
      functionName: fn,
      args,
    });
    const hash = await wallets[role].writeContract(request);
    await record(hash, label, role);
    return hash;
  }
  async function deploy(name, args = []) {
    const { abi, bytecode } = artifact(name);
    const hash = await wallets.servicer.deployContract({ abi, bytecode, args });
    const receipt = await record(hash, `Deploy ${name}`, "servicer");
    addresses[name] = receipt.contractAddress;
    return receipt.contractAddress;
  }
  console.log(
    "Deploying actual Morpho Blue and Pendle core, plus Pool adapters…",
  );
  await deploy("TestDollar");
  await deploy("Morpho", [actors.servicer]);
  await deploy("DemoRateModel");
  await deploy("AttestationRegistry", [actors.attestor]);
  await deploy("ReceivablePool", [
    addresses.TestDollar,
    actors.servicer,
    addresses.AttestationRegistry,
  ]);
  const issuedAt = Number((await client.getBlock()).timestamp);
  const evidence = fixture(issuedAt);
  const claim = {
    pool: addresses.ReceivablePool,
    root: portfolioRoot(evidence.entries),
    currency: addresses.TestDollar,
    face: 500000000000n,
    book: 485000000000n,
    asOf: BigInt(issuedAt),
    validUntil: BigInt(issuedAt + 365 * 86400),
    nonce: 1n,
  };
  const signature = await wallets.attestor.signTypedData({
    domain: claimDomain(31337, addresses.AttestationRegistry),
    types: claimTypes,
    primaryType: "Claim",
    message: claim,
  });
  await write("AttestationRegistry", "publish", [claim, signature]);
  const uid = await read("AttestationRegistry", "digest", [claim]);
  await write("ReceivablePool", "admit", [uid, evidence.entries]);
  await deploy("ReceivableOracle", [addresses.ReceivablePool]);
  const params = {
    loanToken: addresses.TestDollar,
    collateralToken: addresses.ReceivablePool,
    oracle: addresses.ReceivableOracle,
    irm: addresses.DemoRateModel,
    lltv: 625000000000000000n,
  };
  const marketId = keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "loanToken", type: "address" },
            { name: "collateralToken", type: "address" },
            { name: "oracle", type: "address" },
            { name: "irm", type: "address" },
            { name: "lltv", type: "uint256" },
          ],
        },
      ],
      [params],
    ),
  );
  await write("Morpho", "enableIrm", [addresses.DemoRateModel]);
  await write("Morpho", "enableLltv", [params.lltv]);
  await write("Morpho", "createMarket", [params]);
  await write("ReceivablePool", "activate", [addresses.Morpho, params]);
  await deploy("LenderVault", [addresses.Morpho, params]);
  await deploy("PoolSY", [addresses.LenderVault]);

  // Use Pendle's unmodified factory. Its YT init code is stored in two contracts.
  const ytCode = artifact("PendleYieldToken").bytecode.slice(2);
  const split = Math.floor(ytCode.length / 4) * 2;
  const codeAddresses = [];
  for (const piece of [ytCode.slice(0, split), ytCode.slice(split)]) {
    const hash = await wallets.servicer.sendTransaction({
      data: `0x602038038060206000396000f3fefefefefefefefefefefefefefefefefefefe${piece}`,
    });
    const receipt = await record(
      hash,
      "Store Pendle YT creation code",
      "servicer",
    );
    codeAddresses.push(receipt.contractAddress);
  }
  await deploy("PendleYieldContractFactoryUpg", [
    codeAddresses[0],
    BigInt(split / 2),
    codeAddresses[1],
    BigInt((ytCode.length - split) / 2),
  ]);
  const init = encodeFunctionData({
    abi: artifact("PendleYieldContractFactoryUpg").abi,
    functionName: "initialize",
    args: [86400n, 0n, 0n, actors.servicer, actors.servicer],
  });
  await deploy("ERC1967Proxy", [addresses.PendleYieldContractFactoryUpg, init]);
  addresses.PendleYieldContractFactoryUpg = addresses.ERC1967Proxy;
  const now = Number((await client.getBlock()).timestamp);
  const expiry = Math.ceil((now + 90 * 86400) / 86400) * 86400;
  await write("PendleYieldContractFactoryUpg", "createYieldContract", [
    addresses.PoolSY,
    expiry,
    false,
  ]);
  addresses.PendlePrincipalToken = await read(
    "PendleYieldContractFactoryUpg",
    "getPT",
    [addresses.PoolSY, BigInt(expiry)],
  );
  addresses.PendleYieldToken = await read(
    "PendleYieldContractFactoryUpg",
    "getYT",
    [addresses.PoolSY, BigInt(expiry)],
  );
  await deploy("YieldRouter", [
    addresses.PoolSY,
    addresses.PendleYieldToken,
    addresses.LenderVault,
  ]);

  await deploy("QuoteMarket", [
    addresses.TestDollar,
    addresses.PendlePrincipalToken,
    addresses.PendleYieldToken,
  ]);

  for (const [role, amount] of [
    ["servicer", 500000],
    ["investor", 75000],
    ["liquidityProvider", 400000],
    ["backstop", 150000],
    ["trader", 50000],
  ]) {
    await write("TestDollar", "mint", [actors[role], units(amount)]);
    await write(
      "TestDollar",
      "approve",
      [addresses.LenderVault, maxUint256],
      role,
    );
    await write("TestDollar", "approve", [addresses.Morpho, maxUint256], role);
  }
  await write(
    "TestDollar",
    "approve",
    [addresses.ReceivablePool, maxUint256],
    "servicer",
  );
  await write(
    "LenderVault",
    "deposit",
    [units(375000), actors.liquidityProvider],
    "liquidityProvider",
    "Seed facility liquidity",
  );
  await write(
    "LenderVault",
    "deposit",
    [units(25000), actors.investor],
    "investor",
    "Deposit 25,000 test dollars",
  );
  await write(
    "ReceivablePool",
    "borrow",
    [units(250000)],
    "servicer",
    "Draw 250,000 against receivables",
  );
  for (const name of [
    "LenderVault",
    "PendlePrincipalToken",
    "PendleYieldToken",
  ])
    await write(
      name,
      "approve",
      [addresses.YieldRouter, maxUint256],
      "investor",
    );
  const demo = {
    client,
    claim,
    signature,
    evidence,
    uid,
    deploy,
    artifact,
    actors,
    wallets,
    addresses,
    params,
    marketId,
    expiry,
    transactions,
    read,
    write,
    record,
  };
  if (persist)
    fs.writeFileSync(
      ".runtime/deployment.json",
      JSON.stringify({ addresses, actors, marketId, expiry }, null, 2),
    );
  demo.state = () => snapshot(demo);
  demo.action = (a, p) => action(demo, a, p);
  console.log(
    `Ready: market ${marketId.slice(0, 12)} · expiry ${new Date(expiry * 1000).toISOString().slice(0, 10)}`,
  );
  return demo;
}
