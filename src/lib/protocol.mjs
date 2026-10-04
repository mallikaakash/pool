import { parseUnits, formatUnits } from "viem";
const units = (n) => parseUnits(String(n), 6);
const num = (n) => Number(formatUnits(n, 6));
const wad = (n) => Number(formatUnits(n, 18));
export const buyers = [
  "Straits Marine Supply",
  "Keppel Coast Logistics",
  "Meridian Food Services",
  "Jurong Components",
  "Lion City Packaging",
];
export const sectors = [
  "Marine services",
  "Logistics",
  "Food & beverage",
  "Manufacturing",
  "Packaging",
];

export async function snapshot(d) {
  const { read, actors, addresses, params, marketId, expiry, client } = d;
  const block = await client.getBlock();
  const r = (n, f, a = []) => read(n, f, a, block.number);
  const [
    nav,
    faceSupply,
    cash,
    impairment,
    closed,
    balances,
    position,
    debt,
    price,
    investorCash,
    shares,
    value,
    withdrawable,
    sy,
    pt,
    yt,
    exchangeRate,
    backstopCash,
    backstopCollateral,
    invoices,
  ] = await Promise.all([
    r("ReceivablePool", "nav"),
    r("ReceivablePool", "totalSupply"),
    r("TestDollar", "balanceOf", [addresses.ReceivablePool]),
    r("ReceivablePool", "totalImpairment"),
    r("ReceivablePool", "closed"),
    r("LenderVault", "marketBalances"),
    r("Morpho", "position", [marketId, addresses.ReceivablePool]),
    r("ReceivablePool", "debt"),
    r("ReceivableOracle", "price"),
    r("TestDollar", "balanceOf", [actors.investor]),
    r("LenderVault", "balanceOf", [actors.investor]),
    r("LenderVault", "balanceOf", [actors.investor]).then((s) =>
      r("LenderVault", "convertToAssets", [s]),
    ),
    r("LenderVault", "maxWithdraw", [actors.investor]),
    r("PoolSY", "balanceOf", [actors.investor]),
    r("PendlePrincipalToken", "balanceOf", [actors.investor]),
    r("PendleYieldToken", "balanceOf", [actors.investor]),
    r("PoolSY", "exchangeRate"),
    r("TestDollar", "balanceOf", [actors.backstop]),
    r("ReceivablePool", "balanceOf", [actors.backstop]),
    Promise.all(
      buyers.map((_, i) => r("ReceivablePool", "invoices", [BigInt(i)])),
    ),
  ]);
  const { result: interest } = await client.simulateContract({
    address: addresses.PendleYieldToken,
    abi: d.artifact("PendleYieldToken").abi,
    functionName: "redeemDueInterestAndRewards",
    args: [actors.investor, true, false],
    account: actors.investor,
    blockNumber: block.number,
  });
  const supplied = num(balances[0]),
    borrowed = num(balances[2]),
    collateral = num(position[2]),
    collateralPrice = Number(formatUnits(price, 36));
  const ltv =
    collateral * collateralPrice > 0
      ? num(debt) / (collateral * collateralPrice)
      : 0;
  return {
    network: {
      name: d.networkName ?? "Anvil local demo",
      chainId: d.chainId ?? 31337,
      block: Number(block.number),
      timestamp: Number(block.timestamp),
    },
    addresses,
    actors,
    pool: {
      nav: num(nav),
      face: invoices.reduce((s, i) => s + num(i[0] - i[2]), 0),
      cash: num(cash),
      shareSupply: num(faceSupply),
      collateralPrice,
      impairment: num(impairment),
      closed,
    },
    market: {
      totalSupply: supplied,
      totalBorrow: borrowed,
      liquidity: Math.max(0, supplied - borrowed),
      utilization: supplied ? borrowed / supplied : 0,
      borrowAPY: Math.expm1(0.12),
      supplyAPY: Math.expm1(0.12 * (supplied ? borrowed / supplied : 0)),
      lltv: wad(params.lltv),
      collateral,
      debt: num(debt),
      ltv,
      healthFactor: ltv > 0 ? wad(params.lltv) / ltv : null,
    },
    investor: {
      cash: num(investorCash),
      shares: num(shares),
      value: num(value),
      withdrawable: num(withdrawable),
    },
    yield: {
      sy: num(sy),
      pt: num(pt),
      yt: num(yt),
      expiry,
      expired: Number(block.timestamp) >= expiry,
      claimable: num(interest[0]),
      exchangeRate: wad(exchangeRate),
    },
    backstop: { cash: num(backstopCash), collateral: num(backstopCollateral) },
    invoices: invoices.map((i, id) => ({
      id,
      buyer: buyers[id],
      sector: sectors[id],
      face: num(i[0]),
      value: num(i[1]),
      collected: num(i[2]),
      loss: num(i[3]),
      due: Number(i[4]),
      evidence: i[5],
      status:
        i[2] === i[0]
          ? "Collected"
          : i[3] > 0
            ? "Impaired"
            : Number(i[4]) < Number(block.timestamp)
              ? "Past due"
              : "Performing",
    })),
    transactions: d.transactions.slice(0, 80),
  };
}

function positiveAmount(value) {
  const text = String(value ?? "");
  if (
    !/^\d+(\.\d{1,6})?$/.test(text) ||
    Number(text) <= 0 ||
    Number(text) > 10000000
  )
    throw Error("Enter a positive amount, with up to six decimals.");
  return units(text);
}
export async function action(d, name, p = {}) {
  const { write, read, actors, addresses, params, marketId, client } = d;
  switch (name) {
    case "faucet":
      return write("TestDollar", "claim", [], "investor", "Claim test dollars");
    case "deposit":
      return write(
        "LenderVault",
        "deposit",
        [positiveAmount(p.amount), actors.investor],
        "investor",
        "Deposit into lending vault",
      );
    case "withdraw":
      return write(
        "LenderVault",
        "withdraw",
        [positiveAmount(p.amount), actors.investor, actors.investor],
        "investor",
        "Withdraw available liquidity",
      );
    case "borrow":
      return write(
        "ReceivablePool",
        "borrow",
        [positiveAmount(p.amount)],
        "servicer",
        "Draw facility",
      );
    case "repay":
      return write(
        "Morpho",
        "repay",
        [params, positiveAmount(p.amount), 0n, addresses.ReceivablePool, "0x"],
        "servicer",
        "Repay facility",
      );
    case "repayAll": {
      const position = await read("Morpho", "position", [
        marketId,
        addresses.ReceivablePool,
      ]);
      if (position[1] === 0n) throw Error("The facility has no debt.");
      return write(
        "Morpho",
        "repay",
        [params, 0n, position[1], addresses.ReceivablePool, "0x"],
        "servicer",
        "Repay all facility debt",
      );
    }
    case "collect": {
      if (!Number.isInteger(p.id) || p.id < 0 || p.id >= 5)
        throw Error("Unknown invoice.");
      return write(
        "ReceivablePool",
        "collect",
        [BigInt(p.id), positiveAmount(p.amount)],
        "servicer",
        `Collect invoice SG-${p.id + 1}`,
      );
    }
    case "impair": {
      if (!Number.isInteger(p.id) || p.id < 0 || p.id >= 5)
        throw Error("Unknown invoice.");
      const value =
        p.amount === "0" || p.amount === 0 ? 0n : positiveAmount(p.amount);
      return write(
        "ReceivablePool",
        "impair",
        [BigInt(p.id), value],
        "servicer",
        `Recognize loss on SG-${p.id + 1}`,
      );
    }
    case "sweep":
      return write(
        "ReceivablePool",
        "sweep",
        [],
        "servicer",
        "Sweep collections into debt repayment",
      );
    case "close":
      return write(
        "ReceivablePool",
        "close",
        [],
        "servicer",
        "Close debt-free facility",
      );
    case "redeemCollateral":
      return write(
        "ReceivablePool",
        "redeemCollateral",
        [positiveAmount(p.amount)],
        "backstop",
        "Redeem recovered collateral",
      );
    case "split":
      return write(
        "YieldRouter",
        "split",
        [positiveAmount(p.amount), 0n],
        "investor",
        "Split vault shares into Pendle PT + YT",
      );
    case "redeem":
      return write(
        "YieldRouter",
        "redeem",
        [positiveAmount(p.amount), 0n],
        "investor",
        "Redeem Pendle position to vault shares",
      );
    case "claim":
      return write(
        "PendleYieldToken",
        "redeemDueInterestAndRewards",
        [actors.investor, true, false],
        "investor",
        "Claim accrued yield as SY",
      );
    case "unwrap":
      return write(
        "PoolSY",
        "redeem",
        [
          actors.investor,
          positiveAmount(p.amount),
          addresses.LenderVault,
          0n,
          false,
        ],
        "investor",
        "Unwrap SY to lender vault shares",
      );
    case "transferYT":
      return write(
        "PendleYieldToken",
        "transfer",
        [actors.trader, positiveAmount(p.amount)],
        "investor",
        "Transfer yield rights to separate trader",
      );
    case "advance": {
      if (d.chainId && d.chainId !== 31337)
        throw Error(
          "Time travel is available only on the disposable local chain.",
        );
      if (![7, 30, 100].includes(p.days))
        throw Error("Choose 7, 30 or 100 days.");
      await client.request({
        method: "evm_increaseTime",
        params: [p.days * 86400],
      });
      await client.request({ method: "evm_mine", params: [] });
      return write(
        "Morpho",
        "accrueInterest",
        [params],
        "servicer",
        `Advance local clock ${p.days} days and accrue interest`,
      );
    }
    case "liquidate": {
      const position = await read("Morpho", "position", [
        marketId,
        addresses.ReceivablePool,
      ]);
      // Seize a bounded parcel, paid for from the finite backstop wallet.
      const requested = positiveAmount(p.amount);
      if (requested > position[2])
        throw Error("Amount exceeds pledged collateral.");
      return write(
        "Morpho",
        "liquidate",
        [params, addresses.ReceivablePool, requested, 0n, "0x"],
        "backstop",
        "Liquidate impaired collateral with funded backstop",
      );
    }
    default:
      throw Error("Unknown action.");
  }
}
