import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import { createDemo } from "./chain.mjs";
import { serve } from "./server.mjs";

const children = [];
let server;
const stop = () => {
  server?.close();
  for (const child of children) child.kill("SIGTERM");
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
async function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: "inherit" });
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${cmd} exited ${code}`)),
    );
  });
}
try {
  await run(process.execPath, ["scripts/compile.mjs"]);
  await run(process.execPath, ["scripts/export-web.mjs"]);
  fs.mkdirSync(".runtime", { recursive: true });
  const log = fs.openSync(".runtime/anvil.log", "w");
  // A fresh disposable chain on every start; reloads in the browser preserve state.
  const anvil = spawn(
    "anvil",
    [
      "--host",
      "127.0.0.1",
      "--port",
      "8545",
      "--chain-id",
      "31337",
      "--silent",
    ],
    { stdio: ["ignore", log, log] },
  );
  children.push(anvil);
  let failed;
  anvil.on("error", (e) => {
    failed = e;
  });
  anvil.on("exit", (code) => {
    failed = Error(`Anvil exited ${code}. Port 8545 must be free.`);
  });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    await delay(100);
    if (failed) throw failed;
    try {
      const r = await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
  }
  if (!ready)
    throw Error(
      "Anvil did not become ready. Install Foundry and ensure anvil is on PATH.",
    );
  const demo = await createDemo(undefined, true);
  server = serve(demo);
  server.on("error", (error) => {
    console.error("Local API could not start:", error.message);
    stop();
    process.exit(1);
  });
  const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  });
  children.push(vite);
  vite.on("exit", (code) => {
    stop();
    process.exit(code ?? 1);
  });
} catch (e) {
  console.error(e);
  stop();
  process.exit(1);
}
