import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("云托管容器使用动态端口、健康检查和非 root 用户", async () => {
  const dockerfile = await readFile(new URL("Dockerfile", root), "utf8");
  assert.match(dockerfile, /ENV PORT=3000/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/healthz/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /LOCAL_STORE_PATH=\/data\/scheduler-state\.json/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile/);
  assert.match(dockerfile, /RUN pnpm build/);
  assert.doesNotMatch(dockerfile, /npm ci/);
  assert.match(dockerfile, /CMD \["node", "scripts\/start-cloud-run\.mjs"\]/);
  assert.doesNotMatch(dockerfile, /VOLUME\s+\[?"?\/data/);
});

test("云启动脚本读取 PORT 并将终止信号传给子进程", async () => {
  const script = await readFile(new URL("scripts/start-cloud-run.mjs", root), "utf8");
  assert.match(script, /process\.env\.PORT/);
  assert.match(script, /process\.once\("SIGTERM"/);
  assert.match(script, /--persist-to/);
  assert.match(script, /\/api\/shared\//);
  assert.match(script, /content-security-policy/);
});

test("正式环境示例强制 MySQL 和 CloudBase 登录", async () => {
  const example = await readFile(new URL(".env.example", root), "utf8");
  assert.match(example, /AUTH_MODE=cloudbase/);
  assert.match(example, /REQUIRE_MYSQL=true/);
  assert.match(example, /CLOUDBASE_ADMIN_UIDS/);
  assert.match(example, /CLOUDBASE_DM_UID_MAP/);
});

test("Worker 健康检查不依赖数据库且图片绑定可选", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  const healthIndex = worker.indexOf('url.pathname === "/healthz"');
  const imageIndex = worker.indexOf('url.pathname === "/_vinext/image"');
  assert.ok(healthIndex >= 0 && healthIndex < imageIndex);
  assert.match(worker, /IMAGES\?: ImageBinding/);
});
