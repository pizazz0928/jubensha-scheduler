const dmRows = [
  ["dm-aheng", "阿衡", "衡哥", "男", "主持中", true, true, true, ["沉浸", "细腻"], ["情感", "还原"], "12:00", "23:30"],
  ["dm-nanzhi", "南枝", "枝枝", "女", "主持中", true, true, false, ["逻辑", "氛围"], ["推理", "恐怖"], "13:00", "24:00"],
  ["dm-xiaoman", "小满", "满满", "女", "玩家补位中", true, true, true, ["活泼", "控场"], ["机制", "阵营"], "14:00", "23:30"],
  ["dm-qiaomu", "乔木", "木木", "男", "空闲", true, true, true, ["欢乐", "互动"], ["欢乐", "情感"], "12:00", "01:00"],
  ["dm-shiqi", "十七", "小七", "女", "空闲", true, true, true, ["恐怖", "演绎"], ["恐怖", "推理"], "16:00", "01:00"],
  ["dm-sansan", "叁叁", "三三", "女", "准备中", true, true, true, ["细腻", "沉浸"], ["还原", "情感"], "12:00", "24:00"],
  ["dm-laobai", "老白", "白哥", "男", "准备中", true, true, false, ["控场", "竞技"], ["机制", "阵营"], "13:00", "01:00"],
  ["dm-beihe", "北河", "河哥", "男", "休息中", true, true, true, ["温柔", "演绎"], ["情感", "欢乐"], "12:00", "23:00"],
  ["dm-bailu", "白露", "露露", "女", "暂时不可用", true, true, true, ["沉浸", "氛围"], ["情感", "恐怖"], "15:00", "24:00"],
  ["dm-linmo", "林墨", "墨墨", "男", "空闲", true, true, true, ["逻辑", "稳健"], ["推理", "还原"], "17:00", "02:00"],
  ["dm-tangyuan", "糖圆", "圆圆", "女", "未到店", false, true, true, ["活泼", "欢乐"], ["欢乐", "机制"], "18:00", "02:00"],
  ["dm-zhouzhou", "舟舟", "小舟", "男", "空闲", true, true, true, ["演绎", "氛围"], ["恐怖", "阵营"], "15:00", "01:30"],
];

const scriptRows = [
  ["script-nianlun", "年轮", "情感", 6, 6, 6, 270, true, 1, 3, "不限", "沉浸", "安静房", "中等"],
  ["script-lichuan", "漓川怪谈簿", "推理", 7, 7, 7, 240, false, 0, 4, "不限", "逻辑", "普通房", "困难"],
  ["script-qinglou", "青楼", "情感", 6, 6, 6, 270, true, 1, 4, "不限", "细腻", "安静房", "中等"],
  ["script-suspect7", "第七号嫌疑人", "还原", 5, 6, 6, 240, true, 1, 3, "不限", "稳健", "普通房", "中等"],
  ["script-binglin", "兵临城下", "机制", 6, 7, 8, 270, true, 2, 4, "不限", "控场", "大房", "困难"],
  ["script-nihao", "你好", "欢乐", 5, 6, 7, 240, true, 1, 2, "不限", "欢乐", "普通房", "简单"],
  ["script-chaiqian", "拆迁", "阵营", 7, 8, 9, 270, true, 1, 4, "不限", "竞技", "大房", "困难"],
  ["script-eyuan", "恶渊百物语", "恐怖", 5, 6, 7, 240, true, 1, 4, "不限", "恐怖", "恐怖房", "困难"],
  ["script-gucheng", "孤城", "还原", 5, 6, 6, 240, true, 1, 3, "不限", "演绎", "普通房", "中等"],
  ["script-zhuiyue", "追月", "情感", 6, 6, 6, 270, true, 1, 4, "女", "细腻", "安静房", "困难"],
  ["script-lieren", "猎人笔记", "推理", 5, 6, 7, 210, false, 0, 3, "不限", "逻辑", "普通房", "中等"],
  ["script-liri", "离日", "机制", 6, 7, 8, 300, true, 1, 4, "不限", "控场", "大房", "困难"],
  ["script-huanxi", "欢喜镇", "欢乐", 5, 6, 8, 210, true, 2, 2, "不限", "欢乐", "普通房", "简单"],
  ["script-jingzhe", "惊蛰", "恐怖", 5, 6, 6, 240, true, 1, 3, "不限", "氛围", "恐怖房", "中等"],
  ["script-tianming", "天命", "阵营", 7, 8, 10, 300, true, 2, 4, "男", "控场", "大房", "困难"],
];

const roomRows = [
  ["room-yunjian", "云间", 8, "使用中", ["情感", "还原", "欢乐"], false, "隔音好，适合沉浸本"],
  ["room-wuyin", "雾隐", 8, "使用中", ["推理", "恐怖", "还原"], false, "带可调光和音响"],
  ["room-changjie", "长街", 7, "空闲", ["情感", "欢乐"], false, "长桌布局"],
  ["room-jiuxiang", "旧巷", 6, "准备中", ["推理", "还原", "恐怖"], false, "沉浸式布景"],
  ["room-chibi", "赤壁", 10, "准备中", ["机制", "阵营"], false, "最大机制房"],
  ["room-tingyu", "听雨", 6, "空闲", ["情感", "欢乐", "还原"], false, "小型安静房"],
];

const skillRows = [
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
];

const sessions = [
  { id: 1, time: "14:00", end: "18:30", title: "年轮", type: "情感 · 6人", room: "云间", dm: "阿衡", players: 6, target: 6, fillers: [], status: "进行中", progress: 58 },
  { id: 2, time: "15:30", end: "19:30", title: "漓川怪谈簿", type: "推理 · 7人", room: "雾隐", dm: "南枝", players: 7, target: 7, fillers: [], status: "进行中", progress: 36, handoffs: 3 },
  { id: 3, time: "18:00", end: "22:30", title: "青楼", type: "情感 · 6人", room: "长街", dm: "待安排", players: 6, target: 6, fillers: [], status: "缺DM", risk: "距开场较近，仅少量 DM 符合资格" },
  { id: 4, time: "18:30", end: "23:00", title: "第七号嫌疑人", type: "还原 · 6人", room: "旧巷", dm: "叁叁", players: 5, target: 6, fillers: [], status: "缺玩家", risk: "缺 1 名玩家，可安排 DM 补位" },
  { id: 5, time: "19:00", end: "23:30", title: "兵临城下", type: "机制 · 7人", room: "赤壁", dm: "老白", players: 6, target: 7, fillers: ["小满"], status: "准备中", risk: "补位 DM 小满可能超出下班时间" },
  { id: 6, time: "19:30", end: "23:30", title: "你好", type: "欢乐 · 6人", room: "云间", dm: "乔木", players: 4, target: 6, fillers: [], status: "等待到店", risk: "2 名客人尚未到店" },
  { id: 7, time: "20:00", end: "00:30", title: "拆迁", type: "阵营 · 8人", room: "雾隐", dm: "待安排", players: 7, target: 8, fillers: [], status: "缺DM", risk: "与其他场次存在房间冲突" },
  { id: 8, time: "21:00", end: "01:00", title: "恶渊百物语", type: "恐怖 · 6人", room: "长街", dm: "十七", players: 6, target: 6, fillers: [], status: "待确认" },
];

export function createSeedState() {
  const dms = dmRows.map((row) => ({
    id: row[0], name: row[1], nickname: row[2], phone: "", gender: row[3], status: row[4],
    inStore: row[5], canHost: row[6], canFill: row[7], styles: row[8], specialties: row[9],
    availableFrom: row[10], availableUntil: row[11], notes: "", enabled: true,
  }));
  const scripts = scriptRows.map((row) => ({
    id: row[0], name: row[1], category: row[2], minPlayers: row[3], standardPlayers: row[4],
    maxPlayers: row[5], durationMinutes: row[6], prepMinutes: 30, reviewMinutes: 30,
    allowDmFill: row[7], maxDmFill: row[8], minProficiency: row[9], requiredGender: row[10],
    requiredStyle: row[11], roomRequirement: row[12], difficulty: row[13], notes: "", enabled: true,
  }));
  const rooms = roomRows.map((row) => ({
    id: row[0], name: row[1], capacity: row[2], status: row[3], supportedTypes: row[4],
    needsCleaning: row[5], notes: row[6], enabled: true,
  }));
  const skills = skillRows.map((row, index) => ({
    id: `skill-${index}`, dmId: row[0], scriptId: row[1], proficiency: row[2], priority: 0, willing: true,
  }));
  return {
    schemaVersion: 1,
    version: 1,
    catalog: { dms, scripts, rooms, skills },
    sessions,
    logs: [
      ["17:06", "店长 · 林野", "将 小满 安排为《兵临城下》玩家补位", "人工调整"],
      ["16:52", "前台 · 阿梨", "《青楼》开始时间调整为 18:00", "时间变更"],
      ["16:31", "店长 · 林野", "《漓川怪谈簿》主 DM 由 白露 更换为 南枝", "第 3 次交接"],
      ["16:18", "系统", "发现《拆迁》与房间雾隐存在时间冲突", "严重风险"],
    ],
  };
}
