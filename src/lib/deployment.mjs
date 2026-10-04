import {
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  hashTypedData,
  parseUnits,
} from "viem";
import { fixture, portfolioRoot, claimDomain, claimTypes } from "./claims.mjs";
const units = (n) => parseUnits(String(n), 6);
export function newManifest(config) {
  return {
    schema: 1,
    chainId: config.chainId,
    status: "preparing",
    roles: config.roles,
    addresses: {},
    codeHashes: {},
    steps: {},
    transactions: [],
    pending: null,
  };
}
export async function runDeployment({
  client,
  wallet,
  artifacts,
  manifest: m,
  save,
  progress,
  prepareMaturity = false,
}) {
  if (
    (await client.getChainId()) !== m.chainId ||
    (await wallet.getChainId()) !== m.chainId
  )
    throw Error("Wrong network. Switch MetaMask to the configured chain.");
  const [account] = await wallet.getAddresses();
  if (account?.toLowerCase() !== m.roles.operator.toLowerCase())
    throw Error("Connect the configured operator wallet.");
  const persist = () => save(m);
  const finish = async (label, hash) => {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });
    if (receipt.status !== "success") {
      m.pending = null;
      persist();
      throw Error(`${label} reverted. No completed step was recorded.`);
    }
    m.steps[label] = {
      hash,
      address: receipt.contractAddress,
      block: Number(receipt.blockNumber),
    };
    if (!m.deploymentBlock) m.deploymentBlock = Number(receipt.blockNumber);
    m.transactions.push({
      hash,
      label,
      role: "operator",
      block: Number(receipt.blockNumber),
      time: Number(
        (await client.getBlock({ blockNumber: receipt.blockNumber })).timestamp,
      ),
      status: "success",
    });
    m.pending = null;
    persist();
    return m.steps[label];
  };
  if (m.pending) await finish(m.pending.label, m.pending.hash);
  for (const [name, address] of Object.entries(m.addresses)) {
    const code = await client.getCode({ address });
    if (
      !code ||
      code === "0x" ||
      (m.codeHashes[name] && keccak256(code) !== m.codeHashes[name])
    )
      throw Error(
        `Code verification failed for ${name}. Do not resume this deployment.`,
      );
  }
  const step = async (label, send) => {
    if (m.steps[label]) return m.steps[label];
    progress(label);
    if (
      (await wallet.getChainId()) !== m.chainId ||
      (await wallet.getAddresses())[0]?.toLowerCase() !== account.toLowerCase()
    )
      throw Error("Wallet account or network changed.");
    const hash = await send();
    m.pending = { label, hash };
    persist();
    return finish(label, hash);
  };
  const remember = async (name, address) => {
    m.addresses[name] = address;
    m.codeHashes[name] = keccak256(await client.getCode({ address }));
    persist();
    return address;
  };
  const deploy = async (name, args = [], artifactName = name) => {
    const a = artifacts[artifactName];
    const r = await step(`Deploy ${name}`, () =>
      wallet.deployContract({
        account,
        abi: a.abi,
        bytecode: a.bytecode,
        args,
      }),
    );
    m.steps[`Deploy ${name}`].args = args;
    m.steps[`Deploy ${name}`].artifact = artifactName;
    return remember(name, r.address);
  };
  const read = (name, fn, args = []) =>
    client.readContract({
      address: m.addresses[name],
      abi: artifacts[name].abi,
      functionName: fn,
      args,
    });
  const write = (name, fn, args = [], label = `${name}.${fn}`) =>
    step(label, async () => {
      const { request } = await client.simulateContract({
        account,
        address: m.addresses[name],
        abi: artifacts[name].abi,
        functionName: fn,
        args,
      });
      return wallet.writeContract(request);
    });
  await deploy("TestDollar");
  await deploy("AttestationRegistry", [m.roles.attestor]);
  await deploy("ReceivablePool", [
    m.addresses.TestDollar,
    m.roles.operator,
    m.addresses.AttestationRegistry,
  ]);
  if (!m.evidence) {
    const now = Number((await client.getBlock()).timestamp);
    m.evidence = fixture(now);
    m.claim = {
      pool: m.addresses.ReceivablePool,
      root: portfolioRoot(m.evidence.entries),
      currency: m.addresses.TestDollar,
      face: units(500000),
      book: units(485000),
      asOf: BigInt(now),
      validUntil: BigInt(now + 30 * 86400),
      nonce: BigInt(now),
    };
    m.uid = hashTypedData({
      domain: claimDomain(m.chainId, m.addresses.AttestationRegistry),
      types: claimTypes,
      primaryType: "Claim",
      message: m.claim,
    });
    persist();
  }
  await deploy("Morpho", [account]);
  await deploy("DemoRateModel");
  await deploy("ReceivableOracle", [m.addresses.ReceivablePool]);
  m.params = {
    loanToken: m.addresses.TestDollar,
    collateralToken: m.addresses.ReceivablePool,
    oracle: m.addresses.ReceivableOracle,
    irm: m.addresses.DemoRateModel,
    lltv: 625000000000000000n,
  };
  m.marketId = keccak256(
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
      [m.params],
    ),
  );
  persist();
  await write("Morpho", "enableIrm", [m.addresses.DemoRateModel]);
  await write("Morpho", "enableLltv", [m.params.lltv]);
  await write("Morpho", "createMarket", [m.params]);
  await deploy("LenderVault", [m.addresses.Morpho, m.params]);
  await deploy("PoolSY", [m.addresses.LenderVault]);
  const ytCode = artifacts.PendleYieldToken.bytecode.slice(2),
    split = Math.floor(ytCode.length / 4) * 2;
  for (const [i, piece] of [
    ytCode.slice(0, split),
    ytCode.slice(split),
  ].entries()) {
    const r = await step(`Store Pendle creation code ${i}`, () =>
      wallet.sendTransaction({
        account,
        data: `0x602038038060206000396000f3fefefefefefefefefefefefefefefefefefefe${piece}`,
      }),
    );
    await remember(`PendleCode${i}`, r.address);
  }
  await deploy(
    "FactoryImplementation",
    [
      m.addresses.PendleCode0,
      BigInt(split / 2),
      m.addresses.PendleCode1,
      BigInt((ytCode.length - split) / 2),
    ],
    "PendleYieldContractFactoryUpg",
  );
  const init = encodeFunctionData({
    abi: artifacts.PendleYieldContractFactoryUpg.abi,
    functionName: "initialize",
    args: [3600n, 0n, 0n, account, account],
  });
  await deploy("ERC1967Proxy", [m.addresses.FactoryImplementation, init]);
  await remember("PendleYieldContractFactoryUpg", m.addresses.ERC1967Proxy);
  if (!m.expiry) {
    m.expiry =
      Math.ceil(
        (Number((await client.getBlock()).timestamp) + 7 * 86400) / 3600,
      ) * 3600;
    persist();
  }
  await write("PendleYieldContractFactoryUpg", "createYieldContract", [
    m.addresses.PoolSY,
    m.expiry,
    false,
  ]);
  await remember(
    "PendlePrincipalToken",
    await read("PendleYieldContractFactoryUpg", "getPT", [
      m.addresses.PoolSY,
      m.expiry,
    ]),
  );
  await remember(
    "PendleYieldToken",
    await read("PendleYieldContractFactoryUpg", "getYT", [
      m.addresses.PoolSY,
      m.expiry,
    ]),
  );
  await deploy("YieldRouter", [
    m.addresses.PoolSY,
    m.addresses.PendleYieldToken,
    m.addresses.LenderVault,
  ]);
  await deploy("QuoteMarket", [
    m.addresses.TestDollar,
    m.addresses.PendlePrincipalToken,
    m.addresses.PendleYieldToken,
  ]);
  if (!m.signature) {
    m.status = "awaiting_attestation";
    persist();
    progress("Contracts prepared. Export the bundle for the attestor to sign.");
    return m;
  }
  if (!(await read("AttestationRegistry", "isValid", [m.uid]))) {
    await write("AttestationRegistry", "publish", [m.claim, m.signature]);
  }
  await write("ReceivablePool", "admit", [m.uid, m.evidence.entries]);
  await write("ReceivablePool", "activate", [m.addresses.Morpho, m.params]);
  await write("TestDollar", "mint", [account, units(900000)]);
  await write(
    "TestDollar",
    "mint",
    [m.roles.investor, units(75000)],
    "Fund investor",
  );
  await write(
    "TestDollar",
    "approve",
    [m.addresses.LenderVault, units(375000)],
    "Approve seed deposit",
  );
  await write(
    "LenderVault",
    "deposit",
    [units(375000), account],
    "Seed lending liquidity",
  );
  if (prepareMaturity) {
    if (!m.maturity) {
      m.maturity = {
        expiry:
          Math.ceil(
            (Number((await client.getBlock()).timestamp) + 300) / 3600,
          ) * 3600,
        addresses: {},
        codeHashes: {},
      };
      persist();
    }
    const expiry = m.maturity.expiry;
    await write(
      "PendleYieldContractFactoryUpg",
      "createYieldContract",
      [m.addresses.PoolSY, expiry, false],
      "Create short maturity series",
    );
    const pt = await read("PendleYieldContractFactoryUpg", "getPT", [
      m.addresses.PoolSY,
      expiry,
    ]);
    const yt = await read("PendleYieldContractFactoryUpg", "getYT", [
      m.addresses.PoolSY,
      expiry,
    ]);
    await deploy(
      "MaturityRouter",
      [m.addresses.PoolSY, yt, m.addresses.LenderVault],
      "YieldRouter",
    );
    m.maturity.addresses = {
      PendlePrincipalToken: pt,
      PendleYieldToken: yt,
      YieldRouter: m.addresses.MaturityRouter,
    };
    for (const [name, address] of Object.entries(m.maturity.addresses))
      m.maturity.codeHashes[name] = keccak256(
        await client.getCode({ address }),
      );
    persist();
    await write(
      "LenderVault",
      "approve",
      [m.addresses.MaturityRouter, units(1000)],
      "Approve short series seed",
    );
    await step("Seed short series", async () => {
      const { request } = await client.simulateContract({
        account,
        address: m.addresses.MaturityRouter,
        abi: artifacts.YieldRouter.abi,
        functionName: "split",
        args: [units(1000), units(1000)],
      });
      return wallet.writeContract(request);
    });
    for (const [name, address] of [
      ["PT", pt],
      ["YT", yt],
    ])
      await step(`Transfer short series ${name} to investor`, async () => {
        const { request } = await client.simulateContract({
          account,
          address,
          abi: artifacts.TestDollar.abi,
          functionName: "transfer",
          args: [m.roles.investor, units(500)],
        });
        return wallet.writeContract(request);
      });
  }
  m.status = "ready";
  persist();
  progress("Deployment complete. Export the manifest for the public release.");
  return m;
}
