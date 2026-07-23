import { canDispatch, canManageCatalog, getViewer } from "./auth.mjs";

const MAX_BODY_BYTES = 1024 * 1024;
const allowedResources = new Set(["dm", "script", "room", "skill"]);
const allowedActions = new Set(["create", "update", "toggle", "upsert"]);

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

export const sharedApiInternals = {
  assignDm,
  createSession,
  overlaps,
  publicState,
  saveCatalogEntity,
  updateSession,
};

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("请求内容过大");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("请求内容格式错误");
    error.status = 400;
    throw error;
  }
}

const bool = (value, fallback = false) => value === undefined ? fallback : Boolean(value);
const number = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};
const strings = (value) => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
const text = (value, maxLength = 500) => String(value ?? "").trim().slice(0, maxLength);

function uniqueId(resource, provided) {
  const value = text(provided, 100);
  return value || `${resource}-${crypto.randomUUID()}`;
}

function saveCatalogEntity(catalog, body) {
  const { resource, action, entity } = body;
  if (!allowedResources.has(resource) || !allowedActions.has(action) || !entity || typeof entity !== "object") {
    const error = new Error("基础资料请求内容不完整");
    error.status = 400;
    throw error;
  }

  if (resource === "skill") {
    const dmId = text(entity.dmId, 100);
    const scriptId = text(entity.scriptId, 100);
    if (!catalog.dms.some((item) => item.id === dmId) || !catalog.scripts.some((item) => item.id === scriptId)) {
      const error = new Error("DM 或剧本不存在");
      error.status = 400;
      throw error;
    }
    const current = catalog.skills.find((item) => item.dmId === dmId && item.scriptId === scriptId);
    const next = {
      id: current?.id ?? uniqueId("skill", entity.id),
      dmId,
      scriptId,
      proficiency: number(entity.proficiency, 3, 1, 5),
      priority: number(entity.priority, 0, -100, 100),
      willing: bool(entity.willing, true),
    };
    if (current) Object.assign(current, next);
    else catalog.skills.push(next);
    return;
  }

  const listName = resource === "dm" ? "dms" : resource === "script" ? "scripts" : "rooms";
  const list = catalog[listName];
  const id = uniqueId(resource, entity.id);
  const currentIndex = list.findIndex((item) => item.id === id);
  const name = text(entity.name, 80);
  if (!name) {
    const error = new Error(resource === "dm" ? "DM 姓名不能为空" : resource === "script" ? "剧本名称不能为空" : "房间名称不能为空");
    error.status = 400;
    throw error;
  }
  if (list.some((item, index) => index !== currentIndex && item.name === name)) {
    const error = new Error("名称已存在，请换一个名称");
    error.status = 409;
    throw error;
  }

  let next;
  if (resource === "dm") {
    next = {
      id, name, nickname: text(entity.nickname, 80), phone: text(entity.phone, 30),
      gender: text(entity.gender, 20) || "未设置", status: text(entity.status, 30) || "未到店",
      inStore: bool(entity.inStore), canHost: bool(entity.canHost, true), canFill: bool(entity.canFill, true),
      styles: strings(entity.styles), specialties: strings(entity.specialties),
      availableFrom: text(entity.availableFrom, 10) || "12:00",
      availableUntil: text(entity.availableUntil, 10) || "24:00",
      notes: text(entity.notes), enabled: bool(entity.enabled, true),
    };
  } else if (resource === "script") {
    const minPlayers = number(entity.minPlayers, 5, 2, 30);
    const standardPlayers = number(entity.standardPlayers, 6, minPlayers, 30);
    const maxPlayers = number(entity.maxPlayers, standardPlayers, standardPlayers, 30);
    next = {
      id, name, category: text(entity.category, 30) || "还原",
      minPlayers, standardPlayers, maxPlayers,
      durationMinutes: number(entity.durationMinutes, 240, 30, 900),
      prepMinutes: number(entity.prepMinutes, 30, 0, 180),
      reviewMinutes: number(entity.reviewMinutes, 30, 0, 180),
      allowDmFill: bool(entity.allowDmFill, true),
      maxDmFill: number(entity.maxDmFill, 1, 0, 10),
      minProficiency: number(entity.minProficiency, 3, 1, 5),
      requiredGender: text(entity.requiredGender, 20) || "不限",
      requiredStyle: text(entity.requiredStyle, 30) || "不限",
      roomRequirement: text(entity.roomRequirement, 30) || "普通房",
      difficulty: text(entity.difficulty, 20) || "中等",
      notes: text(entity.notes), enabled: bool(entity.enabled, true),
    };
  } else {
    next = {
      id, name, capacity: number(entity.capacity, 6, 2, 50),
      status: text(entity.status, 30) || "空闲",
      supportedTypes: strings(entity.supportedTypes),
      needsCleaning: bool(entity.needsCleaning),
      notes: text(entity.notes), enabled: bool(entity.enabled, true),
    };
  }
  if (currentIndex >= 0) list[currentIndex] = next;
  else list.push(next);
}

function minutes(value) {
  const [hours, mins] = String(value).split(":").map(Number);
  return hours * 60 + mins;
}

function interval(session) {
  const start = minutes(session.time);
  let end = minutes(session.end);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function overlaps(left, right) {
  const a = interval(left);
  const b = interval(right);
  return a.start < b.end && b.start < a.end;
}

function addLog(state, viewer, content, category) {
  const time = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai",
  });
  state.logs.unshift([time, `${viewer.roleLabel} · ${viewer.displayName}`, content, category]);
  state.logs = state.logs.slice(0, 200);
}

function createSession(state, viewer, payload) {
  const item = payload && typeof payload === "object" ? payload : {};
  const script = state.catalog.scripts.find((entry) => entry.name === item.title && entry.enabled);
  const room = state.catalog.rooms.find((entry) => entry.name === item.room && entry.enabled);
  if (!script) throw Object.assign(new Error("剧本不存在或已下架"), { status: 400 });
  if (!room) throw Object.assign(new Error("房间不存在或已停用"), { status: 400 });
  if (room.needsCleaning || room.status === "停用") throw Object.assign(new Error("所选房间当前不可用"), { status: 409 });
  if (room.capacity < script.standardPlayers) throw Object.assign(new Error("所选房间容量不足"), { status: 409 });
  if (!room.supportedTypes.includes(script.category)) throw Object.assign(new Error("所选房间不支持该剧本类型"), { status: 409 });
  const players = number(item.players, 1, 1, script.maxPlayers);
  const session = {
    id: Math.max(0, ...state.sessions.map((entry) => Number(entry.id) || 0)) + 1,
    time: text(item.time, 5),
    end: text(item.end, 5),
    title: script.name,
    type: `${script.category} · ${script.standardPlayers}人`,
    room: room.name,
    dm: text(item.dm, 80) || "待安排",
    players,
    target: script.standardPlayers,
    fillers: [],
    status: text(item.status, 30) || (players < script.standardPlayers ? "缺玩家" : "准备中"),
    risk: text(item.risk, 300) || undefined,
  };
  if (!/^\d{2}:\d{2}$/.test(session.time) || !/^\d{2}:\d{2}$/.test(session.end)) {
    throw Object.assign(new Error("场次时间格式无效"), { status: 400 });
  }
  const roomConflict = state.sessions.some((entry) => entry.room === session.room && !["已结束", "已取消"].includes(entry.status) && overlaps(entry, session));
  if (roomConflict) throw Object.assign(new Error("该房间与现有场次时间冲突"), { status: 409 });
  if (session.dm !== "待安排") {
    const dm = state.catalog.dms.find((entry) => entry.name === session.dm);
    const skill = state.catalog.skills.find((entry) => entry.dmId === dm?.id && entry.scriptId === script.id && entry.willing);
    if (!dm || !dm.enabled || !dm.inStore || !dm.canHost || !["空闲", "准备中", "主持中", "玩家补位中"].includes(dm.status)) {
      throw Object.assign(new Error("推荐 DM 当前不可安排"), { status: 409 });
    }
    if (!skill || skill.proficiency < script.minProficiency) throw Object.assign(new Error("推荐 DM 未达到该剧本主持资格"), { status: 409 });
    if (script.requiredGender !== "不限" && dm.gender !== script.requiredGender) throw Object.assign(new Error("推荐 DM 不符合剧本性别要求"), { status: 409 });
    if (script.requiredStyle !== "不限" && !dm.styles.includes(script.requiredStyle)) throw Object.assign(new Error("推荐 DM 不符合剧本主持风格"), { status: 409 });
    const dmConflict = state.sessions.some((entry) => (entry.dm === session.dm || entry.fillers.includes(session.dm)) && overlaps(entry, session));
    if (dmConflict) throw Object.assign(new Error("推荐 DM 已被其他场次占用"), { status: 409 });
    dm.status = "准备中";
  }
  state.sessions.push(session);
  state.sessions.sort((a, b) => a.time.localeCompare(b.time));
  addLog(state, viewer, `创建临时场次《${session.title}》`, "快速排班");
}

function assignDm(state, viewer, payload) {
  const session = state.sessions.find((entry) => String(entry.id) === String(payload?.sessionId));
  const dm = state.catalog.dms.find((entry) => entry.name === payload?.dm);
  const mode = payload?.mode;
  if (!session || !dm || !["swap", "fill"].includes(mode)) {
    throw Object.assign(new Error("场次、DM 或安排方式无效"), { status: 400 });
  }
  if (!dm.enabled || !dm.inStore || !["空闲", "准备中", "主持中", "玩家补位中"].includes(dm.status)) {
    throw Object.assign(new Error(`${dm.name} 当前不可安排`), { status: 409 });
  }
  const occupied = state.sessions.some((entry) =>
    entry.id !== session.id &&
    (entry.dm === dm.name || entry.fillers.includes(dm.name)) &&
    overlaps(entry, session),
  );
  if (occupied) throw Object.assign(new Error(`${dm.name} 与其他场次时间冲突`), { status: 409 });

  const script = state.catalog.scripts.find((entry) => entry.name === session.title);
  if (!script || !script.enabled) throw Object.assign(new Error("场次剧本不存在或已下架"), { status: 409 });
  if (session.dm === dm.name || session.fillers.includes(dm.name)) {
    throw Object.assign(new Error(`${dm.name} 已在本场承担任务`), { status: 409 });
  }
  if (mode === "swap") {
    if (!dm.canHost) throw Object.assign(new Error(`${dm.name} 当前不可主持`), { status: 409 });
    const skill = state.catalog.skills.find((entry) => entry.dmId === dm.id && entry.scriptId === script?.id && entry.willing);
    if (!skill || skill.proficiency < (script?.minProficiency ?? 1)) {
      throw Object.assign(new Error(`${dm.name} 未达到该剧本主持资格`), { status: 409 });
    }
    if (script.requiredGender !== "不限" && dm.gender !== script.requiredGender) {
      throw Object.assign(new Error(`${dm.name} 不符合剧本性别要求`), { status: 409 });
    }
    if (script.requiredStyle !== "不限" && !dm.styles.includes(script.requiredStyle)) {
      throw Object.assign(new Error(`${dm.name} 不符合剧本主持风格`), { status: 409 });
    }
    const oldDm = state.catalog.dms.find((entry) => entry.name === session.dm);
    if (oldDm && ["主持中", "准备中"].includes(oldDm.status)) oldDm.status = "空闲";
    session.dm = dm.name;
    session.handoffs = Number(session.handoffs ?? 0) + 1;
    session.status = session.players < session.target ? "缺玩家" : "准备中";
    dm.status = session.status === "进行中" ? "主持中" : "准备中";
    addLog(state, viewer, `将 ${dm.name} 安排为《${session.title}》主 DM`, "人工调整");
    return;
  }

  if (!script?.allowDmFill || !dm.canFill) throw Object.assign(new Error("该剧本或 DM 不允许玩家补位"), { status: 409 });
  if (session.fillers.length >= script.maxDmFill) throw Object.assign(new Error("本场 DM 补位人数已达上限"), { status: 409 });
  if (session.players >= script.maxPlayers) throw Object.assign(new Error("本场玩家人数已达上限"), { status: 409 });
  session.fillers.push(dm.name);
  session.players += 1;
  session.status = session.players >= session.target ? "准备中" : "缺玩家";
  if (session.players >= session.target) delete session.risk;
  dm.status = "玩家补位中";
  addLog(state, viewer, `将 ${dm.name} 安排为《${session.title}》玩家补位`, "人工调整");
}

function updateSession(state, viewer, payload) {
  const session = state.sessions.find((entry) => String(entry.id) === String(payload?.sessionId));
  const action = payload?.action;
  if (!session || !["start", "end", "cancel", "edit", "removeFiller"].includes(action)) {
    throw Object.assign(new Error("场次或操作类型无效"), { status: 400 });
  }
  const script = state.catalog.scripts.find((entry) => entry.name === session.title);
  const room = state.catalog.rooms.find((entry) => entry.name === session.room);
  const host = state.catalog.dms.find((entry) => entry.name === session.dm);

  if (action === "start") {
    if (["进行中", "已结束", "已取消"].includes(session.status)) {
      throw Object.assign(new Error("当前场次状态无法开始"), { status: 409 });
    }
    if (!host || session.dm === "待安排") throw Object.assign(new Error("请先安排主 DM"), { status: 409 });
    if (session.players < (script?.minPlayers ?? session.target)) throw Object.assign(new Error("当前人数低于剧本最低开场人数"), { status: 409 });
    session.status = "进行中";
    session.progress = 1;
    host.status = "主持中";
    for (const name of session.fillers) {
      const filler = state.catalog.dms.find((entry) => entry.name === name);
      if (filler) filler.status = "玩家补位中";
    }
    if (room) room.status = "使用中";
    addLog(state, viewer, `开始场次《${session.title}》`, "场次状态");
    return;
  }

  if (action === "end" || action === "cancel") {
    if (["已结束", "已取消"].includes(session.status)) throw Object.assign(new Error("场次已经关闭"), { status: 409 });
    session.status = action === "end" ? "已结束" : "已取消";
    delete session.progress;
    delete session.risk;
    if (host && ["主持中", "准备中"].includes(host.status)) host.status = "空闲";
    for (const name of session.fillers) {
      const filler = state.catalog.dms.find((entry) => entry.name === name);
      if (filler?.status === "玩家补位中") filler.status = "空闲";
    }
    if (room) {
      room.status = action === "end" ? "清理中" : "空闲";
      room.needsCleaning = action === "end";
    }
    addLog(state, viewer, `${action === "end" ? "结束" : "取消"}场次《${session.title}》`, "场次状态");
    return;
  }

  if (action === "removeFiller") {
    const name = text(payload?.dm, 80);
    if (!session.fillers.includes(name)) throw Object.assign(new Error("该 DM 当前没有参与本场补位"), { status: 409 });
    session.fillers = session.fillers.filter((entry) => entry !== name);
    if (!bool(payload?.replacedByPlayer, true)) session.players = Math.max(0, session.players - 1);
    const filler = state.catalog.dms.find((entry) => entry.name === name);
    if (filler?.status === "玩家补位中") filler.status = "空闲";
    session.status = session.players < session.target ? "缺玩家" : session.status === "进行中" ? "进行中" : "准备中";
    if (session.players < session.target) session.risk = `缺 ${session.target - session.players} 名玩家`;
    addLog(state, viewer, `将补位 DM ${name} 从《${session.title}》退出`, "人工调整");
    return;
  }

  const nextTime = text(payload?.time, 5) || session.time;
  const nextEnd = text(payload?.end, 5) || session.end;
  if (!/^\d{2}:\d{2}$/.test(nextTime) || !/^\d{2}:\d{2}$/.test(nextEnd)) {
    throw Object.assign(new Error("场次时间格式无效"), { status: 400 });
  }
  const nextPlayers = number(payload?.players, session.players, 0, script?.maxPlayers ?? 30);
  const candidate = { ...session, time: nextTime, end: nextEnd, players: nextPlayers };
  const roomConflict = state.sessions.some((entry) =>
    entry.id !== session.id &&
    entry.room === candidate.room &&
    !["已结束", "已取消"].includes(entry.status) &&
    overlaps(entry, candidate),
  );
  if (roomConflict) throw Object.assign(new Error("修改后会产生房间时间冲突"), { status: 409 });
  const assignedNames = [candidate.dm, ...candidate.fillers].filter((name) => name && name !== "待安排");
  const dmConflict = state.sessions.some((entry) =>
    entry.id !== session.id &&
    !["已结束", "已取消"].includes(entry.status) &&
    assignedNames.some((name) => entry.dm === name || entry.fillers.includes(name)) &&
    overlaps(entry, candidate),
  );
  if (dmConflict) throw Object.assign(new Error("修改后会产生 DM 时间冲突"), { status: 409 });
  session.time = nextTime;
  session.end = nextEnd;
  session.players = nextPlayers;
  if (session.status !== "进行中") session.status = session.dm === "待安排" ? "缺DM" : nextPlayers < session.target ? "缺玩家" : "准备中";
  session.risk = nextPlayers < session.target ? `缺 ${session.target - nextPlayers} 名玩家` : undefined;
  addLog(state, viewer, `更新场次《${session.title}》的时间或人数`, "场次调整");
}

function publicState(state, viewer, storeMode) {
  const result = structuredClone(state);
  if (!canManageCatalog(viewer)) {
    result.catalog.dms = result.catalog.dms.map((dm) => ({ ...dm, phone: dm.phone ? `${dm.phone.slice(0, 3)}****${dm.phone.slice(-4)}` : "" }));
  }
  if (viewer.role === "dm") {
    const ownDm = result.catalog.dms.find((dm) => dm.id === viewer.dmId);
    const ownName = ownDm?.name ?? viewer.displayName;
    result.sessions = result.sessions.filter((session) => session.dm === ownName || session.fillers.includes(ownName));
    result.catalog.dms = ownDm ? [ownDm] : [];
    result.catalog.skills = result.catalog.skills.filter((skill) => skill.dmId === viewer.dmId);
    const ownScriptIds = new Set(result.catalog.skills.map((skill) => skill.scriptId));
    result.catalog.scripts = result.catalog.scripts.filter((script) => ownScriptIds.has(script.id));
    result.logs = [];
  }
  return { snapshot: result, viewer, storageMode: storeMode };
}

export async function handleSharedApi(request, response, store) {
  const viewer = getViewer(request.headers);
  if (!viewer) {
    sendJson(response, 401, { error: "请先登录后再访问排班系统" });
    return;
  }
  const url = new URL(request.url, "http://localhost");
  try {
    if (request.method === "GET" && (url.pathname === "/api/shared/me" || url.pathname === "/api/shared/snapshot")) {
      const state = await store.snapshot();
      sendJson(response, 200, url.pathname.endsWith("/me") ? { viewer } : publicState(state, viewer, store.mode));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/shared/catalog") {
      if (!canManageCatalog(viewer)) {
        sendJson(response, 403, { error: "当前角色没有基础资料管理权限" });
        return;
      }
      const body = await readJson(request);
      const state = await store.mutate(body.expectedVersion, async (draft) => {
        saveCatalogEntity(draft.catalog, body);
        addLog(draft, viewer, "更新门店基础资料", "资料维护");
      });
      sendJson(response, 200, publicState(state, viewer, store.mode));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/shared/dispatch") {
      if (!canDispatch(viewer)) {
        sendJson(response, 403, { error: "当前角色没有场次调度权限" });
        return;
      }
      const body = await readJson(request);
      if (!["create", "assign", "session"].includes(body.kind)) throw Object.assign(new Error("不支持的调度操作"), { status: 400 });
      const state = await store.mutate(body.expectedVersion, async (draft) => {
        if (body.kind === "create") createSession(draft, viewer, body.payload);
        else if (body.kind === "assign") assignDm(draft, viewer, body.payload);
        else updateSession(draft, viewer, body.payload);
      });
      sendJson(response, 200, publicState(state, viewer, store.mode));
      return;
    }
    sendJson(response, 404, { error: "接口不存在" });
  } catch (error) {
    const status = error?.code === "VERSION_CONFLICT" ? 409 : Number(error?.status ?? 500);
    if (status >= 500) {
      console.error(JSON.stringify({ message: "shared api failed", path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
    }
    sendJson(response, status, { error: error instanceof Error ? error.message : "服务暂不可用", currentVersion: error?.currentVersion });
  }
}
