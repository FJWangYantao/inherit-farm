// 存档读写。存档带版本号，旧版本的存档读进来时补上缺的字段。

import { BUYERS } from './config';
import { fresh, type GameState } from './state';
import { OLD_END_LINES } from './text';

export const SAVE_KEY = 'inherit-farm-v1';
/** 原型时期的存档键，读不到新存档时从这里接着玩 */
export const LEGACY_KEYS = ['inherit-farm-proto-v1'];
export const SAVE_VERSION = 1;

interface SaveFile {
  v: number;
  s: GameState;
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
  const body = typeof data.v === 'number' && isObject(data.s) ? data.s : data;
  return normalize(body);
}

/** 把任意对象整理成合法的状态：缺的字段补默认值，类型不对的换成默认值 */
export function normalize(d: Record<string, unknown>): GameState {
  const base = fresh();
  const out = { ...base } as GameState;
  // 数字字段按 fresh() 里的来，新加的数字字段不用改这里
  for (const k of Object.keys(base) as (keyof GameState)[]) {
    if (typeof base[k] !== 'number') continue;
    const v = Number(d[k]);
    (out[k] as number) = Number.isFinite(v) && v >= 0 ? v : (base[k] as number);
  }
  const f = isObject(d.f) ? d.f : {};
  out.f = { ...base.f };
  for (const k of Object.keys(base.f) as (keyof GameState['f'])[]) out.f[k] = f[k] === true;
  const dem = Array.isArray(d.dem) ? d.dem : [];
  out.dem = BUYERS.map((_, i) => Number(dem[i]) || 0);
  out.log = Array.isArray(d.log) ? d.log.map(String) : base.log;
  if (!out.f.end) out.log = out.log.filter(line => !OLD_END_LINES.some(p => line.startsWith(p)));
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
