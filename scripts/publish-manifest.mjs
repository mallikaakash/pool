import fs from "node:fs";
import { createPublicClient, http, keccak256, verifyTypedData } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { claimTypes, claimDomain, portfolioRoot } from "../src/lib/claims.mjs";
const file = process.argv[2];
if (!file)
  throw Error(
    "Usage: node scripts/publish-manifest.mjs /path/to/exported/pool-deployment.json",
  );
const m = JSON.parse(fs.readFileSync(file)),
  config = JSON.parse(fs.readFileSync("config/arbitrum-sepolia.json"));
if (m.status !== "ready" || m.chainId !== 421614 || m.schema !== 1)
  throw Error("Not a ready Arbitrum Sepolia release.");
for (const [role, address] of Object.entries(config.roles))
  if (m.roles[role]?.toLowerCase() !== address.toLowerCase())
    throw Error(`Wrong ${role}`);
if (m.claim.root !== portfolioRoot(m.evidence.entries))
  throw Error("Evidence root mismatch");
if (
  !(await verifyTypedData({
    address: config.roles.attestor,
    domain: claimDomain(421614, m.addresses.AttestationRegistry),
    types: claimTypes,
    primaryType: "Claim",
    message: m.claim,
    signature: m.signature,
  }))
)
  throw Error("Invalid signature");
const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});
for (const [name, address] of Object.entries(m.addresses)) {
  const code = await client.getCode({ address });
  if (!code || keccak256(code) !== m.codeHashes[name])
    throw Error(`Code mismatch: ${name}`);
}
const a = JSON.parse(fs.readFileSync("artifacts/ReceivablePool.json"));
if (
  !(await client.readContract({
    address: m.addresses.ReceivablePool,
    abi: a.abi,
    functionName: "activated",
  }))
)
  throw Error("Pool has not been activated");
fs.writeFileSync("public/deployment.json", JSON.stringify(m, null, 2));
console.log(
  "Verified and installed public deployment manifest. Build and deploy the frontend to publish it.",
);
