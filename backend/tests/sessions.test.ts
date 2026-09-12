import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app";

/**
 * 组局广场业务不变量自动化测试。
 * 单独执行：cd backend && npm test
 * 断言失败信息均以「业务不变量被破坏」开头，直接指出被破坏的规则。
 */

interface SessionView {
  id: string;
  title: string;
  startTime: string;
  maxPlayers: number;
  participants: string[];
  waitlist: string[];
  participantCount: number;
  waitlistCount: number;
  status: "open" | "full";
}

interface ApiResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

let server: Server;
let baseUrl = "";

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function invariant(condition: unknown, description: string): asserts condition {
  assert.ok(condition, `业务不变量被破坏：${description}`);
}

async function api(method: string, path: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const futureTime = (hoursAhead = 2) => new Date(Date.now() + hoursAhead * 3_600_000).toISOString();

function nextLeapYear(fromYear: number): number {
  for (let year = fromYear + 1; ; year += 1) {
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      return year;
    }
  }
}

let titleSeq = 0;
function makePayload(overrides: Record<string, unknown> = {}) {
  titleSeq += 1;
  return {
    title: `自动化测试局-${titleSeq}`,
    gameName: "阿瓦隆",
    startTime: futureTime(),
    maxPlayers: 3,
    creator: "测试员",
    ...overrides,
  };
}

async function mustCreate(overrides: Record<string, unknown> = {}): Promise<SessionView> {
  const { status, body } = await api("POST", "/sessions", makePayload(overrides));
  assert.equal(status, 201, `测试前置创建失败：${JSON.stringify(body)}`);
  return body.session as SessionView;
}

async function mustJoin(id: string, player: string): Promise<ApiResult> {
  const result = await api("POST", `/sessions/${id}/join`, { player });
  assert.equal(result.status, 200, `测试前置报名失败：${JSON.stringify(result.body)}`);
  return result;
}

async function findSession(id: string): Promise<SessionView> {
  const { body } = await api("GET", "/sessions");
  const session = (body.sessions as SessionView[]).find((item) => item.id === id);
  assert.ok(session, `测试前置读取失败：列表中找不到组局 ${id}`);
  return session;
}

test("创建：新建组局名单为空、状态招募中、开局时间与输入一致", async () => {
  const payload = makePayload({ maxPlayers: 4 });
  const { status, body } = await api("POST", "/sessions", payload);
  invariant(status === 201, `合法创建必须返回 201，实际 ${status}：${JSON.stringify(body)}`);
  const session = body.session as SessionView;
  invariant(
    session.participants.length === 0 && session.waitlist.length === 0,
    "新建组局的正式名单与候补队列必须为空",
  );
  invariant(
    session.status === "open" && session.participantCount === 0 && session.waitlistCount === 0,
    "新建组局状态必须为招募中且人数计数为 0",
  );
  invariant(
    session.startTime === payload.startTime,
    `开局时间必须与输入完全一致，输入 ${payload.startTime}，实际 ${session.startTime}`,
  );
});

test("列表：已创建组局可见，计数字段与名单一致", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  await mustJoin(session.id, "列表玩家甲");
  await mustJoin(session.id, "列表玩家乙");
  await mustJoin(session.id, "列表玩家丙"); // 进入候补

  const { status, body } = await api("GET", "/sessions");
  invariant(status === 200, `列表接口必须返回 200，实际 ${status}`);
  const found = (body.sessions as SessionView[]).find((item) => item.id === session.id);
  invariant(found, "已创建的组局必须出现在列表中");
  invariant(
    found.participantCount === found.participants.length &&
      found.waitlistCount === found.waitlist.length,
    "列表中的人数计数必须与对应名单长度一致",
  );
  invariant(
    found.participantCount === 2 && found.waitlistCount === 1 && found.status === "full",
    `列表必须反映最新人数与状态，实际 正式 ${found.participantCount}/2、候补 ${found.waitlistCount}、状态 ${found.status}`,
  );
});

test("报名：有空位时进入正式名单", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  const { body } = await mustJoin(session.id, "普通玩家");
  invariant(body.placement === "confirmed", `有空位时报名必须进入正式名单，实际 ${body.placement}`);
  invariant(
    body.session.participants.includes("普通玩家") && body.session.participantCount === 1,
    "报名成功后玩家必须出现在正式名单且计数为 1",
  );
});

test("取消：正式与候补成员均可取消，未报名者取消返回 404", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  await mustJoin(session.id, "正式成员一");
  await mustJoin(session.id, "正式成员二");
  await mustJoin(session.id, "候补成员");

  const leaveWaitlisted = await api("POST", `/sessions/${session.id}/leave`, { player: "候补成员" });
  invariant(leaveWaitlisted.status === 200, "候补成员取消必须成功");
  invariant(
    leaveWaitlisted.body.removed === "waitlisted" && leaveWaitlisted.body.session.waitlist.length === 0,
    "候补成员取消后必须移出候补队列",
  );
  invariant(
    leaveWaitlisted.body.session.participants.join(",") === "正式成员一,正式成员二",
    "候补成员取消不得影响正式名单",
  );

  const leaveConfirmed = await api("POST", `/sessions/${session.id}/leave`, { player: "正式成员一" });
  invariant(
    leaveConfirmed.body.removed === "confirmed" &&
      leaveConfirmed.body.session.participants.join() === "正式成员二",
    "正式成员取消后必须移出正式名单",
  );
  invariant(leaveConfirmed.body.session.status === "open", "取消出空位且无候补上，状态必须回到招募中");

  const leaveStranger = await api("POST", `/sessions/${session.id}/leave`, { player: "路人甲" });
  invariant(leaveStranger.status === 404, `未报名者取消必须返回 404，实际 ${leaveStranger.status}`);
});

test("重复报名：同一玩家在正式或候补队列中都只能出现一次", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  await mustJoin(session.id, "唯一玩家");
  const dupConfirmed = await api("POST", `/sessions/${session.id}/join`, { player: "唯一玩家" });
  invariant(dupConfirmed.status === 409, `正式名单玩家重复报名必须返回 409，实际 ${dupConfirmed.status}`);

  await mustJoin(session.id, "占位玩家");
  await mustJoin(session.id, "候补玩家");
  const dupWaitlisted = await api("POST", `/sessions/${session.id}/join`, { player: "候补玩家" });
  invariant(dupWaitlisted.status === 409, `候补玩家重复报名必须返回 409，实际 ${dupWaitlisted.status}`);

  const final = await findSession(session.id);
  const all = [...final.participants, ...final.waitlist];
  invariant(
    new Set(all.map((name) => name.toLowerCase())).size === all.length,
    "同一玩家不得同时出现在正式名单和候补名单",
  );
});

test("满员候补：超过人数上限的报名按顺序进入候补队列", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  await mustJoin(session.id, "先手一");
  await mustJoin(session.id, "先手二");
  const third = await mustJoin(session.id, "后来者三");
  invariant(third.body.placement === "waitlisted", `满员后报名必须进入候补，实际 ${third.body.placement}`);
  const fourth = await mustJoin(session.id, "后来者四");
  const final = await findSession(session.id);
  invariant(final.status === "full" && final.participantCount === 2, "满员后状态必须为已满员且正式人数等于上限");
  invariant(
    final.waitlist.join(",") === "后来者三,后来者四",
    `候补队列必须按报名先后排序，实际 ${final.waitlist.join(",")}`,
  );
  invariant(fourth.body.session.waitlistCount === 2, "候补人数计数必须随报名即时更新");
});

test("补位：正式成员取消后严格按候补先后顺序自动补位", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  for (const player of ["甲", "乙", "丙", "丁"]) {
    await mustJoin(session.id, player);
  }
  const first = await api("POST", `/sessions/${session.id}/leave`, { player: "甲" });
  invariant(first.body.promoted === "丙", `补位必须取候补第一人「丙」，实际补位 ${first.body.promoted}`);
  invariant(
    first.body.session.participants.join(",") === "乙,丙",
    `补位后正式名单必须为「乙,丙」，实际 ${first.body.session.participants.join(",")}`,
  );
  invariant(
    first.body.session.waitlist.join() === "丁",
    "补位后剩余候补必须保持原有顺序",
  );

  const second = await api("POST", `/sessions/${session.id}/leave`, { player: "乙" });
  invariant(second.body.promoted === "丁", `再次补位必须取新的候补第一人「丁」，实际 ${second.body.promoted}`);
  invariant(second.body.session.status === "full", "补位成功后状态必须保持已满员");
});

test("大小写：同一玩家不同大小写只能占一个位置", async () => {
  const session = await mustCreate({ maxPlayers: 2 });
  await mustJoin(session.id, "Alice");
  for (const alias of ["alice", "ALICE", "aLiCe"]) {
    const dup = await api("POST", `/sessions/${session.id}/join`, { player: alias });
    invariant(dup.status === 409, `已报名玩家换大小写「${alias}」再报名必须返回 409，实际 ${dup.status}`);
  }

  await mustJoin(session.id, "Bob");
  await mustJoin(session.id, "Carol"); // 候补
  const dupWaitlist = await api("POST", `/sessions/${session.id}/join`, { player: "carol" });
  invariant(dupWaitlist.status === 409, "候补玩家换大小写重复报名同样必须返回 409");

  const leave = await api("POST", `/sessions/${session.id}/leave`, { player: "ALICE" });
  invariant(leave.status === 200 && leave.body.removed === "confirmed", "换大小写取消必须匹配到本人");
  invariant(leave.body.promoted === "Carol", "换大小写取消后候补必须照常补位");

  const final = await findSession(session.id);
  const all = [...final.participants, ...final.waitlist];
  invariant(
    new Set(all.map((name) => name.toLowerCase())).size === all.length,
    "正式名单与候补队列中不得出现大小写变体重复",
  );
});

test("非法日期：不存在的日期、任意文字、过去时间一律 400 且不写入列表", async () => {
  const before = (await api("GET", "/sessions")).body.sessions.length as number;
  const leapYear = nextLeapYear(new Date().getFullYear());
  const invalidCases: Array<[string, string]> = [
    [`${leapYear + 1}-02-29 10:00`, "平年2月29日"],
    [`${leapYear + 1}-02-30 10:00`, "2月30日"],
    [`${leapYear}-04-31 10:00`, "小月31日"],
    ["随便什么时候", "任意文字"],
    [new Date(Date.now() - 3_600_000).toISOString(), "过去时间"],
  ];
  for (const [startTime, label] of invalidCases) {
    const { status } = await api("POST", "/sessions", makePayload({ startTime }));
    invariant(status === 400, `${label}必须被拒绝（400），实际 ${status}（输入 ${startTime}）`);
  }
  const after = (await api("GET", "/sessions")).body.sessions.length as number;
  invariant(after === before, `非法开局时间不得写入列表：拒绝前 ${before} 条，拒绝后 ${after} 条`);

  const leapDay = await api("POST", "/sessions", makePayload({ startTime: `${leapYear}-02-29 20:00` }));
  invariant(leapDay.status === 201, `闰年2月29日（${leapYear}，未来）必须可正常创建，实际 ${leapDay.status}`);
  invariant(
    leapDay.body.session.startTime === `${leapYear}-02-29 20:00`,
    "合法日期的年月日必须与输入完全一致，不得被推后或改写",
  );
});

test("日期时间完整性：只填日期或缺少时分一律拒绝，空格与 T 分隔均可", async () => {
  const before = (await api("GET", "/sessions")).body.sessions.length as number;
  const future = new Date(Date.now() + 48 * 3_600_000);
  const pad = (num: number) => String(num).padStart(2, "0");
  const datePart = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
  const timePart = `${pad(future.getHours())}:${pad(future.getMinutes())}`;

  const incomplete: Array<[string, string]> = [
    [datePart, "只填日期"],
    [`${datePart}T`, "只有分隔符没有时分"],
    [`${datePart} ${pad(future.getHours())}`, "缺少分钟"],
  ];
  for (const [startTime, label] of incomplete) {
    const { status } = await api("POST", "/sessions", makePayload({ startTime }));
    invariant(status === 400, `${label}必须被拒绝（400），实际 ${status}（输入 ${startTime}）`);
  }

  for (const [startTime, label] of [
    [`${datePart} ${timePart}`, "空格分隔"],
    [`${datePart}T${timePart}`, "字母 T 分隔"],
  ] as Array<[string, string]>) {
    const { status, body } = await api("POST", "/sessions", makePayload({ startTime }));
    invariant(status === 201, `${label}的完整日期时间必须可创建，实际 ${status}：${JSON.stringify(body)}`);
  }

  const after = (await api("GET", "/sessions")).body.sessions.length as number;
  invariant(after === before + 2, `不完整时间不得写入列表：之前 ${before} 条，之后应只多 2 条，实际 ${after} 条`);
});

test("并发报名：正式名单绝不超过上限，玩家不丢失不重复", async () => {
  const maxPlayers = 3;
  const session = await mustCreate({ maxPlayers });
  const players = Array.from({ length: 8 }, (_, index) => `并发玩家${index + 1}`);
  const results = await Promise.all(
    players.map((player) => api("POST", `/sessions/${session.id}/join`, { player })),
  );

  const confirmed = results.filter((result) => result.body.placement === "confirmed");
  const waitlisted = results.filter((result) => result.body.placement === "waitlisted");
  invariant(
    confirmed.length === maxPlayers,
    `并发报名确认人数必须等于人数上限 ${maxPlayers}，实际 ${confirmed.length}`,
  );
  invariant(
    waitlisted.length === players.length - maxPlayers,
    `超出上限的并发报名必须全部进入候补，实际候补 ${waitlisted.length}，应为 ${players.length - maxPlayers}`,
  );

  const final = await findSession(session.id);
  invariant(
    final.participants.length === maxPlayers,
    `并发结束后正式名单人数不得超过上限 ${maxPlayers}，实际 ${final.participants.length}`,
  );
  const all = [...final.participants, ...final.waitlist];
  invariant(
    new Set(all.map((name) => name.toLowerCase())).size === players.length,
    "并发报名下同一玩家不得重复占位",
  );
  invariant(
    players.every((player) => all.includes(player)),
    "并发报名下任何玩家都不得丢失",
  );
});
