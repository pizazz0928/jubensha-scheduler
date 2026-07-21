import assert from "node:assert/strict";
import test from "node:test";

const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const canHost = (dm, session, assignments = []) => {
  if (!dm.inStore || !["空闲", "准备中"].includes(dm.status)) return false;
  if (!dm.scripts.includes(session.script)) return false;
  return !assignments.some(item => item.dm === dm.name && overlaps(item, session));
};
const canFill = (dm, script, session, assignments = []) =>
  script.allowFill && session.players < script.maxPlayers && dm.canFill && canHost({ ...dm, scripts: [session.script] }, session, assignments);

test("同一 DM 不能同时主持两个场次", () => {
  const dm = { name: "乔木", inStore: true, status: "空闲", scripts: ["年轮"] };
  assert.equal(canHost(dm, { script: "年轮", start: 19, end: 23 }, [{ dm: "乔木", start: 18, end: 20 }]), false);
});

test("补位中的 DM 不能被安排主持", () => {
  const dm = { name: "小满", inStore: true, status: "补位中", scripts: ["兵临城下"] };
  assert.equal(canHost(dm, { script: "兵临城下", start: 19, end: 23 }, []), false);
});

test("不会该剧本的 DM 不进入推荐", () => {
  const dm = { name: "北河", inStore: true, status: "空闲", scripts: ["青楼"] };
  assert.equal(canHost(dm, { script: "恶渊百物语", start: 20, end: 24 }, []), false);
});

test("房间重叠可以被检测", () => {
  assert.equal(overlaps({ start: 19.5, end: 23.5 }, { start: 23, end: 25 }), true);
  assert.equal(overlaps({ start: 18, end: 20 }, { start: 20, end: 24 }), false);
});

test("剧本禁止补位时不能安排 DM 玩家", () => {
  const dm = { name: "十七", inStore: true, status: "空闲", canFill: true };
  assert.equal(canFill(dm, { allowFill: false, maxPlayers: 6 }, { script: "恶渊", players: 5, start: 20, end: 24 }, []), false);
});

test("人数达到上限后不能继续补位", () => {
  const dm = { name: "十七", inStore: true, status: "空闲", canFill: true };
  assert.equal(canFill(dm, { allowFill: true, maxPlayers: 6 }, { script: "恶渊", players: 6, start: 20, end: 24 }, []), false);
});

const recommendCatalog = ({ dms, skills, script, rooms }) => ({
  dms: dms.filter(dm => dm.enabled && dm.inStore && dm.status === "空闲" && dm.canHost)
    .filter(dm => (skills.find(skill => skill.dmId === dm.id && skill.scriptId === script.id)?.proficiency ?? 0) >= script.minProficiency),
  rooms: rooms.filter(room => room.enabled && room.status === "空闲" && !room.needsCleaning && room.capacity >= script.standardPlayers && room.supportedTypes.includes(script.category)),
});

test("自定义 DM 只有达到剧本最低熟练度才进入推荐", () => {
  const result = recommendCatalog({
    dms: [{ id: "a", enabled: true, inStore: true, status: "空闲", canHost: true }, { id: "b", enabled: true, inStore: true, status: "空闲", canHost: true }],
    skills: [{ dmId: "a", scriptId: "s", proficiency: 2 }, { dmId: "b", scriptId: "s", proficiency: 4 }],
    script: { id: "s", minProficiency: 3, standardPlayers: 6, category: "推理" },
    rooms: [],
  });
  assert.deepEqual(result.dms.map(dm => dm.id), ["b"]);
});

test("待清理房间不会进入临时开本推荐", () => {
  const result = recommendCatalog({ dms: [], skills: [], script: { id: "s", minProficiency: 3, standardPlayers: 6, category: "恐怖" }, rooms: [
    { id: "dirty", enabled: true, status: "空闲", needsCleaning: true, capacity: 8, supportedTypes: ["恐怖"] },
    { id: "ready", enabled: true, status: "空闲", needsCleaning: false, capacity: 8, supportedTypes: ["恐怖"] },
  ]});
  assert.deepEqual(result.rooms.map(room => room.id), ["ready"]);
});

test("容量不足或类型不匹配的房间不会被推荐", () => {
  const result = recommendCatalog({ dms: [], skills: [], script: { id: "s", minProficiency: 3, standardPlayers: 8, category: "机制" }, rooms: [
    { id: "small", enabled: true, status: "空闲", needsCleaning: false, capacity: 6, supportedTypes: ["机制"] },
    { id: "wrong", enabled: true, status: "空闲", needsCleaning: false, capacity: 10, supportedTypes: ["情感"] },
    { id: "match", enabled: true, status: "空闲", needsCleaning: false, capacity: 10, supportedTypes: ["机制"] },
  ]});
  assert.deepEqual(result.rooms.map(room => room.id), ["match"]);
});
