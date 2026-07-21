import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dispatchState = sqliteTable("dispatch_state", {
  id: integer("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operationLogs = sqliteTable("operation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  time: text("time").notNull(),
  operator: text("operator").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export const dms = sqliteTable("dms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname").notNull().default(""),
  phone: text("phone").notNull().default(""),
  gender: text("gender").notNull().default("未设置"),
  status: text("status").notNull().default("未到店"),
  inStore: integer("in_store", { mode: "boolean" }).notNull().default(false),
  canHost: integer("can_host", { mode: "boolean" }).notNull().default(true),
  canFill: integer("can_fill", { mode: "boolean" }).notNull().default(true),
  styles: text("styles").notNull().default("[]"),
  specialties: text("specialties").notNull().default("[]"),
  availableFrom: text("available_from").notNull().default("12:00"),
  availableUntil: text("available_until").notNull().default("24:00"),
  notes: text("notes").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scripts = sqliteTable("scripts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  minPlayers: integer("min_players").notNull(),
  standardPlayers: integer("standard_players").notNull(),
  maxPlayers: integer("max_players").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  prepMinutes: integer("prep_minutes").notNull().default(30),
  reviewMinutes: integer("review_minutes").notNull().default(30),
  allowDmFill: integer("allow_dm_fill", { mode: "boolean" }).notNull().default(true),
  maxDmFill: integer("max_dm_fill").notNull().default(1),
  minProficiency: integer("min_proficiency").notNull().default(3),
  requiredGender: text("required_gender").notNull().default("不限"),
  requiredStyle: text("required_style").notNull().default("不限"),
  roomRequirement: text("room_requirement").notNull().default("普通房"),
  difficulty: text("difficulty").notNull().default("中等"),
  notes: text("notes").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("空闲"),
  supportedTypes: text("supported_types").notNull().default("[]"),
  needsCleaning: integer("needs_cleaning", { mode: "boolean" }).notNull().default(false),
  notes: text("notes").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dmScriptSkills = sqliteTable("dm_script_skills", {
  id: text("id").primaryKey(),
  dmId: text("dm_id").notNull(),
  scriptId: text("script_id").notNull(),
  proficiency: integer("proficiency").notNull().default(3),
  priority: integer("priority").notNull().default(0),
  willing: integer("willing", { mode: "boolean" }).notNull().default(true),
});
