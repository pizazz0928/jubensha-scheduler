import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "jubensha_session";
const SESSION_SECONDS = 12 * 60 * 60;
const PASSWORD_PARAMETERS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const validRoles = new Set(["admin", "manager", "frontdesk", "dm"]);
const roleLabels = {
  admin: "管理员",
  manager: "店长",
  frontdesk: "前台",
  dm: "DM",
};

export function getAuthMode() {
  return process.env.AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "cloudbase" : "demo");
}

function parseUidList(name) {
  return new Set(String(process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function roleForUid(uid) {
  if (parseUidList("CLOUDBASE_ADMIN_UIDS").has(uid)) return "admin";
  if (parseUidList("CLOUDBASE_MANAGER_UIDS").has(uid)) return "manager";
  if (parseUidList("CLOUDBASE_FRONTDESK_UIDS").has(uid)) return "frontdesk";
  return "dm";
}

function decodeContext(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function dmIdForUid(uid) {
  try {
    const mapping = JSON.parse(process.env.CLOUDBASE_DM_UID_MAP ?? "{}");
    return typeof mapping?.[uid] === "string" ? mapping[uid] : "";
  } catch {
    return "";
  }
}

function sessionSecret() {
  return process.env.SESSION_SECRET ?? "";
}

function parseCookies(header) {
  const value = Array.isArray(header) ? header.join(";") : String(header ?? "");
  return Object.fromEntries(value.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([name]) => name));
}

function sign(value) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function viewerFromSession(headers) {
  const token = parseCookies(headers.cookie)[SESSION_COOKIE];
  if (!token || sessionSecret().length < 32) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const encoded = token.slice(0, separator);
  if (!safeEqual(sign(encoded), token.slice(separator + 1))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!validRoles.has(payload.role) || !payload.uid || Number(payload.exp) <= Date.now()) return null;
    return {
      uid: String(payload.uid),
      displayName: String(payload.displayName),
      role: payload.role,
      roleLabel: roleLabels[payload.role],
      dmId: payload.role === "dm" ? String(payload.dmId ?? "") : undefined,
    };
  } catch {
    return null;
  }
}

function passwordUsers() {
  let records;
  try {
    records = JSON.parse(process.env.APP_USERS_JSON ?? "[]");
  } catch {
    throw new Error("APP_USERS_JSON 必须是有效的 JSON 数组");
  }
  if (!Array.isArray(records)) throw new Error("APP_USERS_JSON 必须是 JSON 数组");
  return records.map((record) => ({
    username: String(record?.username ?? "").trim(),
    passwordHash: String(record?.passwordHash ?? ""),
    displayName: String(record?.displayName ?? record?.username ?? "").trim(),
    role: String(record?.role ?? ""),
    dmId: String(record?.dmId ?? ""),
  }));
}

export function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  if (String(password).length < 10) throw new Error("密码至少需要 10 个字符");
  const derived = scryptSync(String(password), salt, 64, PASSWORD_PARAMETERS).toString("base64url");
  return `scrypt$${PASSWORD_PARAMETERS.N}$${PASSWORD_PARAMETERS.r}$${PASSWORD_PARAMETERS.p}$${salt}$${derived}`;
}

function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, salt, expected] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const parameters = { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 };
  if (parameters.N !== PASSWORD_PARAMETERS.N || parameters.r !== PASSWORD_PARAMETERS.r || parameters.p !== PASSWORD_PARAMETERS.p) return false;
  try {
    const actual = scryptSync(String(password), salt, 64, parameters).toString("base64url");
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function authenticatePassword(username, password) {
  const normalized = String(username ?? "").trim();
  const user = passwordUsers().find((entry) => entry.username === normalized);
  const fallbackHash = "scrypt$16384$8$1$8A_6fZTJor14UhbePZM1kA$7yFj4VlzBEAeijwmSCsT1ahcpg8cU8u4X_NL7sPCVY3yPsQ6tmEIEPwXpHGFtcUy8ZTM4N5iVdBXGq-TIDt4wg";
  const valid = verifyPassword(password, user?.passwordHash ?? fallbackHash);
  if (!user || !valid || !validRoles.has(user.role)) return null;
  return {
    uid: `password:${user.username}`,
    displayName: user.displayName || user.username,
    role: user.role,
    roleLabel: roleLabels[user.role],
    dmId: user.role === "dm" ? user.dmId : undefined,
  };
}

export function createSessionCookie(viewer) {
  const encoded = Buffer.from(JSON.stringify({
    uid: viewer.uid,
    displayName: viewer.displayName,
    role: viewer.role,
    dmId: viewer.dmId ?? "",
    exp: Date.now() + SESSION_SECONDS * 1000,
  })).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encoded}.${sign(encoded)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function validateAuthConfiguration() {
  const mode = getAuthMode();
  if (!["demo", "cloudbase", "password"].includes(mode)) throw new Error("AUTH_MODE 仅支持 demo、cloudbase 或 password");
  if (process.env.NODE_ENV === "production" && mode === "demo") throw new Error("正式环境不能使用演示登录");
  if (mode !== "password") return;
  if (sessionSecret().length < 32) throw new Error("SESSION_SECRET 至少需要 32 个字符");
  const users = passwordUsers();
  if (users.length === 0) throw new Error("APP_USERS_JSON 至少需要配置一个账号");
  if (!users.some((user) => user.role === "admin")) throw new Error("APP_USERS_JSON 至少需要一个管理员账号");
  const names = new Set();
  for (const user of users) {
    if (!/^[A-Za-z0-9_.@-]{3,64}$/.test(user.username)) throw new Error("账号名仅支持 3 到 64 位字母、数字和 ._@-");
    if (names.has(user.username)) throw new Error(`账号名 ${user.username} 重复`);
    if (!validRoles.has(user.role)) throw new Error(`账号 ${user.username} 的角色无效`);
    if (!/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/.test(user.passwordHash)) throw new Error(`账号 ${user.username} 的密码哈希无效`);
    if (user.role === "dm" && !user.dmId) throw new Error(`DM 账号 ${user.username} 必须配置 dmId`);
    names.add(user.username);
  }
}

export function getViewer(headers) {
  const mode = getAuthMode();
  if (mode === "demo") {
    return { uid: "demo-admin", displayName: "本地管理员", role: "admin", roleLabel: roleLabels.admin };
  }
  if (mode === "password") return viewerFromSession(headers);
  if (mode !== "cloudbase") return null;
  const encoded = headers["x-cloudbase-context"];
  const context = typeof encoded === "string" ? decodeContext(encoded) : null;
  const uid = typeof context?.uid === "string" ? context.uid : "";
  if (!uid) return null;
  const role = roleForUid(uid);
  const dmId = role === "dm" ? dmIdForUid(uid) : "";
  const displayName = String(context.name ?? context.nickName ?? context.userInfo?.name ?? `用户 ${uid.slice(-6)}`);
  return { uid, displayName, role, roleLabel: roleLabels[role], dmId };
}

export function canManageCatalog(viewer) {
  return viewer?.role === "admin" || viewer?.role === "manager";
}

export function canDispatch(viewer) {
  return canManageCatalog(viewer) || viewer?.role === "frontdesk";
}
