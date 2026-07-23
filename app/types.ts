export type DmStatus = "未到店" | "空闲" | "准备中" | "主持中" | "玩家补位中" | "休息中" | "暂时不可用" | "已下班";

export type DmRecord = {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  gender: string;
  status: DmStatus;
  inStore: boolean;
  canHost: boolean;
  canFill: boolean;
  styles: string[];
  specialties: string[];
  availableFrom: string;
  availableUntil: string;
  notes: string;
  enabled: boolean;
};

export type ScriptRecord = {
  id: string;
  name: string;
  category: string;
  minPlayers: number;
  standardPlayers: number;
  maxPlayers: number;
  durationMinutes: number;
  prepMinutes: number;
  reviewMinutes: number;
  allowDmFill: boolean;
  maxDmFill: number;
  minProficiency: number;
  requiredGender: string;
  requiredStyle: string;
  roomRequirement: string;
  difficulty: string;
  notes: string;
  enabled: boolean;
};

export type RoomRecord = {
  id: string;
  name: string;
  capacity: number;
  status: "空闲" | "准备中" | "使用中" | "清理中" | "停用";
  supportedTypes: string[];
  needsCleaning: boolean;
  notes: string;
  enabled: boolean;
};

export type SkillRecord = { id: string; dmId: string; scriptId: string; proficiency: number; priority: number; willing: boolean };

export type SessionStatus = "进行中" | "准备中" | "等待到店" | "缺DM" | "缺玩家" | "待确认" | "暂停" | "已结束" | "已取消";

export type SessionRecord = {
  id: number;
  time: string;
  end: string;
  title: string;
  type: string;
  room: string;
  dm: string;
  players: number;
  target: number;
  fillers: string[];
  status: SessionStatus;
  risk?: string;
  progress?: number;
  handoffs?: number;
};

export type StoreRole = "admin" | "manager" | "frontdesk" | "dm";

export type ViewerRecord = {
  uid: string;
  displayName: string;
  role: StoreRole;
  roleLabel: string;
  dmId?: string;
};

export type SharedSnapshot = {
  schemaVersion: number;
  version: number;
  catalog: {
    dms: DmRecord[];
    scripts: ScriptRecord[];
    rooms: RoomRecord[];
    skills: SkillRecord[];
  };
  sessions: SessionRecord[];
  logs: string[][];
};

export type SharedSnapshotResponse = {
  snapshot: SharedSnapshot;
  viewer: ViewerRecord;
  storageMode: "file" | "mysql";
};
