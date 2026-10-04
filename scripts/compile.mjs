import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import solcMorpho from "solc-morpho";

const sources = Object.fromEntries(
  fs
    .readdirSync("contracts")
    .filter((f) => f.endsWith(".sol"))
    .map((f) => [
      `contracts/${f}`,
      { content: fs.readFileSync(`contracts/${f}`, "utf8") },
    ]),
);
function compile(compiler, sources, evmVersion) {
  const resolved = { ...sources };
  const settings = {
    optimizer: { enabled: true, runs: 200 },
    evmVersion,
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
          "metadata",
        ],
      },
    },
  };
  const output = JSON.parse(
    compiler.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings,
      }),
      {
        import: (name) => {
          for (const p of [name, path.join("node_modules", name)])
            if (fs.existsSync(p)) {
              const contents = fs.readFileSync(p, "utf8");
              resolved[name] = { content: contents };
              return { contents };
            }
          return { error: `Cannot resolve ${name}` };
        },
      },
    ),
  );
  for (const error of output.errors ?? [])
    if (error.severity === "error") console.error(error.formattedMessage);
  if (output.errors?.some((e) => e.severity === "error")) process.exit(1);
  fs.mkdirSync("artifacts", { recursive: true });
  fs.mkdirSync("verification", { recursive: true });
  const verificationFile = `verification/solc-${compiler.version().split("+")[0]}.json`;
  fs.writeFileSync(
    verificationFile,
    JSON.stringify({ language: "Solidity", sources: resolved, settings }),
  );
  let count = 0;
  for (const [source, contracts] of Object.entries(output.contracts))
    for (const [name, c] of Object.entries(contracts)) {
      if (!c.evm.bytecode.object) continue;
      fs.writeFileSync(
        `artifacts/${name}.json`,
        JSON.stringify({
          source,
          contractName: name,
          compiler: compiler.version(),
          verificationFile,
          metadata: c.metadata,
          abi: c.abi,
          bytecode: `0x${c.evm.bytecode.object}`,
          runtimeBytes: c.evm.deployedBytecode.object.length / 2,
        }),
      );
      count++;
    }
  console.log(`Compiled ${count} contracts with solc ${compiler.version()}`);
}
compile(solc, sources, "cancun");
compile(
  solcMorpho,
  {
    "@morpho-org/morpho-blue/src/Morpho.sol": {
      content: fs.readFileSync(
        "node_modules/@morpho-org/morpho-blue/src/Morpho.sol",
        "utf8",
      ),
    },
  },
  "paris",
);
