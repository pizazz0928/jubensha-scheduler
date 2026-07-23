import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  authenticatePassword,
  createSessionCookie,
  getViewer,
  hashPassword,
  validateAuthConfiguration,
} from "../server/auth.mjs";
import { createSeedState } from "../server/seed-state.mjs";
import { sharedApiInternals } from "../server/shared-api.mjs";
import { createFileStore } from "../server/store.mjs";

const viewer = { uid: "manager-1", displayName: "测试店长", role: "manager", roleLabel: "店长" };

test("本地持久层可以重启恢复且拒绝过期版本写入", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jubensha-store-"));
  const previousPath = process.env.LOCAL_STORE_PATH;
  process.env.LOCAL_STORE_PATH = path.join(directory, "state.json");
  try {
    const store = await createFileStore();
    const initial = await store.snapshot();
    const first = await store.mutate(initial.version, draft => {
      draft.catalog.rooms[0].notes = "已完成持久化测试";
    });
    assert.equal(first.version, initial.version + 1);
    await assert.rejects(
      store.mutate(initial.version, draft => {
        draft.catalog.rooms[0].notes = "过期更新";
      }),
      error => error.code === "VERSION_CONFLICT" && error.currentVersion === first.version,
    );
    await store.close();

    const reopened = await createFileStore();
    const recovered = await reopened.snapshot();
    assert.equal(recovered.catalog.rooms[0].notes, "已完成持久化测试");
    assert.equal(recovered.version, first.version);
    await reopened.close();
    assert.doesNotThrow(() => JSON.parse(recovered ? JSON.stringify(recovered) : ""));
    await assert.doesNotReject(readFile(process.env.LOCAL_STORE_PATH, "utf8"));
  } finally {
    if (previousPath === undefined) delete process.env.LOCAL_STORE_PATH;
    else process.env.LOCAL_STORE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});

test("同一版本的两个并发请求只有一个可以成功", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jubensha-concurrency-"));
  const previousPath = process.env.LOCAL_STORE_PATH;
  process.env.LOCAL_STORE_PATH = path.join(directory, "state.json");
  try {
    const store = await createFileStore();
    const initial = await store.snapshot();
    const results = await Promise.allSettled([
      store.mutate(initial.version, draft => { draft.catalog.rooms[0].notes = "前台 A"; }),
      store.mutate(initial.version, draft => { draft.catalog.rooms[0].notes = "前台 B"; }),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && result.reason.code === "VERSION_CONFLICT").length, 1);
    await store.close();
  } finally {
    if (previousPath === undefined) delete process.env.LOCAL_STORE_PATH;
    else process.env.LOCAL_STORE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});

test("主 DM 更换会原子更新场次、人员状态和操作日志", () => {
  const state = createSeedState();
  const session = state.sessions.find(item => item.id === 4);
  const originalLogCount = state.logs.length;
  sharedApiInternals.assignDm(state, viewer, { sessionId: session.id, mode: "swap", dm: "林墨" });
  assert.equal(session.dm, "林墨");
  assert.equal(session.handoffs, 1);
  assert.equal(state.catalog.dms.find(dm => dm.name === "林墨").status, "准备中");
  assert.equal(state.catalog.dms.find(dm => dm.name === "叁叁").status, "空闲");
  assert.equal(state.logs.length, originalLogCount + 1);
  assert.match(state.logs[0][2], /林墨/);
});

test("已占用或不合格的 DM 无法被安排", () => {
  const occupiedState = createSeedState();
  occupiedState.catalog.dms.find(dm => dm.name === "乔木").status = "空闲";
  assert.throws(
    () => sharedApiInternals.assignDm(occupiedState, viewer, { sessionId: 4, mode: "fill", dm: "乔木" }),
    /时间冲突/,
  );

  const unqualifiedState = createSeedState();
  unqualifiedState.sessions = unqualifiedState.sessions.filter(session => session.id !== 8);
  unqualifiedState.catalog.dms.find(dm => dm.name === "舟舟").status = "空闲";
  assert.throws(
    () => sharedApiInternals.assignDm(unqualifiedState, viewer, { sessionId: 3, mode: "swap", dm: "舟舟" }),
    /主持资格/,
  );
});

test("CloudBase 身份头映射为服务端角色", () => {
  const previousMode = process.env.AUTH_MODE;
  const previousManagers = process.env.CLOUDBASE_MANAGER_UIDS;
  process.env.AUTH_MODE = "cloudbase";
  process.env.CLOUDBASE_MANAGER_UIDS = "uid-manager";
  try {
    const context = Buffer.from(JSON.stringify({ uid: "uid-manager", name: "林店长" }), "utf8").toString("base64");
    const result = getViewer({ "x-cloudbase-context": context });
    assert.equal(result.role, "manager");
    assert.equal(result.displayName, "林店长");
    assert.equal(getViewer({}), null);
  } finally {
    if (previousMode === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = previousMode;
    if (previousManagers === undefined) delete process.env.CLOUDBASE_MANAGER_UIDS;
    else process.env.CLOUDBASE_MANAGER_UIDS = previousManagers;
  }
});

test("生产环境缺少明确认证配置时默认拒绝访问", () => {
  const previousMode = process.env.AUTH_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.AUTH_MODE;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(getViewer({}), null);
  } finally {
    if (previousMode === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = previousMode;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("普通账号密码登录使用哈希和签名会话", () => {
  const previous = {
    mode: process.env.AUTH_MODE,
    users: process.env.APP_USERS_JSON,
    secret: process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  process.env.AUTH_MODE = "password";
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "test-session-secret-with-more-than-32-characters";
  process.env.APP_USERS_JSON = JSON.stringify([{
    username: "manager01",
    passwordHash: hashPassword("strong-test-password"),
    displayName: "测试店长",
    role: "admin",
  }]);
  try {
    assert.doesNotThrow(() => validateAuthConfiguration());
    const authenticated = authenticatePassword("manager01", "strong-test-password");
    assert.equal(authenticated.role, "admin");
    assert.equal(authenticatePassword("manager01", "wrong-password"), null);
    const cookie = createSessionCookie(authenticated);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Secure/);
    assert.equal(getViewer({ cookie }).displayName, "测试店长");
    assert.equal(getViewer({ cookie: `${cookie.split(";")[0]}tampered` }), null);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      const name = key === "mode" ? "AUTH_MODE" : key === "users" ? "APP_USERS_JSON" : key === "secret" ? "SESSION_SECRET" : "NODE_ENV";
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("DM 账号只能读取自己的场次和技能", () => {
  const state = createSeedState();
  const response = sharedApiInternals.publicState(state, {
    uid: "uid-aheng",
    displayName: "阿衡",
    role: "dm",
    roleLabel: "DM",
    dmId: "dm-aheng",
  }, "mysql");
  assert.equal(response.snapshot.catalog.dms.length, 1);
  assert.ok(response.snapshot.catalog.skills.every(skill => skill.dmId === "dm-aheng"));
  assert.ok(response.snapshot.sessions.every(session => session.dm === "阿衡" || session.fillers.includes("阿衡")));
  assert.deepEqual(response.snapshot.logs, []);
});

test("结束场次会释放人员并把房间转入清理", () => {
  const state = createSeedState();
  sharedApiInternals.updateSession(state, viewer, { sessionId: 1, action: "end" });
  const session = state.sessions.find(item => item.id === 1);
  assert.equal(session.status, "已结束");
  assert.equal(state.catalog.dms.find(dm => dm.name === "阿衡").status, "空闲");
  assert.equal(state.catalog.rooms.find(room => room.name === "云间").status, "清理中");
  assert.equal(state.catalog.rooms.find(room => room.name === "云间").needsCleaning, true);
});

test("真实玩家到店后补位 DM 可以退出且人数保持不变", () => {
  const state = createSeedState();
  const session = state.sessions.find(item => item.id === 5);
  const playersBefore = session.players;
  sharedApiInternals.updateSession(state, viewer, {
    sessionId: 5,
    action: "removeFiller",
    dm: "小满",
    replacedByPlayer: true,
  });
  assert.deepEqual(session.fillers, []);
  assert.equal(session.players, playersBefore);
  assert.equal(state.catalog.dms.find(dm => dm.name === "小满").status, "空闲");
});
