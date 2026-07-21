import { env } from "cloudflare:workers";

type Resource = "dm" | "script" | "room" | "skill";
type CatalogBody = { resource?: Resource; action?: "create" | "update" | "toggle" | "upsert"; entity?: Record<string, unknown> };

const now = () => new Date().toISOString();
const bool = (value: unknown, fallback = false) => value === undefined ? fallback : Boolean(value);
const num = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const json = (value: unknown, fallback: unknown[] = []) => JSON.stringify(Array.isArray(value) ? value : fallback);

const seedDms = [
  ["dm-aheng", "阿衡", "衡哥", "男", "主持中", 1, 1, 1, ["沉浸", "细腻"], ["情感", "还原"], "12:00", "23:30"],
  ["dm-nanzhi", "南枝", "枝枝", "女", "主持中", 1, 1, 0, ["逻辑", "氛围"], ["推理", "恐怖"], "13:00", "24:00"],
  ["dm-xiaoman", "小满", "满满", "女", "玩家补位中", 1, 1, 1, ["活泼", "控场"], ["机制", "阵营"], "14:00", "23:30"],
  ["dm-qiaomu", "乔木", "木木", "男", "空闲", 1, 1, 1, ["欢乐", "互动"], ["欢乐", "情感"], "12:00", "01:00"],
  ["dm-shiqi", "十七", "小七", "女", "空闲", 1, 1, 1, ["恐怖", "演绎"], ["恐怖", "推理"], "16:00", "01:00"],
  ["dm-sansan", "叁叁", "三三", "女", "准备中", 1, 1, 1, ["细腻", "沉浸"], ["还原", "情感"], "12:00", "24:00"],
  ["dm-laobai", "老白", "白哥", "男", "准备中", 1, 1, 0, ["控场", "竞技"], ["机制", "阵营"], "13:00", "01:00"],
  ["dm-beihe", "北河", "河哥", "男", "休息中", 1, 1, 1, ["温柔", "演绎"], ["情感", "欢乐"], "12:00", "23:00"],
  ["dm-bailu", "白露", "露露", "女", "暂时不可用", 1, 1, 1, ["沉浸", "氛围"], ["情感", "恐怖"], "15:00", "24:00"],
  ["dm-linmo", "林墨", "墨墨", "男", "空闲", 1, 1, 1, ["逻辑", "稳健"], ["推理", "还原"], "17:00", "02:00"],
  ["dm-tangyuan", "糖圆", "圆圆", "女", "未到店", 0, 1, 1, ["活泼", "欢乐"], ["欢乐", "机制"], "18:00", "02:00"],
  ["dm-zhouzhou", "舟舟", "小舟", "男", "空闲", 1, 1, 1, ["演绎", "氛围"], ["恐怖", "阵营"], "15:00", "01:30"],
] as const;

const seedScripts = [
  ["script-nianlun", "年轮", "情感", 6, 6, 6, 270, 1, 1, 3, "不限", "沉浸", "安静房", "中等"],
  ["script-lichuan", "漓川怪谈簿", "推理", 7, 7, 7, 240, 0, 0, 4, "不限", "逻辑", "普通房", "困难"],
  ["script-qinglou", "青楼", "情感", 6, 6, 6, 270, 1, 1, 4, "不限", "细腻", "安静房", "中等"],
  ["script-suspect7", "第七号嫌疑人", "还原", 5, 6, 6, 240, 1, 1, 3, "不限", "稳健", "普通房", "中等"],
  ["script-binglin", "兵临城下", "机制", 6, 7, 8, 270, 1, 2, 4, "不限", "控场", "大房", "困难"],
  ["script-nihao", "你好", "欢乐", 5, 6, 7, 240, 1, 1, 2, "不限", "欢乐", "普通房", "简单"],
  ["script-chaiqian", "拆迁", "阵营", 7, 8, 9, 270, 1, 1, 4, "不限", "竞技", "大房", "困难"],
  ["script-eyuan", "恶渊百物语", "恐怖", 5, 6, 7, 240, 1, 1, 4, "不限", "恐怖", "恐怖房", "困难"],
  ["script-gucheng", "孤城", "还原", 5, 6, 6, 240, 1, 1, 3, "不限", "演绎", "普通房", "中等"],
  ["script-zhuiyue", "追月", "情感", 6, 6, 6, 270, 1, 1, 4, "女", "细腻", "安静房", "困难"],
  ["script-lieren", "猎人笔记", "推理", 5, 6, 7, 210, 0, 0, 3, "不限", "逻辑", "普通房", "中等"],
  ["script-liri", "离日", "机制", 6, 7, 8, 300, 1, 1, 4, "不限", "控场", "大房", "困难"],
  ["script-huanxi", "欢喜镇", "欢乐", 5, 6, 8, 210, 1, 2, 2, "不限", "欢乐", "普通房", "简单"],
  ["script-jingzhe", "惊蛰", "恐怖", 5, 6, 6, 240, 1, 1, 3, "不限", "氛围", "恐怖房", "中等"],
  ["script-tianming", "天命", "阵营", 7, 8, 10, 300, 1, 2, 4, "男", "控场", "大房", "困难"],
] as const;

const seedRooms = [
  ["room-yunjian", "云间", 8, "使用中", ["情感", "还原", "欢乐"], 0, "隔音好，适合沉浸本"],
  ["room-wuyin", "雾隐", 8, "使用中", ["推理", "恐怖", "还原"], 0, "带可调光和音响"],
  ["room-changjie", "长街", 7, "空闲", ["情感", "欢乐"], 0, "长桌布局"],
  ["room-jiuxiang", "旧巷", 6, "准备中", ["推理", "还原", "恐怖"], 0, "沉浸式布景"],
  ["room-chibi", "赤壁", 10, "准备中", ["机制", "阵营"], 0, "最大机制房"],
  ["room-tingyu", "听雨", 6, "空闲", ["情感", "欢乐", "还原"], 0, "小型安静房"],
] as const;

const seedSkillLinks = [
  ["dm-aheng","script-nianlun",5],["dm-aheng","script-qinglou",4],["dm-aheng","script-zhuiyue",4],
  ["dm-nanzhi","script-lichuan",5],["dm-nanzhi","script-eyuan",4],["dm-nanzhi","script-lieren",4],
  ["dm-xiaoman","script-binglin",4],["dm-xiaoman","script-chaiqian",4],["dm-xiaoman","script-huanxi",3],
  ["dm-qiaomu","script-nihao",5],["dm-qiaomu","script-huanxi",5],["dm-qiaomu","script-nianlun",3],
  ["dm-shiqi","script-eyuan",5],["dm-shiqi","script-jingzhe",5],["dm-shiqi","script-lichuan",3],
  ["dm-sansan","script-suspect7",5],["dm-sansan","script-qinglou",4],["dm-sansan","script-gucheng",4],
  ["dm-laobai","script-binglin",5],["dm-laobai","script-chaiqian",5],["dm-laobai","script-tianming",4],
  ["dm-beihe","script-nianlun",4],["dm-beihe","script-qinglou",4],["dm-beihe","script-nihao",4],
  ["dm-linmo","script-lichuan",4],["dm-linmo","script-lieren",5],["dm-linmo","script-suspect7",4],
  ["dm-zhouzhou","script-eyuan",4],["dm-zhouzhou","script-jingzhe",4],["dm-zhouzhou","script-tianming",4],
] as const;

async function ensureTables() {
  const db = env.DB;
  if (!db) throw new Error("数据库连接暂不可用");
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS dms (id TEXT PRIMARY KEY, name TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', gender TEXT NOT NULL DEFAULT '未设置', status TEXT NOT NULL DEFAULT '未到店', in_store INTEGER NOT NULL DEFAULT 0, can_host INTEGER NOT NULL DEFAULT 1, can_fill INTEGER NOT NULL DEFAULT 1, styles TEXT NOT NULL DEFAULT '[]', specialties TEXT NOT NULL DEFAULT '[]', available_from TEXT NOT NULL DEFAULT '12:00', available_until TEXT NOT NULL DEFAULT '24:00', notes TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS dms_name_idx ON dms(name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS scripts (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, min_players INTEGER NOT NULL, standard_players INTEGER NOT NULL, max_players INTEGER NOT NULL, duration_minutes INTEGER NOT NULL, prep_minutes INTEGER NOT NULL DEFAULT 30, review_minutes INTEGER NOT NULL DEFAULT 30, allow_dm_fill INTEGER NOT NULL DEFAULT 1, max_dm_fill INTEGER NOT NULL DEFAULT 1, min_proficiency INTEGER NOT NULL DEFAULT 3, required_gender TEXT NOT NULL DEFAULT '不限', required_style TEXT NOT NULL DEFAULT '不限', room_requirement TEXT NOT NULL DEFAULT '普通房', difficulty TEXT NOT NULL DEFAULT '中等', notes TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS scripts_name_idx ON scripts(name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER NOT NULL, status TEXT NOT NULL DEFAULT '空闲', supported_types TEXT NOT NULL DEFAULT '[]', needs_cleaning INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_idx ON rooms(name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS dm_script_skills (id TEXT PRIMARY KEY, dm_id TEXT NOT NULL, script_id TEXT NOT NULL, proficiency INTEGER NOT NULL DEFAULT 3, priority INTEGER NOT NULL DEFAULT 0, willing INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS dm_script_unique_idx ON dm_script_skills(dm_id, script_id)"),
  ]);
  return db;
}

async function seedIfEmpty(db: D1Database) {
  const count = await db.prepare("SELECT COUNT(*) AS count FROM dms").all<{ count: number }>();
  if (Number(count.results[0]?.count || 0) > 0) return;
  const stamp = now();
  const statements = [
    ...seedDms.map(dm => db.prepare("INSERT INTO dms (id,name,nickname,phone,gender,status,in_store,can_host,can_fill,styles,specialties,available_from,available_until,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(dm[0],dm[1],dm[2],"",dm[3],dm[4],dm[5],dm[6],dm[7],JSON.stringify(dm[8]),JSON.stringify(dm[9]),dm[10],dm[11],"",1,stamp,stamp)),
    ...seedScripts.map(script => db.prepare("INSERT INTO scripts (id,name,category,min_players,standard_players,max_players,duration_minutes,prep_minutes,review_minutes,allow_dm_fill,max_dm_fill,min_proficiency,required_gender,required_style,room_requirement,difficulty,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(script[0],script[1],script[2],script[3],script[4],script[5],script[6],30,30,script[7],script[8],script[9],script[10],script[11],script[12],script[13],"",1,stamp,stamp)),
    ...seedRooms.map(room => db.prepare("INSERT INTO rooms (id,name,capacity,status,supported_types,needs_cleaning,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(room[0],room[1],room[2],room[3],JSON.stringify(room[4]),room[5],room[6],1,stamp,stamp)),
    ...seedSkillLinks.map((skill,index) => db.prepare("INSERT INTO dm_script_skills (id,dm_id,script_id,proficiency,priority,willing) VALUES (?,?,?,?,?,?)").bind(`skill-${index}`,skill[0],skill[1],skill[2],0,1)),
  ];
  await db.batch(statements);
}

const parseDm = (row: Record<string, unknown>) => ({ id: row.id, name: row.name, nickname: row.nickname, phone: row.phone, gender: row.gender, status: row.status, inStore: Boolean(row.in_store), canHost: Boolean(row.can_host), canFill: Boolean(row.can_fill), styles: JSON.parse(String(row.styles || "[]")), specialties: JSON.parse(String(row.specialties || "[]")), availableFrom: row.available_from, availableUntil: row.available_until, notes: row.notes, enabled: Boolean(row.enabled) });
const parseScript = (row: Record<string, unknown>) => ({ id: row.id, name: row.name, category: row.category, minPlayers: row.min_players, standardPlayers: row.standard_players, maxPlayers: row.max_players, durationMinutes: row.duration_minutes, prepMinutes: row.prep_minutes, reviewMinutes: row.review_minutes, allowDmFill: Boolean(row.allow_dm_fill), maxDmFill: row.max_dm_fill, minProficiency: row.min_proficiency, requiredGender: row.required_gender, requiredStyle: row.required_style, roomRequirement: row.room_requirement, difficulty: row.difficulty, notes: row.notes, enabled: Boolean(row.enabled) });
const parseRoom = (row: Record<string, unknown>) => ({ id: row.id, name: row.name, capacity: row.capacity, status: row.status, supportedTypes: JSON.parse(String(row.supported_types || "[]")), needsCleaning: Boolean(row.needs_cleaning), notes: row.notes, enabled: Boolean(row.enabled) });

export async function GET() {
  try {
    const db = await ensureTables();
    await seedIfEmpty(db);
    const [dmRows, scriptRows, roomRows, skillRows] = await Promise.all([
      db.prepare("SELECT * FROM dms ORDER BY enabled DESC, name ASC").all<Record<string, unknown>>(),
      db.prepare("SELECT * FROM scripts ORDER BY enabled DESC, name ASC").all<Record<string, unknown>>(),
      db.prepare("SELECT * FROM rooms ORDER BY enabled DESC, name ASC").all<Record<string, unknown>>(),
      db.prepare("SELECT * FROM dm_script_skills").all<Record<string, unknown>>(),
    ]);
    return Response.json({ dms: dmRows.results.map(parseDm), scripts: scriptRows.results.map(parseScript), rooms: roomRows.results.map(parseRoom), skills: skillRows.results.map(row => ({ id: row.id, dmId: row.dm_id, scriptId: row.script_id, proficiency: row.proficiency, priority: row.priority, willing: Boolean(row.willing) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取基础资料失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CatalogBody;
    if (!body.resource || !body.action || !body.entity) return Response.json({ error: "请求内容不完整" }, { status: 400 });
    const db = await ensureTables();
    const entity = body.entity;
    const id = String(entity.id || `${body.resource}-${crypto.randomUUID()}`);
    const stamp = now();

    if (body.resource === "dm") {
      if (!String(entity.name || "").trim()) return Response.json({ error: "DM 姓名不能为空" }, { status: 400 });
      const values = [String(entity.name).trim(), String(entity.nickname || ""), String(entity.phone || ""), String(entity.gender || "未设置"), String(entity.status || "未到店"), bool(entity.inStore) ? 1 : 0, bool(entity.canHost, true) ? 1 : 0, bool(entity.canFill, true) ? 1 : 0, json(entity.styles), json(entity.specialties), String(entity.availableFrom || "12:00"), String(entity.availableUntil || "24:00"), String(entity.notes || ""), bool(entity.enabled, true) ? 1 : 0];
      if (body.action === "create") await db.prepare("INSERT INTO dms (id,name,nickname,phone,gender,status,in_store,can_host,can_fill,styles,specialties,available_from,available_until,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,...values,stamp,stamp).run();
      else await db.prepare("UPDATE dms SET name=?,nickname=?,phone=?,gender=?,status=?,in_store=?,can_host=?,can_fill=?,styles=?,specialties=?,available_from=?,available_until=?,notes=?,enabled=?,updated_at=? WHERE id=?").bind(...values,stamp,id).run();
    } else if (body.resource === "script") {
      if (!String(entity.name || "").trim()) return Response.json({ error: "剧本名称不能为空" }, { status: 400 });
      const values = [String(entity.name).trim(),String(entity.category || "还原"),num(entity.minPlayers,5),num(entity.standardPlayers,6),num(entity.maxPlayers,6),num(entity.durationMinutes,240),num(entity.prepMinutes,30),num(entity.reviewMinutes,30),bool(entity.allowDmFill,true)?1:0,num(entity.maxDmFill,1),num(entity.minProficiency,3),String(entity.requiredGender || "不限"),String(entity.requiredStyle || "不限"),String(entity.roomRequirement || "普通房"),String(entity.difficulty || "中等"),String(entity.notes || ""),bool(entity.enabled,true)?1:0];
      if (body.action === "create") await db.prepare("INSERT INTO scripts (id,name,category,min_players,standard_players,max_players,duration_minutes,prep_minutes,review_minutes,allow_dm_fill,max_dm_fill,min_proficiency,required_gender,required_style,room_requirement,difficulty,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,...values,stamp,stamp).run();
      else await db.prepare("UPDATE scripts SET name=?,category=?,min_players=?,standard_players=?,max_players=?,duration_minutes=?,prep_minutes=?,review_minutes=?,allow_dm_fill=?,max_dm_fill=?,min_proficiency=?,required_gender=?,required_style=?,room_requirement=?,difficulty=?,notes=?,enabled=?,updated_at=? WHERE id=?").bind(...values,stamp,id).run();
    } else if (body.resource === "room") {
      if (!String(entity.name || "").trim()) return Response.json({ error: "房间名称不能为空" }, { status: 400 });
      const values = [String(entity.name).trim(),num(entity.capacity,6),String(entity.status || "空闲"),json(entity.supportedTypes),bool(entity.needsCleaning)?1:0,String(entity.notes || ""),bool(entity.enabled,true)?1:0];
      if (body.action === "create") await db.prepare("INSERT INTO rooms (id,name,capacity,status,supported_types,needs_cleaning,notes,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,...values,stamp,stamp).run();
      else await db.prepare("UPDATE rooms SET name=?,capacity=?,status=?,supported_types=?,needs_cleaning=?,notes=?,enabled=?,updated_at=? WHERE id=?").bind(...values,stamp,id).run();
    } else {
      const dmId = String(entity.dmId || "");
      const scriptId = String(entity.scriptId || "");
      if (!dmId || !scriptId) return Response.json({ error: "DM 和剧本不能为空" }, { status: 400 });
      await db.prepare("INSERT INTO dm_script_skills (id,dm_id,script_id,proficiency,priority,willing) VALUES (?,?,?,?,?,?) ON CONFLICT(dm_id,script_id) DO UPDATE SET proficiency=excluded.proficiency,priority=excluded.priority,willing=excluded.willing").bind(id,dmId,scriptId,num(entity.proficiency,3),num(entity.priority,0),bool(entity.willing,true)?1:0).run();
    }
    return Response.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return Response.json({ error: message.includes("UNIQUE") ? "名称已存在，请换一个名称" : message }, { status: 400 });
  }
}
