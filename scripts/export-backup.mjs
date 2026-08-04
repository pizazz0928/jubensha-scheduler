import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBackupDocument } from "../server/backup.mjs";
import { createMysqlStore } from "../server/store.mjs";

function requireMysqlConfiguration() {
  if (!process.env.CONNECTION_URI && !(process.env.DB_HOST && process.env.DB_USER)) {
    throw new Error("请先配置 CONNECTION_URI，或配置 DB_HOST、DB_USER、DB_PASSWORD 和 DB_NAME");
  }
}

function defaultPath() {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return path.resolve("backups", `jubensha-backup-${stamp}.json`);
}

requireMysqlConfiguration();
const outputPath = path.resolve(process.argv[2] || defaultPath());
await mkdir(path.dirname(outputPath), { recursive: true });
const store = await createMysqlStore();
try {
  const snapshot = await store.snapshot();
  const document = createBackupDocument(snapshot);
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`备份已写入 ${outputPath}`);
  console.log(`数据版本 ${snapshot.version}，校验值 ${document.checksum}`);
} finally {
  await store.close();
}
