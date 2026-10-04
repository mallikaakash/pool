import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const file = process.argv[2] ?? "public/deployment.json";
const m = JSON.parse(fs.readFileSync(file));
if (m.chainId !== 421614 || m.status !== "ready")
  throw Error("Supply a ready Arbitrum Sepolia deployment manifest.");
const jobs = [];
for (const [label, step] of Object.entries(m.steps)) {
  if (!label.startsWith("Deploy ") || !step.artifact) continue;
  const a = JSON.parse(fs.readFileSync(`artifacts/${step.artifact}.json`));
  jobs.push({
    name: label.slice(7),
    address: step.address,
    artifact: a,
    hash: step.hash,
  });
}
for (const name of ["PendlePrincipalToken", "PendleYieldToken"])
  jobs.push({
    name,
    address: m.addresses[name],
    artifact: JSON.parse(fs.readFileSync(`artifacts/${name}.json`)),
    hash: m.steps["PendleYieldContractFactoryUpg.createYieldContract"]?.hash,
  });
const report = [];
for (const { name, address, artifact: a, hash } of jobs) {
  const body = {
    stdJsonInput: JSON.parse(fs.readFileSync(a.verificationFile)),
    compilerVersion: a.compiler.replace(".Emscripten.clang", ""),
    contractIdentifier: `${a.source}:${a.contractName}`,
    creationTransactionHash: hash,
  };
  try {
    const response = await fetch(
      `https://sourcify.dev/server/v2/verify/421614/${address}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const submitted = await response.json();
    let job = submitted;
    if (submitted.verificationId)
      for (let i = 0; i < 30; i++) {
        await delay(2000);
        job = await (
          await fetch(
            `https://sourcify.dev/server/v2/verify/${submitted.verificationId}`,
          )
        ).json();
        if (job.isJobCompleted) break;
      }
    const lookup = await fetch(
      `https://sourcify.dev/server/v2/contract/421614/${address}`,
    );
    const verified = await lookup.json();
    const success =
      lookup.ok && ["exact_match", "match"].includes(verified.runtimeMatch);
    report.push({
      name,
      address,
      success,
      submitted,
      job,
      result: verified,
      url: `https://repo.sourcify.dev/421614/${address}`,
    });
    console.log(
      `${name}: ${success ? "verified" : "not confirmed"} — https://repo.sourcify.dev/421614/${address}`,
    );
  } catch (e) {
    report.push({ name, address, success: false, error: e.message });
    console.error(`${name}: ${e.message}`);
  }
  fs.writeFileSync(
    "docs/source-verification.json",
    JSON.stringify(report, null, 2),
  );
}
if (report.some((r) => !r.success)) process.exitCode = 1;
