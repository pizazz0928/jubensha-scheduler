"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CatalogManager from "./catalog-manager";
import type { DmRecord, RoomRecord, ScriptRecord, SessionRecord, SessionStatus, SharedSnapshotResponse, SkillRecord, ViewerRecord } from "./types";

type Session = SessionRecord;
type CatalogResponse = { dms?: DmRecord[]; scripts?: ScriptRecord[]; rooms?: RoomRecord[]; skills?: SkillRecord[] };
type DispatchResponse = { logs?: string[][] };
type ApiResult = { error?: string };

const sessionsSeed: Session[] = [
  { id: 1, time: "14:00", end: "18:30", title: "年轮", type: "情感 · 6人", room: "云间", dm: "阿衡", players: 6, target: 6, fillers: [], status: "进行中", progress: 58 },
  { id: 2, time: "15:30", end: "19:30", title: "漓川怪谈簿", type: "推理 · 7人", room: "雾隐", dm: "南枝", players: 7, target: 7, fillers: [], status: "进行中", progress: 36, handoffs: 3 },
  { id: 3, time: "18:00", end: "22:30", title: "青楼", type: "情感 · 6人", room: "长街", dm: "待安排", players: 6, target: 6, fillers: [], status: "缺DM", risk: "距开场 42 分钟，仅 2 位 DM 符合资格" },
  { id: 4, time: "18:30", end: "23:00", title: "第七号嫌疑人", type: "还原 · 6人", room: "旧巷", dm: "叁叁", players: 5, target: 6, fillers: [], status: "缺玩家", risk: "缺 1 名玩家，可安排 DM 补位" },
  { id: 5, time: "19:00", end: "23:30", title: "兵临城下", type: "机制 · 7人", room: "赤壁", dm: "老白", players: 6, target: 7, fillers: ["小满"], status: "准备中", risk: "补位 DM 小满将在 23:30 后超出下班时间" },
  { id: 6, time: "19:30", end: "23:30", title: "你好", type: "欢乐 · 6人", room: "云间", dm: "乔木", players: 4, target: 6, fillers: [], status: "等待到店", risk: "2 名客人尚未到店" },
  { id: 7, time: "20:00", end: "00:30", title: "拆迁", type: "阵营 · 8人", room: "雾隐", dm: "待安排", players: 7, target: 8, fillers: [], status: "缺DM", risk: "与《漓川怪谈簿》存在 30 分钟房间冲突" },
  { id: 8, time: "21:00", end: "01:00", title: "恶渊百物语", type: "恐怖 · 6人", room: "长街", dm: "十七", players: 6, target: 6, fillers: [], status: "待确认" },
];

const fallbackDms: DmRecord[] = ["阿衡","南枝","小满","乔木","十七","叁叁","老白","北河","白露","林墨","糖圆","舟舟"].map((name, index) => ({ id:`dm-${index}`, name, nickname:"", phone:"", gender:index%2?"女":"男", status:index<2?"主持中":index===2?"玩家补位中":index<6?"空闲":"未到店", inStore:index<10, canHost:true, canFill:index!==1, styles:[index%2?"沉浸":"控场"], specialties:[index%3===0?"情感":index%3===1?"推理":"机制"], availableFrom:"12:00", availableUntil:"24:00", notes:"", enabled:true }));
const fallbackScripts: ScriptRecord[] = [
  ["年轮","情感",6,270],["漓川怪谈簿","推理",7,240],["青楼","情感",6,270],["第七号嫌疑人","还原",6,240],["兵临城下","机制",7,270],["你好","欢乐",6,240],["拆迁","阵营",8,270],["恶渊百物语","恐怖",6,240],["孤城","还原",6,240],["追月","情感",6,270],["猎人笔记","推理",6,210],["离日","机制",7,300],["欢喜镇","欢乐",6,210],["惊蛰","恐怖",6,240],["天命","阵营",8,300],
].map(([name,category,players,duration],index) => ({ id:`script-${index}`, name:String(name), category:String(category), minPlayers:Number(players)-1, standardPlayers:Number(players), maxPlayers:Number(players)+1, durationMinutes:Number(duration), prepMinutes:30, reviewMinutes:30, allowDmFill:true, maxDmFill:1, minProficiency:3, requiredGender:"不限", requiredStyle:"不限", roomRequirement:Number(players)>=8?"大房":"普通房", difficulty:"中等", notes:"", enabled:true }));
const fallbackRooms: RoomRecord[] = [["云间",8,"使用中"],["雾隐",8,"使用中"],["长街",7,"空闲"],["旧巷",6,"准备中"],["赤壁",10,"准备中"],["听雨",6,"空闲"]].map(([name,capacity,status],index) => ({ id:`room-${index}`, name:String(name), capacity:Number(capacity), status:status as RoomRecord["status"], supportedTypes:index===4?["机制","阵营"]:["情感","推理","欢乐","还原"], needsCleaning:false, notes:"", enabled:true }));
const logsSeed = [["17:06","店长 · 林野","将 小满 安排为《兵临城下》玩家补位","人工调整"],["16:52","前台 · 阿梨","《青楼》开始时间调整为 18:00","时间变更"],["16:31","店长 · 林野","《漓川怪谈簿》主 DM 由 白露 更换为 南枝","第 3 次交接"],["16:18","系统","发现《拆迁》与房间雾隐存在时间冲突","严重风险"]];

const Icon = ({ children }: { children: React.ReactNode }) => <span className="icon" aria-hidden="true">{children}</span>;
const timeEnd = (start: string, minutes: number) => { const [h,m]=start.split(":").map(Number); const total=h*60+m+minutes; return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; };
const sessionOverlaps = (left:{time:string;end:string},right:{time:string;end:string}) => { const toMinutes=(value:string)=>{const [hours,minutes]=value.split(":").map(Number);return hours*60+minutes;}; const startA=toMinutes(left.time); let endA=toMinutes(left.end); const startB=toMinutes(right.time); let endB=toMinutes(right.end); if(endA<=startA)endA+=1440;if(endB<=startB)endB+=1440;return startA<endB&&startB<endA; };

export default function DispatchApp() {
  const [sessions, setSessions] = useState(sessionsSeed);
  const [dms, setDms] = useState(fallbackDms);
  const [scripts, setScripts] = useState(fallbackScripts);
  const [rooms, setRooms] = useState(fallbackRooms);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [active, setActive] = useState<"今日调度"|"场次管理"|"DM 状态"|"剧本管理"|"房间管理"|"记录统计">("今日调度");
  const [modal, setModal] = useState<"create"|"assign"|"detail"|null>(null);
  const [assignMode, setAssignMode] = useState<"swap"|"fill">("swap");
  const [selectedSession, setSelectedSession] = useState<Session|null>(null);
  const [toast, setToast] = useState("");
  const [logs, setLogs] = useState<string[][]>(logsSeed);
  const [version, setVersion] = useState(0);
  const versionRef = useRef(0);
  const [viewer, setViewer] = useState<ViewerRecord>({ uid: "demo-admin", displayName: "演示店长", role: "admin", roleLabel: "管理员" });
  const [storageMode, setStorageMode] = useState<"file"|"mysql">("file");
  const [authRequired, setAuthRequired] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<"all"|"running"|"risk">("all");

  const applySnapshot=useCallback((data: SharedSnapshotResponse) => {
    setSessions(data.snapshot.sessions);
    setDms(data.snapshot.catalog.dms);
    setScripts(data.snapshot.catalog.scripts);
    setRooms(data.snapshot.catalog.rooms);
    setSkills(data.snapshot.catalog.skills);
    setLogs(data.snapshot.logs);
    versionRef.current=data.snapshot.version;
    setVersion(data.snapshot.version);
    setViewer(data.viewer);
    setStorageMode(data.storageMode);
    setAuthRequired(false);
  },[]);

  const loadLegacyData=useCallback(async () => {
    try { const response=await fetch("/api/catalog"); if(!response.ok) return; const data=await response.json() as CatalogResponse; if(data.dms) setDms(data.dms); if(data.scripts) setScripts(data.scripts); if(data.rooms) setRooms(data.rooms); if(data.skills) setSkills(data.skills); } catch { /* 演示数据仍可使用 */ }
    try { const response=await fetch("/api/dispatch"); if(!response.ok) return; const data=await response.json() as DispatchResponse; if(data.logs?.length) setLogs(data.logs); } catch { /* 演示数据仍可使用 */ }
  },[]);

  const loadSnapshot=useCallback(async () => {
    try {
      const response=await fetch("/api/shared/snapshot",{cache:"no-store"});
      if(response.status===401){ setAuthRequired(true); return; }
      if(response.status===404){ await loadLegacyData(); return; }
      if(!response.ok) throw new Error("共享数据读取失败");
      applySnapshot(await response.json() as SharedSnapshotResponse);
    } catch { /* 保留最近一次成功数据 */ }
    finally { setSyncing(false); }
  },[applySnapshot,loadLegacyData]);

  useEffect(() => {
    void Promise.resolve().then(loadSnapshot);
    const timer=window.setInterval(()=>void loadSnapshot(),8000);
    return ()=>window.clearInterval(timer);
  }, [loadSnapshot]);
  function notice(message:string){ setToast(message); window.setTimeout(()=>setToast(""),2400); }

  async function postShared(path:string,body:Record<string,unknown>) {
    setSyncing(true);
    try {
      const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,expectedVersion:versionRef.current})});
      const result=await response.json() as SharedSnapshotResponse&ApiResult;
      if(response.status===401){ setAuthRequired(true); throw new Error(result.error||"请先登录"); }
      if(response.status===409){ await loadSnapshot(); throw new Error(`${result.error||"数据已更新"}，已同步最新状态，请重试`); }
      if(!response.ok) throw new Error(result.error||"操作失败");
      applySnapshot(result);
      return result;
    } finally {
      setSyncing(false);
    }
  }

  async function saveCatalog(resource:"dm"|"script"|"room", entity:Record<string,unknown>){
    const list=resource==="dm"?dms:resource==="script"?scripts:rooms;
    const action=entity.id && list.some(item=>item.id===entity.id)?"update":"create";
    try { await postShared("/api/shared/catalog",{resource,action,entity}); }
    catch(error) { const message=error instanceof Error?error.message:"保存失败"; notice(message); throw error; }
  }
  async function saveSkill(entity:Record<string,unknown>){ try { await postShared("/api/shared/catalog",{resource:"skill",action:"upsert",entity}); } catch(error) { const message=error instanceof Error?error.message:"熟练度保存失败"; notice(message); throw error; } }

  const stats=useMemo(()=>[["今日场次",sessions.length,`其中 ${sessions.filter(s=>s.status==="进行中").length} 场进行中`,"▦","#4f46e5"],["待开场",sessions.filter(s=>["准备中","等待到店","缺DM","缺玩家"].includes(s.status)).length,"包含等待与待处理","◷","#2563eb"],["缺 DM",sessions.filter(s=>s.status==="缺DM").length,"需要立即处理","♙","#dc2626"],["缺玩家",sessions.filter(s=>s.players<s.target&&!["已结束","已取消"].includes(s.status)).length,"可安排补位","♟","#d97706"],["可用 DM",dms.filter(d=>d.enabled&&d.inStore&&d.status==="空闲").length,"实时资料计算","✦","#059669"],["可用房间",rooms.filter(r=>r.enabled&&r.status==="空闲"&&!r.needsCleaning).length,"排除待清理","⌂","#7c3aed"]],[sessions,dms,rooms]);
  const nav:[[typeof active,string],...Array<[typeof active,string]>]=[["今日调度","⌁"],["场次管理","▦"],["DM 状态","♙"],["剧本管理","▤"],["房间管理","⌂"],["记录统计","⌁"]];
  const visibleSessions=sessions.filter(session=>sessionFilter==="all"||sessionFilter==="running"?sessionFilter==="all"||session.status==="进行中":Boolean(session.risk));
  const firstRisk=sessions.find(session=>session.risk);

  function eligible(script:ScriptRecord|undefined, mode:"swap"|"fill", target?:Pick<Session,"time"|"end">&{id?:number}) {
    const availableStatuses=["空闲","准备中","主持中","玩家补位中"];
    const candidates=dms.filter(dm=>dm.enabled&&dm.inStore&&availableStatuses.includes(dm.status)&&(mode==="swap"?dm.canHost:dm.canFill)).filter(dm=>!target||!sessions.some(item=>item.id!==target.id&&(item.dm===dm.name||item.fillers.includes(dm.name))&&sessionOverlaps(item,target)));
    if(!script) return candidates;
    if(mode==="fill"&&!script.allowDmFill) return [];
    return candidates.map(dm=>{
      const skill=skills.find(s=>s.dmId===dm.id&&s.scriptId===script.id&&s.willing);
      const specialty=dm.specialties.includes(script.category);
      const proficiency=skill?.proficiency || (specialty?3:1);
      const style=script.requiredStyle==="不限"||dm.styles.includes(script.requiredStyle);
      const gender=script.requiredGender==="不限"||dm.gender===script.requiredGender;
      return {...dm,score:Math.min(99,40+proficiency*9+(style?8:0)+(gender?8:0)),proficiency,qualified:mode==="fill"||(proficiency>=script.minProficiency&&style&&gender)};
    }).filter(dm=>dm.qualified).sort((a,b)=>b.score-a.score);
  }

  function openAssign(session:Session,mode:"swap"|"fill"){ setSelectedSession(session); setAssignMode(mode); setModal("assign"); }
  async function confirmAssign(dmName:string){ if(!selectedSession)return; const action=assignMode==="swap"?"主 DM":"玩家补位"; try { await postShared("/api/shared/dispatch",{kind:"assign",payload:{sessionId:selectedSession.id,mode:assignMode,dm:dmName}}); setModal(null); notice(`${dmName} 已安排为${action}`); } catch(error) { notice(error instanceof Error?error.message:"安排失败"); } }
  async function changeSession(payload:Record<string,unknown>){ if(!selectedSession)return; try { await postShared("/api/shared/dispatch",{kind:"session",payload:{sessionId:selectedSession.id,...payload}}); setModal(null); notice("场次已更新"); } catch(error) { notice(error instanceof Error?error.message:"场次更新失败"); } }

  async function createSession(data:{scriptId:string;time:string;players:number;roomId:string}){
    const script=scripts.find(x=>x.id===data.scriptId); if(!script){ notice("请先选择剧本"); return; } const end=timeEnd(data.time,script.durationMinutes+script.reviewMinutes); const candidates=eligible(script,"swap",{time:data.time,end}); const dm=candidates[0]?.name||"待安排"; const room=data.roomId==="auto"?rooms.find(r=>r.enabled&&r.status==="空闲"&&!r.needsCleaning&&r.capacity>=script.standardPlayers&&r.supportedTypes.includes(script.category)&&!sessions.some(item=>item.room===r.name&&sessionOverlaps(item,{time:data.time,end}))):rooms.find(r=>r.id===data.roomId); if(!room){ notice("当前没有满足要求的空闲房间"); return; } const missing=script.standardPlayers-data.players; const status:SessionStatus=dm==="待安排"?"缺DM":missing>0?"缺玩家":"准备中"; const risk=dm==="待安排"?"没有符合资格且空闲的 DM":missing>0?`缺 ${missing} 名玩家${script.allowDmFill?"，可安排 DM 补位":"，该剧本不允许 DM 补位"}`:undefined; const item:Session={id:Date.now(),time:data.time,end,title:script.name,type:`${script.category} · ${script.standardPlayers}人`,room:room.name,dm,players:data.players,target:script.standardPlayers,fillers:[],status,risk}; try { await postShared("/api/shared/dispatch",{kind:"create",payload:item}); setModal(null); notice("临时场次已创建，并采用实时资料推荐"); } catch(error) { notice(error instanceof Error?error.message:"创建失败"); } }

  const canDispatch=["admin","manager","frontdesk"].includes(viewer.role);
  const canManage=["admin","manager"].includes(viewer.role);
  const today=new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  if(authRequired) return <main className="auth-screen"><section><span className="brand-mark">归</span><h1>请先登录排班系统</h1><p>当前地址需要通过腾讯云登录入口访问。完成登录后刷新此页面。</p><button className="primary" onClick={()=>window.location.reload()}>刷新页面</button></section></main>;

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">归</div><div><b>归来剧场</b><span>实时排班系统</span></div></div><nav>{nav.map(([name,symbol])=><button key={name} className={active===name?"active":""} onClick={()=>setActive(name)}><Icon>{symbol}</Icon>{name}{name==="今日调度"&&<em>{sessions.filter(s=>s.risk).length}</em>}</button>)}</nav><div className="sidebar-bottom"><button onClick={()=>setActive("记录统计")}><Icon>▤</Icon>操作记录</button><div className="support"><span>调度规则 v2.0</span><small>资料库已连接</small></div></div></aside>
    <section className="workspace"><header className="topbar"><div><span className="eyebrow">实时运营中心</span><h1>{active}</h1></div><div className="top-actions"><span className={`sync-status ${syncing?"syncing":""}`}>{syncing?"同步中":storageMode==="mysql"?`云端已同步 · v${version}`:"本机数据模式"}</span><div className="today"><b>今天</b><span>{today}</span></div><span className="divider"/><button className="bell" aria-label="查看操作记录" onClick={()=>setActive("记录统计")}>♧<i>{Math.min(99,logs.length)}</i></button><div className="profile"><span>{viewer.displayName.slice(0,1)}</span><div><b>{viewer.displayName}</b><small>{viewer.roleLabel}</small></div><i>⌄</i></div></div></header>
    {(active==="今日调度"||active==="场次管理")?<><section className="stats-grid">{stats.map(([label,value,sub,icon,color])=><article className="stat-card" key={String(label)}><div><span>{label}</span><strong>{value}</strong><small className={label==="缺 DM"?"danger":""}>{sub}</small></div><div className="stat-icon" style={{color:String(color),background:`${color}12`}}><Icon>{icon}</Icon></div></article>)}</section>{!canDispatch&&<div className="permission-banner">当前账号可查看自己的安排，场次调整由店长或前台完成。</div>}{firstRisk&&<div className="critical-alert"><div className="alert-badge">!</div><div><b>{sessions.filter(session=>session.risk).length} 项风险需要处理</b><span>《{firstRisk.title}》{firstRisk.risk}</span></div><button onClick={()=>setSessionFilter("risk")}>查看风险场次</button></div>}<section className="dispatch-layout"><div className="schedule-panel"><div className="section-head"><div><h2>今日场次</h2><span>自定义 DM、剧本与房间已参与实时推荐</span></div><div className="filter-pills"><button className={sessionFilter==="all"?"selected":""} onClick={()=>setSessionFilter("all")}>全部 {sessions.length}</button><button className={sessionFilter==="running"?"selected":""} onClick={()=>setSessionFilter("running")}>进行中 {sessions.filter(s=>s.status==="进行中").length}</button><button className={sessionFilter==="risk"?"selected":""} onClick={()=>setSessionFilter("risk")}>待处理 {sessions.filter(s=>s.risk).length}</button></div></div><div className="timeline">{visibleSessions.map((session,index)=><SessionCard key={session.id} session={session} first={index===0} onSwap={()=>canDispatch?openAssign(session,"swap"):notice("当前账号没有调度权限")} onFill={()=>canDispatch?openAssign(session,"fill"):notice("当前账号没有调度权限")} onDetail={()=>{setSelectedSession(session);setModal("detail");}}/>)}</div></div><aside className="dm-panel"><div className="dm-head"><div><h2>DM 实时池</h2><span><i/> {dms.filter(d=>d.enabled&&d.inStore&&d.status==="空闲").length} 人可用</span></div><button onClick={()=>setActive("DM 状态")}>查看资料</button></div><div className="dm-list">{dms.filter(d=>d.enabled).slice(0,8).map(dm=><button className="dm-row" key={dm.id} onClick={()=>setActive("DM 状态")}><span className="avatar indigo">{dm.name.slice(0,1)}</span><div><div><b>{dm.name}</b><em className={`dm-status ${dm.status}`}>{dm.status}</em></div><span>{dm.specialties.join(" / ")||"待设置擅长类型"}</span><small>{dm.availableFrom} 至 {dm.availableUntil} · {dm.canFill?"可补位":"不补位"}</small></div><i>›</i></button>)}</div><button className="pool-action" onClick={()=>setActive("DM 状态")}>查看 DM 状态与技能</button></aside></section></>:active==="记录统计"?<LogsPage logs={logs} dms={dms}/>:<CatalogManager page={active} dms={dms} scripts={scripts} rooms={rooms} skills={skills} save={saveCatalog} saveSkill={saveSkill} notice={notice} canManage={canManage}/>}</section>
    {canDispatch&&<button className="quick-create" onClick={()=>setModal("create")}><span>＋</span> 临时开本</button>}{modal==="create"&&<CreateModal scripts={scripts.filter(x=>x.enabled)} rooms={rooms.filter(x=>x.enabled)} eligible={eligible} onClose={()=>setModal(null)} onCreate={createSession}/>} {modal==="assign"&&selectedSession&&<AssignModal session={selectedSession} mode={assignMode} candidates={eligible(scripts.find(s=>s.name===selectedSession.title),assignMode,selectedSession).filter(dm=>dm.name!==selectedSession.dm&&!selectedSession.fillers.includes(dm.name))} onClose={()=>setModal(null)} onConfirm={confirmAssign}/>} {modal==="detail"&&selectedSession&&<SessionDetailModal session={selectedSession} canDispatch={canDispatch} onClose={()=>setModal(null)} onChange={changeSession}/>} {toast&&<div className="toast"><span>✓</span>{toast}</div>}</main>;
}

function SessionCard({session,first,onSwap,onFill,onDetail}:{session:Session;first:boolean;onSwap:()=>void;onFill:()=>void;onDetail:()=>void}){ const severity=session.status==="缺DM"?"red":session.status==="缺玩家"?"amber":session.status==="进行中"?"blue":session.risk?"violet":"slate"; const closed=["已结束","已取消"].includes(session.status); return <article className={`session-row ${severity}`}><div className="time-col"><strong>{session.time}</strong><span>{session.end}</span>{first&&<i>现在</i>}</div><div className="line-col"><span/></div><div className="session-card"><div className="card-main"><div className="card-title"><div><span className={`status-dot ${severity}`}/><h3>{session.title}</h3><em>{session.status}</em></div><span>{session.type}</span></div><div className="session-meta"><span><Icon>⌂</Icon>{session.room}</span><span><Icon>♙</Icon>{session.dm}</span><span className={session.players<session.target?"warn":""}><Icon>♟</Icon>{session.players}/{session.target} 玩家</span>{session.fillers.length>0&&<span className="filler"><Icon>✦</Icon>{session.fillers.join("、")}补位</span>}</div>{session.progress&&<div className="progress-wrap"><div><span>场次进行中</span><b>{session.progress}%</b></div><progress value={session.progress} max="100"/></div>}{session.risk&&<div className={`risk-line ${severity}`}><span>!</span><p>{session.risk}</p>{session.handoffs&&<em>已交接 {session.handoffs} 次</em>}</div>}</div><div className="card-actions">{!closed&&<button onClick={onSwap}>{session.dm==="待安排"?"安排 DM":"快速换 DM"}</button>}{!closed&&session.players<session.target&&<button className="accent" onClick={onFill}>＋ 添加补位</button>}<button className="more" onClick={onDetail}>详情</button></div></div></article>; }

function SessionDetailModal({session,canDispatch,onClose,onChange}:{session:Session;canDispatch:boolean;onClose:()=>void;onChange:(payload:Record<string,unknown>)=>Promise<void>}){ const closed=["已结束","已取消"].includes(session.status); async function submit(form:FormData){await onChange({action:"edit",time:String(form.get("time")),end:String(form.get("end")),players:Number(form.get("players"))});} async function run(action:"start"|"end"|"cancel"){const labels={start:"开始",end:"结束",cancel:"取消"};if(window.confirm(`确认${labels[action]}《${session.title}》吗？`))await onChange({action});} return <div className="modal-backdrop"><div className="modal editor-modal"><div className="modal-head"><div><span>场次详情 · {session.status}</span><h2>{session.title}</h2><p>{session.room} · 主 DM {session.dm}</p></div><button onClick={onClose}>×</button></div><form action={submit}><div className="form-grid"><label><span>开始时间</span><input name="time" type="time" defaultValue={session.time} disabled={!canDispatch||closed}/></label><label><span>结束时间</span><input name="end" type="time" defaultValue={session.end} disabled={!canDispatch||closed}/></label><label><span>当前玩家人数</span><input name="players" type="number" min="0" max="30" defaultValue={session.players} disabled={!canDispatch||closed}/></label><label><span>目标人数</span><input value={session.target} disabled readOnly/></label></div>{session.risk&&<div className="impact"><span>!</span><p><b>当前风险</b><br/>{session.risk}</p></div>}<div className="detail-fillers"><h3>玩家补位 DM</h3>{session.fillers.length===0?<p>当前没有 DM 玩家补位。</p>:session.fillers.map(name=><div key={name}><span>{name}</span><button type="button" disabled={!canDispatch||closed} onClick={()=>window.confirm(`确认让 ${name} 退出补位吗？`)&&void onChange({action:"removeFiller",dm:name,replacedByPlayer:true})}>真实玩家到店并退出补位</button></div>)}</div><div className="modal-actions detail-actions"><button type="button" onClick={onClose}>关闭</button>{canDispatch&&!closed&&session.status!=="进行中"&&<button type="button" onClick={()=>void run("cancel")}>取消场次</button>}{canDispatch&&!closed&&session.status!=="进行中"&&<button className="primary" type="button" onClick={()=>void run("start")}>开始场次</button>}{canDispatch&&session.status==="进行中"&&<button className="primary" type="button" onClick={()=>void run("end")}>结束场次</button>}{canDispatch&&!closed&&<button className="primary" type="submit">保存时间与人数</button>}</div></form></div></div>; }

function CreateModal({scripts,rooms,eligible,onClose,onCreate}:{scripts:ScriptRecord[];rooms:RoomRecord[];eligible:(s:ScriptRecord|undefined,m:"swap"|"fill",target?:Pick<Session,"time"|"end">&{id?:number})=>Array<DmRecord&{score?:number}>;onClose:()=>void;onCreate:(d:{scriptId:string;time:string;players:number;roomId:string})=>void}){ const [scriptId,setScriptId]=useState(scripts[0]?.id||""); const script=scripts.find(x=>x.id===scriptId); const candidates=eligible(script,"swap"); const suitableRooms=rooms.filter(r=>r.status==="空闲"&&!r.needsCleaning&&(!script||r.capacity>=script.standardPlayers)); function submit(form:FormData){onCreate({scriptId,time:String(form.get("time")),players:Number(form.get("players")),roomId:String(form.get("roomId"))});} return <div className="modal-backdrop"><form className="modal large-modal" action={submit}><div className="modal-head"><div><span>快速排班 · 实时资料</span><h2>创建临时场次</h2><p>从自定义剧本、DM 和房间中生成推荐。</p></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label><span>选择剧本</span><select name="scriptId" value={scriptId} onChange={e=>setScriptId(e.target.value)}>{scripts.map(x=><option value={x.id} key={x.id}>{x.name} · {x.category}</option>)}</select></label><label><span>预计开始时间</span><input name="time" type="time" defaultValue="19:00"/></label><label><span>当前玩家人数</span><input name="players" type="number" min="1" max={script?.maxPlayers||20} defaultValue={Math.max(1,(script?.standardPlayers||6)-1)}/></label><label><span>房间</span><select name="roomId"><option value="auto">自动推荐</option>{suitableRooms.map(x=><option value={x.id} key={x.id}>{x.name} · {x.capacity}人</option>)}</select></label></div><div className="recommend"><div><span className="ai-mark">✦</span><div><b>{candidates[0]?`推荐 ${candidates[0].name} 主持 · ${candidates[0].score||80} 分`:"暂无合格空闲 DM"}</b><p>{suitableRooms[0]?`推荐 ${suitableRooms[0].name} · 容量 ${suitableRooms[0].capacity} 人`:"暂无满足容量的空闲房间"} · {script?.allowDmFill?`允许 ${script.maxDmFill} 名 DM 补位`:"不允许 DM 补位"}</p></div></div><strong>{candidates[0]&&suitableRooms[0]?"低风险":"需处理"}</strong></div><div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit" disabled={!script}>采用方案并创建</button></div></form></div>; }

function AssignModal({session,mode,candidates,onClose,onConfirm}:{session:Session;mode:"swap"|"fill";candidates:Array<DmRecord&{score?:number;proficiency?:number}>;onClose:()=>void;onConfirm:(name:string)=>void}){ const [selected,setSelected]=useState(candidates[0]?.name||""); return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span>{session.time} · {session.room}</span><h2>{mode==="swap"?"快速更换主 DM":"安排玩家补位"}</h2><p>《{session.title}》 · 候选人来自当前资料库</p></div><button onClick={onClose}>×</button></div><div className="candidate-list">{candidates.slice(0,4).map((dm,index)=><label className={selected===dm.name?"selected":""} key={dm.id}><input type="radio" checked={selected===dm.name} onChange={()=>setSelected(dm.name)}/><span className="avatar indigo">{dm.name.slice(0,1)}</span><div><div><b>{dm.name}</b>{index===0&&<em>推荐</em>}</div><p>熟练度 {dm.proficiency||3} · {dm.specialties.join("/")} · {dm.availableUntil} 前可用</p></div><strong>{dm.score||75}<small>分</small></strong></label>)}{candidates.length===0&&<div className="empty-candidates"><b>暂无符合硬性条件的 DM</b><span>请先在 DM 状态和剧本管理中补充到店状态与熟练度。</span></div>}</div>{mode==="swap"&&<label className="reason"><span>更换原因</span><select><option>店长临时调整</option><option>临时请假</option><option>身体不适</option><option>时间冲突</option><option>DM 转玩家补位</option></select></label>}<div className="impact"><span>i</span><p><b>连锁影响检查完成</b><br/>{selected?"当前方案没有占用正在主持或补位的 DM。":"需要先补充可用人员。"}</p></div><div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!selected} onClick={()=>onConfirm(selected)}>确认安排</button></div></div></div>; }

function LogsPage({logs,dms}:{logs:string[][];dms:DmRecord[]}){ function exportLogs(){const rows=[["时间","操作人","内容","分类"],...logs];const csv=`\ufeff${rows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(",")).join("\r\n")}`;const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`调度记录-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);} return <section className="content-page"><div className="page-heading"><div><span>今日运营</span><h2>记录与统计</h2><p>基础资料维护和调度操作均可追踪。</p></div><button className="outline" onClick={exportLogs}>导出今日记录</button></div><div className="report-grid"><article><span>在店 DM</span><strong>{dms.filter(x=>x.inStore&&x.enabled).length}</strong><small>{dms.filter(x=>x.status==="空闲"&&x.enabled).length} 人空闲</small></article><article><span>调度操作</span><strong>{logs.length}</strong><small>当前保留记录</small></article><article><span>玩家补位</span><strong>{logs.filter(log=>log[2]?.includes("补位")).length}</strong><small>按操作记录统计</small></article><article><span>DM 交接</span><strong>{logs.filter(log=>log[2]?.includes("主 DM")||log[2]?.includes("交接")).length}</strong><small>按操作记录统计</small></article></div><div className="log-card"><div className="log-head"><h3>调度操作记录</h3><span>最近 {logs.length} 条</span></div>{logs.map((log,i)=><div className="log-row" key={`${log[0]}-${i}`}><time>{log[0]}</time><span className="log-dot"/><div><b>{log[2]}</b><span>{log[1]}</span></div><em>{log[3]}</em></div>)}</div></section>; }
