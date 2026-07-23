"use client";

import { useId, useMemo, useState } from "react";
import type { DmRecord, DmStatus, RoomRecord, ScriptRecord, SkillRecord } from "./types";

type Resource = "dm" | "script" | "room";
type Props = {
  page: "DM 状态" | "剧本管理" | "房间管理";
  dms: DmRecord[];
  scripts: ScriptRecord[];
  rooms: RoomRecord[];
  skills: SkillRecord[];
  save: (resource: Resource, entity: Record<string, unknown>) => Promise<void>;
  saveSkill: (entity: Record<string, unknown>) => Promise<void>;
  notice: (message: string) => void;
  canManage: boolean;
};

const dmStatuses: DmStatus[] = ["未到店", "空闲", "准备中", "主持中", "玩家补位中", "休息中", "暂时不可用", "已下班"];
const categories = ["情感", "推理", "欢乐", "阵营", "恐怖", "机制", "城限", "还原"];

export default function CatalogManager({ page, dms, scripts, rooms, skills, save, saveSkill, notice, canManage }: Props) {
  const [query, setQuery] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [editing, setEditing] = useState<DmRecord | ScriptRecord | RoomRecord | "new" | null>(null);
  const resource: Resource = page === "DM 状态" ? "dm" : page === "剧本管理" ? "script" : "room";

  const filteredDms = useMemo(() => dms.filter(dm => (showDisabled || dm.enabled) && `${dm.name}${dm.nickname}${dm.specialties.join("")}`.includes(query)), [dms, query, showDisabled]);
  const filteredScripts = useMemo(() => scripts.filter(script => (showDisabled || script.enabled) && `${script.name}${script.category}`.includes(query)), [scripts, query, showDisabled]);
  const filteredRooms = useMemo(() => rooms.filter(room => (showDisabled || room.enabled) && `${room.name}${room.supportedTypes.join("")}`.includes(query)), [rooms, query, showDisabled]);

  async function quickUpdate(entity: DmRecord | ScriptRecord | RoomRecord, patch: Record<string, unknown>) {
    await save(resource, { ...entity, ...patch });
  }

  const enabledCount = resource === "dm" ? dms.filter(x => x.enabled).length : resource === "script" ? scripts.filter(x => x.enabled).length : rooms.filter(x => x.enabled).length;
  return <section className="content-page catalog-page">
    <div className="page-heading">
      <div><span>门店基础资料 · 已启用 {enabledCount}</span><h2>{page}</h2><p>{page === "DM 状态" ? "维护人员能力、到店状态、补位许可与可用时间。" : page === "剧本管理" ? "维护开本人数、时长、补位规则和 DM 熟练度。" : "维护容量、房态、清理状态和支持的剧本类型。"}</p></div>
      <button className="primary" disabled={!canManage} onClick={() => setEditing("new")}>＋ 新增{resource === "dm" ? " DM" : resource === "script" ? "剧本" : "房间"}</button>
    </div>
    {!canManage && <div className="permission-banner">当前账号拥有查看权限，基础资料修改由店长或管理员完成。</div>}
    <div className="catalog-toolbar"><label><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`搜索${resource === "dm" ? "姓名、昵称或擅长类型" : resource === "script" ? "剧本名称或类型" : "房间名称或支持类型"}`} /></label><label className="switch-line"><input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)}/><span>显示已停用</span></label></div>

    {page === "DM 状态" && <div className="dm-grid rich-grid">{filteredDms.map(dm => <article className={`dm-card ${!dm.enabled ? "disabled-card" : ""}`} key={dm.id}>
      <div className="dm-card-top"><span className="avatar large indigo">{dm.name.slice(0, 1)}</span><div><h3>{dm.name}<small>{dm.nickname && ` · ${dm.nickname}`}</small></h3><em className={`dm-status ${dm.status}`}>{dm.status}</em></div><button disabled={!canManage} onClick={() => setEditing(dm)}>编辑</button></div>
      <div className="tag-row">{dm.specialties.map(tag => <em key={tag}>{tag}</em>)}{dm.styles.slice(0, 2).map(tag => <em className="soft" key={tag}>{tag}</em>)}</div>
      <dl><div><dt>可用时间</dt><dd>{dm.availableFrom} 至 {dm.availableUntil}</dd></div><div><dt>权限</dt><dd>{dm.canHost ? "可主持" : "不可主持"} · {dm.canFill ? "可补位" : "不补位"}</dd></div><div><dt>到店状态</dt><dd>{dm.inStore ? "已到店" : "未到店"}</dd></div></dl>
      <div className="card-control"><select value={dm.status} disabled={!dm.enabled || !canManage} onChange={e => quickUpdate(dm, { status: e.target.value, inStore: !["未到店", "已下班"].includes(e.target.value) })}>{dmStatuses.map(status => <option key={status}>{status}</option>)}</select><button disabled={!canManage} onClick={() => quickUpdate(dm, { enabled: !dm.enabled })}>{dm.enabled ? "停用" : "恢复"}</button></div>
    </article>)}</div>}

    {page === "剧本管理" && <div className="table-card catalog-table"><table><thead><tr><th>剧本</th><th>类型 / 难度</th><th>人数</th><th>时长</th><th>补位规则</th><th>合格 DM</th><th>状态</th><th/></tr></thead><tbody>{filteredScripts.map(script => {
      const qualified = skills.filter(skill => skill.scriptId === script.id && skill.willing && skill.proficiency >= script.minProficiency).length;
      return <tr key={script.id} className={!script.enabled ? "disabled-row" : ""}><td><b>{script.name}</b><small>{script.roomRequirement}</small></td><td>{script.category}<small>{script.difficulty}</small></td><td>{script.minPlayers} 至 {script.maxPlayers}<small>标准 {script.standardPlayers} 人</small></td><td>{Math.floor(script.durationMinutes / 60)}h {script.durationMinutes % 60 || ""}<small>准备 {script.prepMinutes} 分钟</small></td><td>{script.allowDmFill ? `允许，最多 ${script.maxDmFill} 人` : "不允许"}</td><td><strong className={qualified === 0 ? "text-danger" : ""}>{qualified}</strong><small>熟练度 ≥ {script.minProficiency}</small></td><td><em className={script.enabled ? "available" : "busy"}>{script.enabled ? "在架" : "已下架"}</em></td><td><button disabled={!canManage} onClick={() => setEditing(script)}>编辑</button><button disabled={!canManage} onClick={() => quickUpdate(script, { enabled: !script.enabled })}>{script.enabled ? "下架" : "上架"}</button></td></tr>;
    })}</tbody></table></div>}

    {page === "房间管理" && <div className="room-grid rich-rooms">{filteredRooms.map(room => <article className={!room.enabled ? "disabled-card" : ""} key={room.id}>
      <div><span>⌂</span><em className={room.status === "空闲" ? "available" : "busy"}>{room.enabled ? room.status : "停用"}</em></div><h3>{room.name}</h3><p>容量 {room.capacity} 人</p><div className="tag-row">{room.supportedTypes.map(tag => <em key={tag}>{tag}</em>)}</div><small>{room.notes || "暂无备注"}</small>{room.needsCleaning && <div className="clean-alert">需要清理后才能使用</div>}
      <div className="room-actions"><button disabled={!canManage} onClick={() => setEditing(room)}>编辑资料</button><button disabled={!canManage} onClick={() => quickUpdate(room, { needsCleaning: !room.needsCleaning, status: room.needsCleaning ? "空闲" : "清理中" })}>{room.needsCleaning ? "完成清理" : "标记清理"}</button><button disabled={!canManage} onClick={() => quickUpdate(room, { enabled: !room.enabled, status: room.enabled ? "停用" : "空闲" })}>{room.enabled ? "停用" : "恢复"}</button></div>
    </article>)}</div>}

    {editing && resource === "dm" && <DmEditor value={editing === "new" ? null : editing as DmRecord} onClose={() => setEditing(null)} onSave={async entity => { await save("dm", entity); setEditing(null); notice("DM 资料已保存"); }} />}
    {editing && resource === "script" && <ScriptEditor value={editing === "new" ? null : editing as ScriptRecord} dms={dms.filter(x => x.enabled)} skills={skills} onClose={() => setEditing(null)} onSave={async (entity, assignments) => { await save("script", entity); for (const skill of assignments) await saveSkill(skill); setEditing(null); notice("剧本与 DM 熟练度已保存"); }} />}
    {editing && resource === "room" && <RoomEditor value={editing === "new" ? null : editing as RoomRecord} onClose={() => setEditing(null)} onSave={async entity => { await save("room", entity); setEditing(null); notice("房间资料已保存"); }} />}
  </section>;
}

function DmEditor({ value, onClose, onSave }: { value: DmRecord | null; onClose: () => void; onSave: (entity: Record<string, unknown>) => Promise<void> }) {
  function submit(form: FormData) { return onSave({ ...value, name: form.get("name"), nickname: form.get("nickname"), phone: form.get("phone"), gender: form.get("gender"), status: form.get("status"), inStore: form.get("inStore") === "on", canHost: form.get("canHost") === "on", canFill: form.get("canFill") === "on", specialties: String(form.get("specialties") || "").split(/[，,]/).map(x => x.trim()).filter(Boolean), styles: String(form.get("styles") || "").split(/[，,]/).map(x => x.trim()).filter(Boolean), availableFrom: form.get("availableFrom"), availableUntil: form.get("availableUntil"), notes: form.get("notes"), enabled: value?.enabled ?? true }); }
  return <EditorShell title={value ? `编辑 DM · ${value.name}` : "新增 DM"} subtitle="人员档案、技能偏好与出勤能力" onClose={onClose}><form action={submit}><div className="form-grid"><Field label="姓名 *"><input name="name" required defaultValue={value?.name}/></Field><Field label="昵称"><input name="nickname" defaultValue={value?.nickname}/></Field><Field label="手机号"><input name="phone" defaultValue={value?.phone}/></Field><Field label="性别"><select name="gender" defaultValue={value?.gender || "未设置"}><option>未设置</option><option>男</option><option>女</option><option>其他</option></select></Field><Field label="当前状态"><select name="status" defaultValue={value?.status || "未到店"}>{dmStatuses.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="可用时间"><div className="inline-inputs"><input name="availableFrom" type="time" defaultValue={value?.availableFrom || "12:00"}/><span>至</span><input name="availableUntil" type="time" defaultValue={value?.availableUntil || "23:30"}/></div></Field><Field label="擅长类型" wide><input name="specialties" placeholder="情感，推理，欢乐" defaultValue={value?.specialties.join("，")}/></Field><Field label="主持风格" wide><input name="styles" placeholder="沉浸，控场，细腻" defaultValue={value?.styles.join("，")}/></Field><Field label="备注" wide><textarea name="notes" defaultValue={value?.notes}/></Field></div><div className="option-grid"><Check name="inStore" label="已到店" defaultChecked={value?.inStore}/><Check name="canHost" label="可以主持" defaultChecked={value?.canHost ?? true}/><Check name="canFill" label="可以玩家补位" defaultChecked={value?.canFill ?? true}/></div><EditorActions onClose={onClose}/></form></EditorShell>;
}

function ScriptEditor({ value, dms, skills, onClose, onSave }: { value: ScriptRecord | null; dms: DmRecord[]; skills: SkillRecord[]; onClose: () => void; onSave: (entity: Record<string, unknown>, skills: Record<string, unknown>[]) => Promise<void> }) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const draftId = value?.id || `script-${generatedId}`;
  function submit(form: FormData) {
    const entity = { ...value, id: draftId, name: form.get("name"), category: form.get("category"), minPlayers: Number(form.get("minPlayers")), standardPlayers: Number(form.get("standardPlayers")), maxPlayers: Number(form.get("maxPlayers")), durationMinutes: Number(form.get("durationMinutes")), prepMinutes: Number(form.get("prepMinutes")), reviewMinutes: Number(form.get("reviewMinutes")), allowDmFill: form.get("allowDmFill") === "on", maxDmFill: Number(form.get("maxDmFill")), minProficiency: Number(form.get("minProficiency")), requiredGender: form.get("requiredGender"), requiredStyle: form.get("requiredStyle"), roomRequirement: form.get("roomRequirement"), difficulty: form.get("difficulty"), notes: form.get("notes"), enabled: value?.enabled ?? true };
    const assignments = dms.filter(dm => form.get(`dm-${dm.id}`) === "on").map(dm => ({ dmId: dm.id, scriptId: draftId, proficiency: Number(form.get(`prof-${dm.id}`) || 3), willing: true }));
    return onSave(entity, assignments);
  }
  return <EditorShell title={value ? `编辑剧本 · ${value.name}` : "新增剧本"} subtitle="开本规则、房间要求和 DM 资格" onClose={onClose} wide><form action={submit}><div className="form-grid"><Field label="剧本名称 *"><input required name="name" defaultValue={value?.name}/></Field><Field label="剧本类型"><select name="category" defaultValue={value?.category || "还原"}>{categories.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="最少人数"><input type="number" name="minPlayers" min="2" max="20" defaultValue={value?.minPlayers || 5}/></Field><Field label="标准人数"><input type="number" name="standardPlayers" min="2" max="20" defaultValue={value?.standardPlayers || 6}/></Field><Field label="最多人数"><input type="number" name="maxPlayers" min="2" max="20" defaultValue={value?.maxPlayers || 6}/></Field><Field label="标准时长（分钟）"><input type="number" name="durationMinutes" step="30" defaultValue={value?.durationMinutes || 240}/></Field><Field label="准备时间"><input type="number" name="prepMinutes" step="5" defaultValue={value?.prepMinutes || 30}/></Field><Field label="复盘时间"><input type="number" name="reviewMinutes" step="5" defaultValue={value?.reviewMinutes || 30}/></Field><Field label="最低熟练度"><select name="minProficiency" defaultValue={value?.minProficiency || 3}>{[1,2,3,4,5].map(x => <option key={x} value={x}>{x} 级</option>)}</select></Field><Field label="最多 DM 补位"><input type="number" name="maxDmFill" min="0" max="4" defaultValue={value?.maxDmFill || 1}/></Field><Field label="DM 性别要求"><select name="requiredGender" defaultValue={value?.requiredGender || "不限"}><option>不限</option><option>男</option><option>女</option></select></Field><Field label="主持风格要求"><input name="requiredStyle" defaultValue={value?.requiredStyle || "不限"}/></Field><Field label="房间要求"><select name="roomRequirement" defaultValue={value?.roomRequirement || "普通房"}><option>普通房</option><option>安静房</option><option>恐怖房</option><option>大房</option></select></Field><Field label="难度"><select name="difficulty" defaultValue={value?.difficulty || "中等"}><option>简单</option><option>中等</option><option>困难</option></select></Field><Field label="备注" wide><textarea name="notes" defaultValue={value?.notes}/></Field></div><div className="option-grid"><Check name="allowDmFill" label="允许 DM 玩家补位" defaultChecked={value?.allowDmFill ?? true}/></div><div className="qualification"><div><h3>可主持 DM 与熟练度</h3><span>勾选后可参与自动推荐</span></div><div className="qualification-grid">{dms.map(dm => { const skill = skills.find(x => x.dmId === dm.id && x.scriptId === value?.id); return <label key={dm.id}><input type="checkbox" name={`dm-${dm.id}`} defaultChecked={Boolean(skill)}/><b>{dm.name}</b><select name={`prof-${dm.id}`} defaultValue={skill?.proficiency || 3}>{[1,2,3,4,5].map(x => <option key={x} value={x}>{x} 级</option>)}</select></label>; })}</div></div><EditorActions onClose={onClose}/></form></EditorShell>;
}

function RoomEditor({ value, onClose, onSave }: { value: RoomRecord | null; onClose: () => void; onSave: (entity: Record<string, unknown>) => Promise<void> }) {
  function submit(form: FormData) { return onSave({ ...value, name: form.get("name"), capacity: Number(form.get("capacity")), status: form.get("status"), supportedTypes: categories.filter(type => form.get(`type-${type}`) === "on"), needsCleaning: form.get("needsCleaning") === "on", notes: form.get("notes"), enabled: value?.enabled ?? true }); }
  return <EditorShell title={value ? `编辑房间 · ${value.name}` : "新增房间"} subtitle="容量、房态与适配剧本类型" onClose={onClose}><form action={submit}><div className="form-grid"><Field label="房间名称 *"><input required name="name" defaultValue={value?.name}/></Field><Field label="容纳人数"><input type="number" min="2" max="30" name="capacity" defaultValue={value?.capacity || 6}/></Field><Field label="当前房态"><select name="status" defaultValue={value?.status || "空闲"}>{["空闲","准备中","使用中","清理中","停用"].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="备注" wide><textarea name="notes" defaultValue={value?.notes}/></Field></div><div className="type-selector"><span>支持的剧本类型</span><div>{categories.map(type => <Check key={type} name={`type-${type}`} label={type} defaultChecked={value?.supportedTypes.includes(type)}/>)}</div></div><div className="option-grid"><Check name="needsCleaning" label="当前需要清理" defaultChecked={value?.needsCleaning}/></div><EditorActions onClose={onClose}/></form></EditorShell>;
}

function EditorShell({ title, subtitle, onClose, wide, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) { return <div className="modal-backdrop"><div className={`modal editor-modal ${wide ? "wide-editor" : ""}`}><div className="modal-head"><div><span>资料维护</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose}>×</button></div>{children}</div></div>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>; }
function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) { return <label className="check-chip"><input type="checkbox" name={name} defaultChecked={defaultChecked}/><span>{label}</span></label>; }
function EditorActions({ onClose }: { onClose: () => void }) { return <div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit">保存资料</button></div>; }
