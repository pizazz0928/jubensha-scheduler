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
