import { env } from "cloudflare:workers";

type DispatchBody = { kind?: "create" | "assign"; payload?: Record<string, unknown> };

async function ensureTables() {
  const db = env.DB;
  if (!db) throw new Error("数据库连接暂不可用");
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS dispatch_state (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS operation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, operator TEXT NOT NULL, content TEXT NOT NULL, category TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL)"),
  ]);
  return db;
}

export async function GET() {
  try {
    const db = await ensureTables();
    const rows = await db.prepare("SELECT kind, payload FROM dispatch_state ORDER BY id ASC").all<{ kind: string; payload: string }>();
    const state: Record<string, unknown> = {};
    for (const row of rows.results) state[row.kind] = JSON.parse(row.payload);
    const logRows = await db.prepare("SELECT time, operator, content, category FROM operation_logs ORDER BY id DESC LIMIT 50").all<{ time: string; operator: string; content: string; category: string }>();
    return Response.json({ ...state, logs: logRows.results.map((row: { time: string; operator: string; content: string; category: string }) => [row.time, row.operator, row.content, row.category]) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取调度数据失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as DispatchBody;
    if (!body.kind || !body.payload) return Response.json({ error: "操作类型和内容不能为空" }, { status: 400 });
    const db = await ensureTables();
    const now = new Date();
    const time = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const title = String(body.payload.title || "目标场次");
    const dm = String(body.payload.dm || "乔木");
    const content = body.kind === "create" ? `创建临时场次《${title}》` : `将 ${dm} 安排到指定场次`;
    await db.prepare("INSERT INTO operation_logs (time, operator, content, category, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(time, body.kind === "create" ? "前台 · 阿梨" : "店长 · 林野", content, body.kind === "create" ? "快速排班" : "人工调整", "实时调度", now.toISOString()).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存调度操作失败" }, { status: 500 });
  }
}
