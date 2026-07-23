import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { hashPassword } from "../server/auth.mjs";
import { handleSharedApi } from "../server/shared-api.mjs";
import { createSeedState } from "../server/seed-state.mjs";

function request(method, url, body, headers = {}) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body), "utf8")]);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

function response() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = String(body);
    },
  };
}

test("账号登录接口签发安全会话并允许读取共享数据", async () => {
  const previous = {
    AUTH_MODE: process.env.AUTH_MODE,
    APP_USERS_JSON: process.env.APP_USERS_JSON,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
  process.env.AUTH_MODE = "password";
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "api-test-session-secret-with-more-than-32-characters";
  process.env.APP_USERS_JSON = JSON.stringify([{
    username: "admin",
    passwordHash: hashPassword("api-test-password"),
    displayName: "接口测试管理员",
    role: "admin",
  }]);
  const store = {
    mode: "file",
    async snapshot() {
      return createSeedState();
    },
  };
  try {
    const denied = response();
    await handleSharedApi(request("GET", "/api/shared/snapshot"), denied, store);
    assert.equal(denied.status, 401);
    assert.equal(JSON.parse(denied.body).authMode, "password");

    const login = response();
    await handleSharedApi(request("POST", "/api/shared/login", {
      username: "admin",
      password: "api-test-password",
    }), login, store);
    assert.equal(login.status, 200);
    assert.match(login.headers["set-cookie"], /HttpOnly/);
    assert.match(login.headers["set-cookie"], /SameSite=Strict/);
    assert.match(login.headers["set-cookie"], /Secure/);

    const cookie = login.headers["set-cookie"].split(";")[0];
    const allowed = response();
    await handleSharedApi(request("GET", "/api/shared/snapshot", undefined, { cookie }), allowed, store);
    assert.equal(allowed.status, 200);
    const payload = JSON.parse(allowed.body);
    assert.equal(payload.viewer.role, "admin");
    assert.equal(payload.authMode, "password");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
