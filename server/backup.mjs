import { createHash } from "node:crypto";
import { normalizeState } from "./state-schema.mjs";

export const BACKUP_FORMAT = "jubensha-scheduler-backup";
export const BACKUP_FORMAT_VERSION = 1;

function checksum(state) {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export function createBackupDocument(input, createdAt = new Date().toISOString()) {
  const state = normalizeState(structuredClone(input));
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    checksum: checksum(state),
    state,
  };
}

export function parseBackupDocument(source) {
  let document;
  try {
    document = JSON.parse(source);
  } catch {
    throw new Error("备份文件不是有效的 JSON");
  }
  if (document?.format !== BACKUP_FORMAT || document?.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error("备份文件格式或版本不受支持");
  }
  if (!document.state || checksum(document.state) !== document.checksum) {
    throw new Error("备份校验失败，文件可能已损坏或被修改");
  }
  return normalizeState(structuredClone(document.state));
}

export function applyBackupState(draft, backupState, actor = "系统管理员") {
  const currentVersion = Number(draft.version);
  const restored = normalizeState(structuredClone(backupState));
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, restored, { version: currentVersion });
  const time = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai",
  });
  draft.logs.unshift([time, actor, "从校验备份恢复全部排班数据", "数据恢复"]);
  draft.logs = draft.logs.slice(0, 200);
}
