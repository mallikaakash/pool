/** Arbitrum Sepolia fees, in integer wei. Never reuse a wallet's stale estimate.
 * A fee cap is a ceiling, not the amount charged per gas. Arbitrum needs no tip.
 */
export async function freshFees(client) {
  const [block, gasPrice] = await Promise.all([
    client.getBlock({ blockTag: "latest" }),
    client.getGasPrice({ cacheTime: 0 }),
  ]);
  const baseFee = block.baseFeePerGas ?? 0n;
  const floor = gasPrice > baseFee ? gasPrice : baseFee;
  return {
    maxFeePerGas: floor > 0n ? floor * 2n : 1n,
    maxPriorityFeePerGas: 0n,
  };
}
