import assert from "node:assert/strict";
import test from "node:test";
import { createMysqlStore } from "../server/store.mjs";

const connectionUri = process.env.TEST_MYSQL_URI;

test("MySQL 持久化、健康检查和并发版本锁真实生效", {
  skip: connectionUri ? false : "未配置 TEST_MYSQL_URI",
}, async () => {
  const previousUri = process.env.CONNECTION_URI;
  process.env.CONNECTION_URI = connectionUri;
  let store;
  try {
    store = await createMysqlStore();
    await assert.doesNotReject(store.health());
    const initial = await store.snapshot();
    const first = await store.mutate(initial.version, (draft) => {
      draft.catalog.rooms[0].notes = "MySQL 持久化集成测试";
    });
    assert.equal(first.version, initial.version + 1);

    const results = await Promise.allSettled([
      store.mutate(first.version, (draft) => {
        draft.catalog.rooms[0].notes = "并发请求 A";
      }),
      store.mutate(first.version, (draft) => {
        draft.catalog.rooms[0].notes = "并发请求 B";
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) =>
      result.status === "rejected" && result.reason.code === "VERSION_CONFLICT").length, 1);

    const final = await store.snapshot();
    assert.equal(final.version, first.version + 1);
    assert.match(final.catalog.rooms[0].notes, /^并发请求 [AB]$/);
    await store.close();
    store = undefined;

    const reopened = await createMysqlStore();
    const recovered = await reopened.snapshot();
    assert.equal(recovered.version, final.version);
    assert.equal(recovered.catalog.rooms[0].notes, final.catalog.rooms[0].notes);
    await reopened.close();
  } finally {
    if (store) await store.close().catch(() => undefined);
    if (previousUri === undefined) delete process.env.CONNECTION_URI;
    else process.env.CONNECTION_URI = previousUri;
  }
});
