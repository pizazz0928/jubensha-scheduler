import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSeedState } from "./seed-state.mjs";

function clone(value) {
  return structuredClone(value);
}

function conflict(currentVersion) {
  const error = new Error("数据已被其他设备更新，请刷新后重试");
  error.code = "VERSION_CONFLICT";
  error.currentVersion = currentVersion;
  return error;
}

export async function createFileStore() {
  const filePath = path.resolve(process.env.LOCAL_STORE_PATH ?? "data/scheduler-state.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  let queue = Promise.resolve();

  async function load() {
    try {
      return JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const initial = createSeedState();
      await save(initial);
      return initial;
    }
  }

  async function save(state) {
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tempPath, filePath);
  }

  return {
    mode: "file",
    async snapshot() {
      await queue;
      return clone(await load());
    },
    async mutate(expectedVersion, mutation) {
      const task = queue.then(async () => {
        const state = await load();
        if (Number(expectedVersion) !== Number(state.version)) throw conflict(state.version);
        await mutation(state);
        state.version += 1;
        await save(state);
        return clone(state);
      });
      queue = task.catch(() => undefined);
      return task;
    },
    async close() {},
  };
}

export async function createMysqlStore() {
  const mysql = await import("mysql2/promise");
  const connectionUri = process.env.CONNECTION_URI;
  const pool = connectionUri
    ? mysql.createPool(connectionUri)
    : mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME ?? "tcb",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: "utf8mb4",
        connectTimeout: 60_000,
      });

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS scheduler_state (
      id TINYINT PRIMARY KEY,
      version BIGINT NOT NULL,
      payload LONGTEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  const seed = createSeedState();
  await pool.execute(
    "INSERT IGNORE INTO scheduler_state (id, version, payload, updated_at) VALUES (1, ?, ?, NOW(3))",
    [seed.version, JSON.stringify(seed)],
  );

  return {
    mode: "mysql",
    async snapshot() {
      const [rows] = await pool.execute("SELECT version, payload FROM scheduler_state WHERE id = 1");
      if (!rows[0]) throw new Error("共享数据库尚未初始化");
      const state = JSON.parse(rows[0].payload);
      state.version = Number(rows[0].version);
      return state;
    },
    async mutate(expectedVersion, mutation) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute("SELECT version, payload FROM scheduler_state WHERE id = 1 FOR UPDATE");
        const row = rows[0];
        if (!row) throw new Error("共享数据库尚未初始化");
        if (Number(expectedVersion) !== Number(row.version)) throw conflict(Number(row.version));
        const state = JSON.parse(row.payload);
        state.version = Number(row.version);
        await mutation(state);
        state.version += 1;
        await connection.execute(
          "UPDATE scheduler_state SET version = ?, payload = ?, updated_at = NOW(3) WHERE id = 1",
          [state.version, JSON.stringify(state)],
        );
        await connection.commit();
        return state;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createStore() {
  const mysqlConfigured = Boolean(process.env.CONNECTION_URI || (process.env.DB_HOST && process.env.DB_USER));
  if (process.env.REQUIRE_MYSQL === "true" && !mysqlConfigured) {
    throw new Error("正式运行要求配置 CloudBase MySQL 环境变量");
  }
  return mysqlConfigured ? createMysqlStore() : createFileStore();
}
