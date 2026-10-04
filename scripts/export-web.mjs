import fs from "node:fs";
const names = [
  "TestDollar",
  "AttestationRegistry",
  "ReceivablePool",
  "ReceivableOracle",
  "Morpho",
  "DemoRateModel",
  "LenderVault",
  "PoolSY",
  "PendlePrincipalToken",
  "PendleYieldToken",
  "PendleYieldContractFactoryUpg",
  "ERC1967Proxy",
  "YieldRouter",
  "QuoteMarket",
];
fs.mkdirSync("public/setup", { recursive: true });
fs.mkdirSync("src/generated", { recursive: true });
const abis = {},
  deploy = {};
for (const name of names) {
  const artifact = JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
  abis[name] = { abi: artifact.abi };
  deploy[name] = {
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    source: artifact.source,
    compiler: artifact.compiler,
  };
}
fs.writeFileSync("src/generated/abis.json", JSON.stringify(abis));
fs.writeFileSync("public/setup/artifacts.json", JSON.stringify(deploy));
if (!fs.existsSync("public/deployment.json"))
  fs.writeFileSync(
    "public/deployment.json",
    JSON.stringify(
      { schema: 1, chainId: 421614, status: "not_deployed", addresses: {} },
      null,
      2,
    ),
  );
