import { describe, expect, it } from 'vitest';
import { BUYERS } from '../src/game/config';
import { LEGACY_KEYS, SAVE_KEY, deserialize, load, save, serialize, type Store } from '../src/game/save';
import { fresh } from '../src/game/state';
import { T } from '../src/game/text';

function memory(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; }
  };
}

describe('存档', () => {
  it('存了再读回来一样', () => {
    const s = fresh(123);
    s.fruit = 42; s.trees = 3; s.f.tree = true; s.dem = [0, 1, 2, 3];
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('读原型时期的存档：没有外层、多出的字段丢掉、缺的补上', () => {
    const old = {
      fruit: 500, wood: 20, money: 0, trees: 17, timber: 0, level: 1, tools: 0, tech: 0, lux: 0, prod: 0,
      dem: [0, 0], f: { tree: true, cap: true, done: false },
      log: ['（原型的内容到这里。）', '仓库满了'], played: 80, last: 1000
    };
    const store = memory({ [LEGACY_KEYS[0]]: JSON.stringify(old) });
    const s = load(store)!;
    expect(s.fruit).toBe(500);
    expect(s.level).toBe(1);
    expect(s.f).toEqual({ tree: true, cap: true, sell: false, sold: false, end: false });
    expect(s.dem).toHaveLength(BUYERS.length);
    expect(s.log).toEqual(['仓库满了']);
  });

  it('新存档优先于旧存档，保存只写新键', () => {
    const a = fresh(0); a.fruit = 1;
    const b = fresh(0); b.fruit = 2;
    const store = memory({ [LEGACY_KEYS[0]]: JSON.stringify(a), [SAVE_KEY]: serialize(b) });
    expect(load(store)!.fruit).toBe(2);
    b.fruit = 3;
    save(store, b);
    expect(JSON.parse(store.data[SAVE_KEY]).s.fruit).toBe(3);
    expect(JSON.parse(store.data[LEGACY_KEYS[0]]).fruit).toBe(1);
  });

  it('坏数据不会弄坏游戏', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('[1,2]')).toBeNull();
    const s = deserialize(JSON.stringify({ v: 1, s: { fruit: 'abc', money: -5, trees: Infinity, log: 'x' } }))!;
    expect(s.fruit).toBe(0);
    expect(s.money).toBe(0);
    expect(s.trees).toBe(0);
    expect(s.log).toEqual([T.start]);
  });

  it('存储不可用时当作没有存档', () => {
    const broken: Store = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); }
    };
    expect(load(broken)).toBeNull();
    expect(() => save(broken, fresh())).not.toThrow();
  });

  it('到了结尾的存档保留结尾句', () => {
    const s = fresh(0); s.f.end = true; s.log = [T.end];
    expect(deserialize(serialize(s))!.log).toEqual([T.end]);
  });
});
