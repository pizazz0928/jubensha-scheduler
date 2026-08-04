import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyBackupState, parseBackupDocument } from "../server/backup.mjs";
import { createMysqlStore } from "../server/store.mjs";

function requireMysqlConfiguration() {
  if (!process.env.CONNECTION_URI && !(process.env.DB_HOST && process.env.DB_USER)) {
    throw new Error("请先配置 CONNECTION_URI，或配置 DB_HOST、DB_USER、DB_PASSWORD 和 DB_NAME");
  }
}

const backupArgument = process.argv.slice(2).find(argument => argument !== "--confirm");
if (!backupArgument || !process.argv.includes("--confirm")) {
  throw new Error("用法：pnpm backup:restore <备份文件> --confirm");
}
requireMysqlConfiguration();
const backupPath = path.resolve(backupArgument);
const restoredState = parseBackupDocument(await readFile(backupPath, "utf8"));
const store = await createMysqlStore();
try {
  const current = await store.snapshot();
  const result = await store.mutate(current.version, draft => {
    applyBackupState(draft, restoredState);
  });
  console.log(`恢复完成，数据库版本已更新为 ${result.version}`);
} finally {
  await store.close();
}
