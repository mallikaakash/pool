import { encodeAbiParameters, keccak256, stringToHex } from "viem";
export const claimTypes = {
  Claim: [
    { name: "pool", type: "address" },
    { name: "root", type: "bytes32" },
    { name: "currency", type: "address" },
    { name: "face", type: "uint256" },
    { name: "book", type: "uint256" },
    { name: "asOf", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};
export const revokeTypes = {
  Revoke: [
    { name: "uid", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
};
export const bidTypes = {
  Bid: [
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "payment", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};
export const entryType = [
  {
    type: "tuple[]",
    components: [
      { name: "id", type: "bytes32" },
      { name: "face", type: "uint256" },
      { name: "book", type: "uint256" },
      { name: "due", type: "uint256" },
      { name: "evidence", type: "bytes32" },
    ],
  },
];
export const claimDomain = (chainId, registry) => ({
  name: "Pool Attestations",
  version: "1",
  chainId,
  verifyingContract: registry,
});
export const bidDomain = (chainId, market) => ({
  name: "Pool Quotes",
  version: "1",
  chainId,
  verifyingContract: market,
});
export const json = (value) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
export const portfolioRoot = (entries) =>
  keccak256(encodeAbiParameters(entryType, [entries]));
export function fixture(now) {
  const entries = [],
    documents = [];
  for (const [i, face] of [120000, 100000, 90000, 110000, 80000].entries()) {
    const id = `SYNTHETIC-SG-${i + 1}`;
    // Exact UTF-8 bytes, downloaded unchanged, are the evidence commitment.
    const document = json({
      schema: "pool.synthetic-invoice.v1",
      id,
      synthetic: true,
      currency: "tUSD",
      face: String(face * 1e6),
      book: String(face * 970000),
      due: now + (30 + i * 15) * 86400,
      notice:
        "Fictional demonstration receivable. No external verification or legal assignment.",
    });
    documents.push(document);
    entries.push({
      id: keccak256(stringToHex(id)),
      face: BigInt(face) * 1000000n,
      book: BigInt(face) * 970000n,
      due: BigInt(now + (30 + i * 15) * 86400),
      evidence: keccak256(stringToHex(document)),
    });
  }
  return { entries, documents };
}
