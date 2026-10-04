import { test } from "node:test";
import assert from "node:assert/strict";
import { freshFees } from "../src/lib/fees.mjs";
test("fee cap stays above base fee when gas-price RPC lags the block", async () => {
  const client = {
    getBlock: async () => ({ baseFeePerGas: 52930000n }),
    getGasPrice: async (options) => {
      assert.equal(options.cacheTime, 0);
      return 52164000n;
    },
  };
  assert.deepEqual(await freshFees(client), {
    maxFeePerGas: 105860000n,
    maxPriorityFeePerGas: 0n,
  });
});
test("a new fee read is used on every transaction when base fee rises", async () => {
  let baseFeePerGas = 50000000n;
  const client = {
    getBlock: async () => ({ baseFeePerGas }),
    getGasPrice: async () => 60000000n,
  };
  assert.equal((await freshFees(client)).maxFeePerGas, 120000000n);
  baseFeePerGas = 90000000n;
  assert.equal((await freshFees(client)).maxFeePerGas, 180000000n);
});
