import assert from "node:assert/strict";
import test from "node:test";
import { applyBackupState, createBackupDocument, parseBackupDocument } from "../server/backup.mjs";
import { createSeedState } from "../server/seed-state.mjs";

test("备份文件可以完整校验并恢复", () => {
  const source = createSeedState();
  source.catalog.rooms[0].notes = "备份标记";
  const document = createBackupDocument(source, "2026-08-04T10:00:00.000Z");
  const parsed = parseBackupDocument(JSON.stringify(document));
  assert.equal(parsed.catalog.rooms[0].notes, "备份标记");
  assert.equal(parsed.schemaVersion, source.schemaVersion);

  const current = createSeedState();
  current.version = 19;
  applyBackupState(current, parsed, "测试管理员");
  assert.equal(current.version, 19);
  assert.equal(current.catalog.rooms[0].notes, "备份标记");
  assert.match(current.logs[0][2], /恢复/);
});

test("被修改的备份文件无法恢复", () => {
  const document = createBackupDocument(createSeedState());
  document.state.catalog.rooms[0].name = "被篡改";
  assert.throws(() => parseBackupDocument(JSON.stringify(document)), /校验失败/);
});

test("无确认参数时恢复脚本保持只读", async () => {
  const original = process.env.CONNECTION_URI;
  delete process.env.CONNECTION_URI;
  try {
    await assert.rejects(import(`../scripts/restore-backup.mjs?test=${Date.now()}`), /用法/);
  } finally {
    if (original === undefined) delete process.env.CONNECTION_URI;
    else process.env.CONNECTION_URI = original;
  }
});
