// 存档读写。存档带版本号，旧版本的存档读进来时转换成现在的格式。

import { BUYERS } from './content/shop';
import { TECH } from './content';
import { fresh, type GameState } from './state';
import { OLD_END_LINES } from './text';

export const SAVE_KEY = 'inherit-farm-v1';
/** 原型时期的存档键，读不到新存档时从这里接着玩 */
export const LEGACY_KEYS = ['inherit-farm-proto-v1'];
/**
 * 1：单页版（阶段 1 到 6），状态是平铺的 fruit、trees、tools……
 * 2：分页版，资源在 res 里，建筑在 b 里
 */
export const SAVE_VERSION = 2;

interface SaveFile {
  v: number;
  s: unknown;
}

/** 能读写字符串的存储，浏览器里是 localStorage，测试里可以换成别的 */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function serialize(s: GameState): string {
  const file: SaveFile = { v: SAVE_VERSION, s };
  return JSON.stringify(file);
}

/** 解析存档字符串。原型时期的存档没有外层，直接就是状态对象。读不出来返回 null。 */
export function deserialize(raw: string): GameState | null {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!isObject(data)) return null;
  const wrapped = typeof data.v === 'number' && isObject(data.s);
  const v = wrapped ? data.v as number : 1;
  let body = (wrapped ? data.s : data) as Record<string, unknown>;
  if (v < 2) body = fromV1(body);
  return normalize(body);
}

/** 单页版的存档：资源、建筑、货架都是平铺的数字 */
function fromV1(d: Record<string, unknown>): Record<string, unknown> {
  const n = (k: string) => num(d[k]);
  const f = isObject(d.f) ? d.f : {};
  return {
    res: { fruit: n('fruit'), wood: n('wood'), money: n('money'), jam: n('jam') },
    b: { tree: n('trees'), timber: n('timber'), jamShop: n('shops') },
    level: n('level'),
    // 单页版的五金店和科技工具在新版里是同一个货架
    shelves: { hardware: n('tools') + n('tech'), prod: n('prod'), lux: n('lux') },
    techs: f.jam === true ? ['jam'] : [],
    dem: d.dem,
    f: { cap: f.cap === true, sold: f.sold === true, cooked: f.cooked === true, jamFull: f.jamFull === true, end: f.end === true },
    log: d.log,
    played: d.played,
    last: d.last
  };
}

/** 把任意对象整理成合法的状态：缺的字段补默认值，类型不对的换成默认值 */
export function normalize(d: Record<string, unknown>): GameState {
  const base = fresh();
  const out: GameState = {
    ...base,
    res: numbers(base.res, d.res),
    b: numbers(base.b, d.b),
    jobs: numbers(base.jobs, d.jobs),
    shelves: numbers(base.shelves, d.shelves),
    timer: numbers(base.timer, d.timer),
    workers: num(d.workers),
    level: num(d.level),
    played: num(d.played),
    last: num(d.last, base.last)
  };
  const f = isObject(d.f) ? d.f : {};
  for (const k of Object.keys(base.f) as (keyof GameState['f'])[]) out.f[k] = f[k] === true;
  const cal = isObject(d.cal) ? d.cal : {};
  out.cal = { on: cal.on === true, t: num(cal.t), weather: Number.isInteger(cal.weather) ? cal.weather as number : 0, rng: num(cal.rng, base.cal.rng) };
  out.techs = Array.isArray(d.techs) ? d.techs.filter((t): t is string => typeof t === 'string' && TECH.has(t)) : [];
  const dem = Array.isArray(d.dem) ? d.dem : [];
  out.dem = BUYERS.map((_, i) => num(dem[i]));
  out.seen = Array.isArray(d.seen) ? [...new Set([...base.seen, ...d.seen.map(String)])] : base.seen;
  out.log = Array.isArray(d.log) ? d.log.map(String) : base.log;
  if (!out.f.end) out.log = out.log.filter(line => !OLD_END_LINES.some(p => line.startsWith(p)));
  // 帮工数不能少于已经派活的人数
  const busy = Object.values(out.jobs).reduce((a, b) => a + b, 0);
  out.workers = Math.max(out.workers, busy);
  return out;
}

export function load(store: Store): GameState | null {
  try {
    for (const key of [SAVE_KEY, ...LEGACY_KEYS]) {
      const raw = store.getItem(key);
      if (raw) return deserialize(raw);
    }
  } catch { /* 存储不可用时当作没有存档 */ }
  return null;
}

export function save(store: Store, s: GameState): void {
  try { store.setItem(SAVE_KEY, serialize(s)); } catch { /* 存不了就算了，下次再存 */ }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown, fallback = 0): number {
  const v = Number(x);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** 以 base 的键为准，从 x 里取数字，取不到的用 base 的值 */
function numbers<T extends Record<string, number>>(base: T, x: unknown): T {
  const src = isObject(x) ? x : {};
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof T & string)[]) {
    (out as Record<string, number>)[k] = num(src[k], base[k]);
  }
  return out;
}
