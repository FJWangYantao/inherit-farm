import { describe, expect, it } from 'vitest';
import {
  BUYERS, LUX, OFFLINE_EFFICIENCY, OFFLINE_MAX_SECONDS, PROD, TECH, TOOLS, cap, expandCost, treeCost
} from '../src/game/config';
import { Game } from '../src/game/game';
import { fresh, type GameState } from '../src/game/state';
import { T } from '../src/game/text';

function game(patch: Partial<GameState> = {}): Game {
  const s = fresh(0);
  return new Game({ ...s, ...patch, f: { ...s.f, ...patch.f } });
}

describe('开局', () => {
  it('只有摘果，摘到 10 个出现种树', () => {
    const g = game();
    expect(g.plant()).toBe(false);
    for (let i = 0; i < 9; i++) g.pick();
    expect(g.s.f.tree).toBe(false);
    g.pick();
    expect(g.s.f.tree).toBe(true);
    expect(g.s.log[0]).toBe(T.canPlant);
    expect(g.plant()).toBe(true);
    expect(g.s.fruit).toBe(10 - treeCost(0));
    expect(g.s.log[0]).toBe(T.firstTree);
  });

  it('树每秒产果，满仓后停在上限并出现砍柴和扩建', () => {
    const g = game({ trees: 10, f: { tree: true } as GameState['f'] });
    g.tick(5);
    expect(g.s.fruit).toBe(50);
    g.tick(100);
    expect(g.s.fruit).toBe(cap(0));
    expect(g.s.f.cap).toBe(true);
    expect(g.chop()).toBe(true);
    expect(g.s.wood).toBe(1);
  });
});

describe('仓库', () => {
  it('扩建花掉一仓果子和木头，上限变成 5 倍', () => {
    const g = game({ fruit: 100, wood: 20, f: { cap: true } as GameState['f'] });
    expect(g.expand()).toBe(true);
    expect(g.s).toMatchObject({ level: 1, fruit: 0, wood: 0 });
    expect(g.cap()).toBe(500);
  });

  it('第四次起扩建要上限 40% 的木头', () => {
    expect(expandCost(3)).toEqual({ fruit: 12500, wood: 5000 });
  });

  it('木头也受仓库上限限制', () => {
    const g = game({ timber: 100, level: 1 });
    g.tick(100);
    expect(g.s.wood).toBe(cap(1));
  });
});

describe('卖果', () => {
  it('没解锁时卖不了', () => {
    expect(game({ fruit: 500 }).sell()).toBe(0);
  });

  it('一趟卖 100 个给村口，第一次卖出出现钱', () => {
    const g = game({ fruit: 250, f: { sell: true } as GameState['f'] });
    expect(g.sell()).toBe(100);
    expect(g.s.money).toBe(10);
    expect(g.s.f.sold).toBe(true);
    expect(g.s.log[0]).toBe(T.firstSale);
  });

  it('有面子时卖给出价最高、还收得下的买家，收购量会用完', () => {
    const dem = [0, 3000, 150, 0];
    const g = game({ fruit: 5000, lux: 2, tech: 1, dem, f: { sell: true, sold: true } as GameState['f'] });
    expect(g.nextBuyer()).toBe(2);
    expect(g.sell()).toBe(100);
    expect(g.s.money).toBe(40);
    expect(g.nextBuyer()).toBe(1);
    expect(g.sell()).toBe(1000);
    expect(g.s.dem[1]).toBe(2000);
  });

  it('果摊把放不下的果子按出价从高到低卖掉', () => {
    // 有梯子，100 棵树一秒产 150 个，全部溢出；小贩收购量先恢复到 50
    const g = game({ fruit: 100, trees: 100, tools: 3, lux: 1, dem: [0, 10, 0, 0] });
    const got = g.tick(1);
    // 50 个给小贩（20 钱/100 个），100 个给王婶（10 钱/100 个）
    expect(got).toBeCloseTo(20);
    expect(g.s.dem[1]).toBe(0);
    expect(g.s.fruit).toBe(100);
  });

  it('买家的收购量按秒恢复，不超过上限', () => {
    const g = game({ lux: 1 });
    g.tick(10);
    expect(g.s.dem[1]).toBe(BUYERS[1].refill * 10);
    g.tick(1000);
    expect(g.s.dem[1]).toBe(BUYERS[1].cap);
  });
});

describe('商店', () => {
  it('五金店一件一件卖，买完换成科技工具', () => {
    const g = game({ money: 1e6, wood: 1000, level: 2, f: { sold: true } as GameState['f'] });
    expect(g.shelfItem('tech')).toBeUndefined();
    for (const t of TOOLS) {
      expect(g.shelfItem('tools')).toBe(t);
      expect(g.buy('tools')).toBe(true);
    }
    expect(g.shelfItem('tools')).toBeUndefined();
    expect(g.shelfItem('tech')).toBe(TECH[0]);
    expect(g.shelfItem('lux')).toBeUndefined();
  });

  it('钱或木头不够买不了', () => {
    const g = game({ money: 1e6, wood: 0, tools: 2, f: { sold: true } as GameState['f'] });
    expect(g.buy('tools')).toBe(false);
    g.s.wood = 300;
    expect(g.buy('tools')).toBe(true);
    expect(g.s.wood).toBe(0);
  });

  it('买手推车出现奢侈品，买新衣服出现生产工具，新买家一开始收满', () => {
    const g = game({ money: 1e6, tools: TOOLS.length, f: { sold: true } as GameState['f'] });
    g.buy('tech');
    expect(g.lot()).toBe(TECH[0].lot);
    expect(g.shelfItem('lux')).toBe(LUX[0]);
    g.buy('lux');
    expect(g.s.dem[1]).toBe(BUYERS[1].cap);
    expect(g.shelfItem('prod')).toBe(PROD[0]);
  });

  it('全部买完到结尾', () => {
    const g = game({ money: 1e7, tools: TOOLS.length, f: { sold: true } as GameState['f'] });
    while (g.buy('tech') || g.buy('lux') || g.buy('prod')) { /* 买到没得买 */ }
    expect(g.s.f.end).toBe(true);
    expect(g.s.log[0]).toBe(T.end);
  });

  it('产量加成相乘', () => {
    const g = game({ trees: 10, tools: TOOLS.length, prod: 2 });
    expect(g.fruitRate()).toBeCloseTo(10 * 1.5 * 1.5 * 1.5 * 1.5);
  });
});

describe('时间', () => {
  it('一次推进很久和一秒一秒推进结果一样', () => {
    const base = { trees: 200, tools: 3, lux: 3, level: 2, timber: 5 };
    const a = game(base), b = game(base);
    a.tick(600);
    for (let i = 0; i < 600; i++) b.tick(1);
    expect(a.s.money).toBeCloseTo(b.s.money, 6);
    expect(a.s.dem).toEqual(b.s.dem.map(x => expect.closeTo(x, 6)));
  });
});

describe('离线', () => {
  const base = { trees: 200, tools: 3, lux: 2, level: 2, timber: 5 };

  it('离开时间有上限，并按效率折算', () => {
    const a = game(base), b = game(base);
    expect(a.catchUp(8 * 3600)).toBe(OFFLINE_MAX_SECONDS * OFFLINE_EFFICIENCY);
    b.tick(OFFLINE_MAX_SECONDS * OFFLINE_EFFICIENCY);
    expect(a.s.money).toBeCloseTo(b.s.money, 6);
  });

  it('离开不到几秒照常推进，不报收获', () => {
    const a = game(base), b = game(base);
    a.catchUp(3);
    b.tick(3);
    expect(a.s.money).toBeCloseTo(b.s.money, 6);
    expect(a.s.log.some(line => line.startsWith('你离开了'))).toBe(false);
  });

  it('离开一分钟以上回来报一句收获', () => {
    const g = game(base);
    g.catchUp(2 * 3600 + 5 * 60);
    expect(g.s.log[0]).toMatch(/^你离开了 2 小时 5 分钟。.*钱 \+/);
  });
});
