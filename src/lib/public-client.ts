import { freshFees } from "./fees.mjs";
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  zeroAddress,
  parseUnits,
  keccak256,
  type Address,
  type Hex,
  type Abi,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import abis from "../generated/abis.json";
import { snapshot, action } from "./protocol.mjs";
export const chain = arbitrumSepolia;
export const client = createPublicClient({
  chain,
  transport: http(chain.rpcUrls.default.http[0], {
    timeout: 20000,
    retryCount: 2,
  }),
});
// Deployment metadata is JSON with integer amounts encoded as decimal strings.
export type Manifest = {
  schema: number;
  chainId: number;
  status: string;
  roles: Record<string, Address>;
  addresses: Record<string, Address>;
  codeHashes?: Record<string, Hex>;
  params?: Record<string, unknown>;
  marketId?: Hex;
  expiry?: number;
  deploymentBlock?: number;
  evidence?: { entries: Record<string, unknown>[]; documents: string[] };
  claim?: Record<string, unknown>;
  signature?: Hex;
  uid?: Hex;
  revocation?: { uid: Hex; deadline: string; signature: Hex };
  maturity?: {
    expiry: number;
    addresses: Record<string, Address>;
    codeHashes: Record<string, Hex>;
  };
  transactions?: import("../types").Transaction[];
  steps?: Record<string, unknown>;
  pending?: unknown;
};
export type Provider = {
  request: (a: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (name: string, fn: (...args: unknown[]) => void) => void;
  removeListener?: (name: string, fn: (...args: unknown[]) => void) => void;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export function wallet() {
  if (!window.ethereum)
    throw Error("Open this page in a browser with MetaMask installed.");
  return createWalletClient({ chain, transport: custom(window.ethereum) });
}
export async function connect() {
  const w = wallet();
  const [account] = await w.requestAddresses();
  await ensureChain();
  return account;
}
export async function ensureChain() {
  const w = wallet();
  if ((await w.getChainId()) !== chain.id) {
    try {
      await w.switchChain({ id: chain.id });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await w.addChain({ chain });
      await w.switchChain({ id: chain.id });
    }
  }
}
export function artifact(name: string) {
  const a = (abis as Record<string, { abi: unknown[] }>)[name];
  if (!a) throw Error(`Unknown contract ${name}`);
  return { abi: a.abi as Abi };
}
export function read(
  m: Manifest,
  name: string,
  fn: string,
  args: unknown[] = [],
  blockNumber?: bigint,
) {
  return client.readContract({
    address: m.addresses[name],
    abi: artifact(name).abi,
    functionName: fn,
    args,
    blockNumber,
  });
}
export async function validateManifest(m: Manifest) {
  if (m.chainId !== chain.id || m.schema !== 1)
    throw Error("Unsupported deployment network or manifest version.");
  await Promise.all(
    Object.entries(m.addresses).map(async ([name, address]) => {
      const code = await client.getCode({ address });
      if (
        !code ||
        code === "0x" ||
        (m.codeHashes?.[name] && keccak256(code) !== m.codeHashes[name])
      )
        throw Error(`Unexpected deployed code: ${name}`);
    }),
  );
}
export async function send(
  m: Manifest,
  account: Address,
  name: string,
  fn: string,
  args: unknown[] = [],
  notice: (text: string) => void = () => {},
) {
  const w = wallet();
  await ensureChain();
  if ((await w.getAddresses())[0]?.toLowerCase() !== account.toLowerCase())
    throw Error("Account changed. Reconnect and review this action.");
  notice(`Review ${fn} in MetaMask`);
  await client.simulateContract({
    ...(await freshFees(client)),
    account,
    address: m.addresses[name],
    abi: artifact(name).abi,
    functionName: fn,
    args,
  });
  const hash = await w.writeContract({
    account,
    address: m.addresses[name],
    abi: artifact(name).abi,
    functionName: fn,
    args,
    ...(await freshFees(client)),
  });
  notice(`Waiting for confirmation: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw Error(`Transaction reverted: ${hash}`);
  return hash;
}
export async function approve(
  m: Manifest,
  account: Address,
  token: string,
  spender: Address,
  amount: bigint,
  notice?: (text: string) => void,
) {
  const allowance = (await read(m, token, "allowance", [
    account,
    spender,
  ])) as bigint;
  if (allowance < amount)
    await send(m, account, token, "approve", [spender, amount], notice);
}
export function context(m: Manifest, account?: Address) {
  const actors = {
    servicer: m.roles.operator,
    investor: account ?? zeroAddress,
    liquidityProvider: m.roles.operator,
    backstop: account ?? zeroAddress,
    trader: m.roles.operator,
    attestor: m.roles.attestor,
  };
  return {
    client,
    chainId: chain.id,
    networkName: "Arbitrum Sepolia",
    actors,
    addresses: m.addresses,
    params: m.params,
    marketId: m.marketId,
    expiry: m.expiry,
    transactions: m.transactions ?? [],
    artifact,
    read: (n: string, f: string, a: unknown[] = [], block?: bigint) =>
      read(m, n, f, a, block),
  };
}
export async function publicSnapshot(m: Manifest, account?: Address) {
  return snapshot(context(m, account));
}
export async function publicAction(
  m: Manifest,
  account: Address,
  name: string,
  args: Record<string, unknown>,
  notice: (s: string) => void,
) {
  if (name === "advance") throw Error("Public testnet uses real time.");
  if (
    ["borrow", "collect", "impair"].includes(name) &&
    account.toLowerCase() !== m.roles.operator.toLowerCase()
  )
    throw Error("This action requires the operator wallet.");
  const amount = parseUnits(String(args.amount ?? "0"), 6),
    a = m.addresses;
  if (name === "deposit")
    await approve(m, account, "TestDollar", a.LenderVault, amount, notice);
  if (name === "collect")
    await approve(m, account, "TestDollar", a.ReceivablePool, amount, notice);
  if (["repay", "repayAll", "liquidate"].includes(name)) {
    const required =
      name === "repay"
        ? amount
        : ((await read(m, "TestDollar", "balanceOf", [account])) as bigint);
    await approve(m, account, "TestDollar", a.Morpho, required, notice);
  }
  if (name === "split")
    await approve(m, account, "LenderVault", a.YieldRouter, amount, notice);
  if (name === "redeem") {
    await approve(
      m,
      account,
      "PendlePrincipalToken",
      a.YieldRouter,
      amount,
      notice,
    );
    if (!(await read(m, "PendleYieldToken", "isExpired")))
      await approve(
        m,
        account,
        "PendleYieldToken",
        a.YieldRouter,
        amount,
        notice,
      );
  }
  const d = {
    ...context(m, account),
    write: async (n: string, f: string, values: unknown[]) => {
      if (n === "YieldRouter" && ["split", "redeem"].includes(f)) {
        const { result } = await client.simulateContract({
          ...(await freshFees(client)),
          account,
          address: a[n],
          abi: artifact(n).abi,
          functionName: f,
          args: values,
        });
        const minimum = ((result as bigint) * 995n) / 1000n;
        if (minimum === 0n)
          throw Error("Amount too small for a protected execution.");
        values = [values[0], minimum];
      }
      return send(m, account, n, f, values, notice);
    },
  };
  return action(d, name, args);
}
