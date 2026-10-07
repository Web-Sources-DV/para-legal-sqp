import { spawn } from "node:child_process";
const production = process.env.PL_BROWSER_PRODUCTION === "1";
const port = process.env.PL_BROWSER_PORT || "3100";
const server = spawn(
  process.execPath,
  production ? ["dist/server.cjs"] : ["--import", "tsx", "server.ts"],
  {
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: production ? "production" : "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk;
});
server.stderr.on("data", (chunk) => {
  output += chunk;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const result = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (result.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Server failed readiness: ${output}`);
  const tests = spawn(
    process.execPath,
    ["--import", "tsx", "--test", "tests/browser/workflow.test.ts"],
    {
      env: { ...process.env, PL_BROWSER_URL: `http://127.0.0.1:${port}` },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve) =>
    tests.on("exit", (code) => resolve(code ?? 1)),
  );
} finally {
  server.kill("SIGTERM");
}
