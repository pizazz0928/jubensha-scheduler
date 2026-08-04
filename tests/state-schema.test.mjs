import assert from "node:assert/strict";
import test from "node:test";
import { createSeedState } from "../server/seed-state.mjs";
import { CURRENT_SCHEMA_VERSION, normalizeState } from "../server/state-schema.mjs";

test("旧版场次数据会自动补齐玩家名单字段", () => {
  const state = createSeedState();
  state.schemaVersion = 1;
  for (const session of state.sessions) delete session.playerNames;
  const normalized = normalizeState(state);
  assert.equal(normalized.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(normalized.sessions.every(session => Array.isArray(session.playerNames)));
});

test("高于当前版本的数据会被拒绝", () => {
  const state = createSeedState();
  state.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
  assert.throws(() => normalizeState(state), /更高版本/);
});
