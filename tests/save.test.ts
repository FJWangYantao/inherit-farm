import { describe, expect, it } from 'vitest';
import { BUYERS } from '../src/game/content/shop';
import { Game } from '../src/game/game';
import { LEGACY_KEYS, SAVE_KEY, SAVE_VERSION, deserialize, load, save, serialize, type Store } from '../src/game/save';
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
    s.res.fruit = 42; s.b.tree = 3; s.workers = 4; s.jobs.farmer = 2; s.techs = ['grafting'];
    s.seen.push('b:tree'); s.cal = { on: true, t: 777, weather: -1, rng: 99 }; s.dem = BUYERS.map((_, i) => i);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(JSON.parse(serialize(s)).v).toBe(SAVE_VERSION);
  });

  it('读单页版（v1）的存档：平铺的字段搬进新结构，五金店和科技工具并成一个货架', () => {
    const v1 = {
      v: 1, s: {
        fruit: 300, wood: 2000, money: 5000, trees: 45, timber: 6, jam: 12, shops: 2, level: 3,
        tools: 4, tech: 2, lux: 3, prod: 2, dem: [0, 100, 200, 300],
        f: { tree: true, cap: true, sell: true, sold: true, jam: true, cooked: true, jamFull: false, end: false },
        log: ['在镇上买了房。'], played: 900, last: 1000
      }
    };
    const s = deserialize(JSON.stringify(v1))!;
    expect(s.res).toMatchObject({ fruit: 300, wood: 2000, money: 5000, jam: 12 });
    expect(s.b).toMatchObject({ tree: 45, timber: 6, jamShop: 2 });
    expect(s.shelves).toMatchObject({ hardware: 6, prod: 2, lux: 3 });
    expect(s.techs).toEqual(['jam']);
    expect(s.made).toEqual(['jam']);
    expect(s.dem.slice(0, 4)).toEqual([0, 100, 200, 300]);
    expect(s.dem).toHaveLength(BUYERS.length);
    expect(s.f).toMatchObject({ cap: true, sold: true, cooked: true });
    // 读进来以后，按当前状态该出现的东西都会出现
    const g = new Game(s);
    g.check();
    expect(g.isSeen('act:sell') && g.isSeen('b:timber') && g.isSeen('tab:market') && g.isSeen('b:jamShop')).toBe(true);
    expect(g.owns('trike')).toBe(true);
  });

  it('读原型时期的存档：没有外层，去掉原型的结尾句', () => {
    const old = { fruit: 500, wood: 20, trees: 17, level: 1, f: { tree: true, cap: true }, log: ['（原型的内容到这里。）', '仓库满了'], last: 1000 };
    const s = load(memory({ [LEGACY_KEYS[0]]: JSON.stringify(old) }))!;
    expect(s.res.fruit).toBe(500);
    expect(s.b.tree).toBe(17);
    expect(s.log).toEqual(['仓库满了']);
  });

  it('新存档优先于旧存档，保存只写新键', () => {
    const b = fresh(0); b.res.fruit = 2;
    const store = memory({ [LEGACY_KEYS[0]]: JSON.stringify({ fruit: 1 }), [SAVE_KEY]: serialize(b) });
    expect(load(store)!.res.fruit).toBe(2);
    b.res.fruit = 3;
    save(store, b);
    expect(JSON.parse(store.data[SAVE_KEY]).s.res.fruit).toBe(3);
    expect(JSON.parse(store.data[LEGACY_KEYS[0]]).fruit).toBe(1);
  });

  it('坏数据不会弄坏游戏', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('[1,2]')).toBeNull();
    const s = deserialize(JSON.stringify({ v: 2, s: {
      res: { fruit: 'abc', money: -5 }, b: { tree: Infinity, ghost: 3 }, techs: ['grafting', 'nope', 5],
      jobs: { farmer: 4 }, workers: 1, log: 'x', seen: 'y', cal: { on: 'yes' }
    } }))!;
    expect(s.res.fruit).toBe(0);
    expect(s.res.money).toBe(0);
    expect(s.b.tree).toBe(0);
    expect('ghost' in s.b).toBe(false);
    expect(s.techs).toEqual(['grafting']);
    expect(s.workers).toBe(4);
    expect(s.log).toEqual([T.start]);
    expect(s.seen).toEqual(fresh().seen);
    expect(s.cal.on).toBe(false);
  });

  it('存储不可用时当作没有存档', () => {
    const broken: Store = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); }
    };
    expect(load(broken)).toBeNull();
    expect(() => save(broken, fresh())).not.toThrow();
  });
});
