import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const portText = process.env.PORT ?? "3000";
const port = Number(portText);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(JSON.stringify({ level: "error", message: "PORT 必须是 1 到 65535 之间的整数", port: portText }));
  process.exit(1);
}

const stateDirectory = path.resolve(
  process.env.LOCAL_D1_DIR ?? path.join(projectRoot, ".wrangler", "cloud-run"),
);
const configDirectory = path.resolve(
  process.env.XDG_CONFIG_HOME ?? path.join(projectRoot, ".wrangler", "config"),
);
await Promise.all([
  mkdir(stateDirectory, { recursive: true }),
  mkdir(configDirectory, { recursive: true }),
]);

const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const configPath = path.join(projectRoot, "dist", "server", "wrangler.json");
const child = spawn(
  process.execPath,
  [
    wranglerCli,
    "dev",
    "--config",
    configPath,
    "--ip",
    process.env.HOST ?? "0.0.0.0",
    "--port",
    String(port),
    "--persist-to",
    stateDirectory,
    "--log-level",
    process.env.WRANGLER_LOG_LEVEL ?? "warn",
    "--show-interactive-dev-session=false",
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "true",
      NO_COLOR: "1",
      XDG_CONFIG_HOME: configDirectory,
      WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? path.join(configDirectory, "wrangler.log"),
      WRANGLER_SEND_METRICS: "false",
    },
  },
);

let stopping = false;
let forceTimer;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  child.kill(signal);
  forceTimer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // The process has already exited.
    }
  }, 10_000);
  forceTimer.unref();
}

process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

child.once("error", (error) => {
  console.error(JSON.stringify({ level: "error", message: "云运行服务启动失败", error: error.message }));
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (forceTimer) clearTimeout(forceTimer);
  if (signal && !stopping) {
    console.error(JSON.stringify({ level: "error", message: "云运行服务意外退出", signal }));
  }
  process.exitCode = code ?? (stopping ? 0 : 1);
});
