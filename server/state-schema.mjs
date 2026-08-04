export const CURRENT_SCHEMA_VERSION = 2;

export function normalizeState(value) {
  if (!value || typeof value !== "object") throw new Error("排班数据格式无效");
  if (!Number.isFinite(Number(value.version))) throw new Error("排班数据版本无效");
  if (!value.catalog || typeof value.catalog !== "object") throw new Error("基础资料格式无效");
  for (const name of ["dms", "scripts", "rooms", "skills"]) {
    if (!Array.isArray(value.catalog[name])) throw new Error(`基础资料 ${name} 格式无效`);
  }
  if (!Array.isArray(value.sessions) || !Array.isArray(value.logs)) throw new Error("场次或日志格式无效");
  const schemaVersion = Number(value.schemaVersion ?? 1);
  if (schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error("数据来自更高版本的系统，请先升级应用");
  value.sessions = value.sessions.map((session) => {
    const guestCount = Math.max(0, (Number(session.players) || 0) - (Array.isArray(session.fillers) ? session.fillers.length : 0));
    const playerNames = Array.isArray(session.playerNames)
      ? session.playerNames.map((name) => String(name).trim().slice(0, 80)).filter(Boolean).slice(0, guestCount)
      : [];
    return { ...session, playerNames };
  });
  value.schemaVersion = CURRENT_SCHEMA_VERSION;
  return value;
}
