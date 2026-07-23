const roleLabels = {
  admin: "管理员",
  manager: "店长",
  frontdesk: "前台",
  dm: "DM",
};

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

export function getViewer(headers) {
  const mode = process.env.AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "cloudbase" : "demo");
  if (mode === "demo") {
    return { uid: "demo-admin", displayName: "本地管理员", role: "admin", roleLabel: roleLabels.admin };
  }
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
