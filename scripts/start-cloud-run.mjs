import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { handleSharedApi } from "../server/shared-api.mjs";
import { validateAuthConfiguration } from "../server/auth.mjs";
import { createStore } from "../server/store.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = parsePort(process.env.PORT ?? "3000", "PORT");
const workerPort = parsePort(process.env.WORKER_PORT ?? String(port === 65535 ? 65534 : port + 1), "WORKER_PORT");
const host = process.env.HOST ?? "0.0.0.0";
const stateDirectory = path.resolve(process.env.LOCAL_D1_DIR ?? path.join(projectRoot, ".wrangler", "cloud-run"));
const configDirectory = path.resolve(process.env.XDG_CONFIG_HOME ?? path.join(projectRoot, ".wrangler", "config"));

await Promise.all([mkdir(stateDirectory, { recursive: true }), mkdir(configDirectory, { recursive: true })]);
validateAuthConfiguration();
const store = await createStore();

const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const configPath = path.join(projectRoot, "dist", "server", "wrangler.json");
const worker = spawn(
  process.execPath,
  [
    wranglerCli, "dev", "--config", configPath, "--ip", "127.0.0.1", "--port", String(workerPort),
    "--persist-to", stateDirectory, "--log-level", process.env.WRANGLER_LOG_LEVEL ?? "warn",
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

try {
  await waitForWorker(workerPort);
} catch (error) {
  worker.kill("SIGTERM");
  await store.close().catch(() => undefined);
  throw error;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname.startsWith("/api/shared/")) {
      await handleSharedApi(request, response, store);
      return;
    }
    if (pathname === "/healthz") {
      sendJson(response, 200, { ok: true, service: "jubensha-scheduler", storage: store.mode });
      return;
    }
    await proxyToWorker(request, response, workerPort);
  } catch (error) {
    console.error(JSON.stringify({
      message: "gateway request failed",
      path: request.url,
      error: error instanceof Error ? error.message : String(error),
    }));
    if (!response.headersSent) sendJson(response, 502, { error: "应用服务暂不可用" });
    else response.destroy();
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, host, resolve);
});
console.log(JSON.stringify({
  message: "cloud service ready",
  port,
  storage: store.mode,
  auth: process.env.AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "cloudbase" : "demo"),
}));

let stopping = false;
let forceTimer;

async function stop(signal) {
  if (stopping) return;
  stopping = true;
  server.close();
  worker.kill(signal);
  await store.close().catch(() => undefined);
  forceTimer = setTimeout(() => {
    try {
      worker.kill("SIGKILL");
    } catch {
      // Process already exited.
    }
  }, 10_000);
  forceTimer.unref();
}

process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
worker.once("error", (error) => {
  console.error(JSON.stringify({ message: "worker failed to start", error: error.message }));
  process.exitCode = 1;
});
worker.once("exit", (code, signal) => {
  if (forceTimer) clearTimeout(forceTimer);
  if (!stopping) {
    console.error(JSON.stringify({ message: "worker exited unexpectedly", code, signal }));
    server.close();
    process.exitCode = 1;
  }
});

function parsePort(value, name) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 65535) {
    throw new Error(`${name} 必须是 1 到 65535 之间的整数`);
  }
  return result;
}

async function waitForWorker(internalPort) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error("页面服务启动失败");
    try {
      const response = await fetch(`http://127.0.0.1:${internalPort}/healthz`);
      if (response.ok) return;
    } catch {
      // Continue until the startup deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("页面服务启动超时");
}

async function proxyToWorker(request, response, internalPort) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && !["host", "connection", "content-length"].includes(name.toLowerCase())) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  const method = request.method ?? "GET";
  const upstream = await fetch(`http://127.0.0.1:${internalPort}${request.url ?? "/"}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(request),
    duplex: method === "GET" || method === "HEAD" ? undefined : "half",
    redirect: "manual",
  });
  const responseHeaders = {};
  upstream.headers.forEach((value, name) => {
    if (!["connection", "transfer-encoding"].includes(name.toLowerCase())) responseHeaders[name] = value;
  });
  responseHeaders["x-content-type-options"] = "nosniff";
  responseHeaders["referrer-policy"] = "same-origin";
  responseHeaders["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
  responseHeaders["content-security-policy"] = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
  if (request.headers["x-forwarded-proto"] === "https") {
    responseHeaders["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }
  response.writeHead(upstream.status, responseHeaders);
  if (upstream.body) Readable.fromWeb(upstream.body).pipe(response);
  else response.end();
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}
