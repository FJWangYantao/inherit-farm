import { describe, expect, it } from 'vitest';
import {
  ARRIVE_SECONDS, FERT_BONUS, FERT_PER_TREE, FOOD_PER_WORKER, LEAVE_SECONDS, MOOD_FREE_WORKERS, MOOD_MAX, MOOD_PER_WORKER,
  OFFLINE_MAX_SECONDS, OFFLINE_STEP_SECONDS, ORCHARD_SEASON, SAT_FLOOR, SEASON_SECONDS, VARIETY_MOOD, warehouseCap
} from '../src/game/balance';
import { BUILDING, SHELVES, TECHS } from '../src/game/content';
import { BUYERS, PRODUCT } from '../src/game/content/shop';
import { Game } from '../src/game/game';
import { fresh, type GameState } from '../src/game/state';
import { T } from '../src/game/text';

type Patch = Omit<Partial<GameState>, 'res' | 'b' | 'jobs' | 'shelves' | 'f' | 'cal'> & {
  res?: Partial<GameState['res']>; b?: Record<string, number>; jobs?: Record<string, number>;
  shelves?: Record<string, number>; f?: Partial<GameState['f']>; cal?: Partial<GameState['cal']>;
};

function game(p: Patch = {}): Game {
  const s = fresh(0);
  const g = new Game({
    ...s, ...p,
    res: { ...s.res, ...p.res }, b: { ...s.b, ...p.b }, jobs: { ...s.jobs, ...p.jobs },
    shelves: { ...s.shelves, ...p.shelves }, f: { ...s.f, ...p.f }, cal: { ...s.cal, ...p.cal },
    seen: [...s.seen, ...(p.seen ?? [])]
  });
  g.check();
  return g;
}

/** 把货架买到某一件（不含）为止 */
function upTo(item: string): Record<string, number> {
  for (const sh of SHELVES) {
    const i = sh.items.findIndex(x => x.id === item);
    if (i >= 0) return { [sh.id]: i };
  }
  throw new Error(item);
}

describe('开局', () => {
  it('只有摘果；摘到 10 个出现果树', () => {
    const g = game();
    expect(g.entries('farm')).toEqual(['act:pick']);
    for (let i = 0; i < 9; i++) g.pick();
    expect(g.isSeen('b:tree')).toBe(false);
    g.pick();
    expect(g.entries('farm')).toEqual(['act:pick', 'b:tree']);
    expect(g.s.log[0]).toBe(BUILDING.get('tree')!.intro);
    expect(g.build('tree')).toBe(true);
    expect(g.s.res.fruit).toBe(0);
    expect(g.s.log[0]).toBe(BUILDING.get('tree')!.first);
  });

  it('树每秒产果，满仓后停在上限并出现木头、砍柴和扩建', () => {
    const g = game({ b: { tree: 10 } });
    g.tick(5);
    expect(g.s.res.fruit).toBe(50);
    g.tick(100);
    expect(g.s.res.fruit).toBe(warehouseCap(0));
    expect(g.s.f.cap).toBe(true);
    expect(g.isSeen('res:wood') && g.isSeen('act:chop') && g.isSeen('act:expand')).toBe(true);
    expect(g.gather('wood')).toBe(true);
    expect(g.s.res.wood).toBe(1);
  });

  it('扩建花掉一仓果子和木头，上限变成 5 倍，出现林木', () => {
    const g = game({ res: { fruit: 100, wood: 20 }, f: { cap: true } });
    expect(g.expand()).toBe(true);
    expect(g.s).toMatchObject({ level: 1, res: expect.objectContaining({ fruit: 0, wood: 0 }) });
    expect(g.cap('fruit')).toBe(500);
    expect(g.isSeen('b:timber')).toBe(true);
  });

  it('果树到 30 棵出现卖果，第一次卖出出现钱和集市', () => {
    const g = game({ b: { tree: 30 }, res: { fruit: 250 } });
    expect(g.isSeen('act:sell')).toBe(true);
    expect(g.sell('fruit')).toBe(100);
    expect(g.s.res.money).toBe(10);
    g.check();
    expect(g.isSeen('res:money') && g.isSeen('tab:market') && g.isSeen('shelf:hardware')).toBe(true);
  });
});

describe('建筑', () => {
  it('价格按指数涨，不够钱盖不了', () => {
    const g = game({ seen: ['b:hut'], res: { wood: 1000, money: 1000 } });
    const c0 = g.costOf('hut');
    expect(g.build('hut')).toBe(true);
    const c1 = g.costOf('hut');
    expect(c1.wood).toBe(Math.ceil(c0.wood! * BUILDING.get('hut')!.ratio));
    g.s.res.money = 0;
    expect(g.build('hut')).toBe(false);
  });

  it('没出现的建筑盖不了', () => {
    expect(game({ res: { wood: 1e6, money: 1e6 } }).build('hut')).toBe(false);
  });

  it('加工建筑按比例：原料不够或产品放不下就少做', () => {
    const g = game({ seen: ['b:sawmill'], b: { sawmill: 2 }, level: 3, res: { wood: 30 } });
    g.tick(1);
    // 两间每秒要 50 木头，只有 30，所以做 0.6 块
    expect(g.s.res.plank).toBeCloseTo(0.6);
    expect(g.s.res.wood).toBeCloseTo(0);
    g.s.res.wood = 1e4;
    g.s.res.plank = g.cap('plank') - 0.5;
    g.tick(1);
    expect(g.s.res.plank).toBeCloseTo(g.cap('plank'));
    expect(g.s.res.wood).toBeCloseTo(1e4 - 25);
  });
});

describe('帮工', () => {
  const crew = { seen: ['b:hut'], b: { hut: 2 }, res: { fruit: 90 } };

  it('有床位、有果子时每 15 秒来一个人，第一个人来了开始有季节', () => {
    const g = game({ ...crew, level: 3, res: { fruit: 5000 } });
    g.tick(ARRIVE_SECONDS - 1);
    expect(g.s.workers).toBe(0);
    g.tick(1);
    expect(g.s.workers).toBe(1);
    expect(g.s.cal.on).toBe(true);
    expect(g.s.log).toContain(T.firstWorker);
    expect(g.isSeen('job:farmer') && g.isSeen('job:woodcutter')).toBe(true);
    g.tick(ARRIVE_SECONDS * 10);
    expect(g.s.workers).toBe(g.housing());
  });

  it('派活和收回，闲着的人不能是负数', () => {
    const g = game({ ...crew, workers: 3, seen: ['b:hut', 'job:farmer', 'job:woodcutter'] });
    expect(g.assign('farmer', 5)).toBe(3);
    expect(g.idle()).toBe(0);
    expect(g.assign('woodcutter', 1)).toBe(0);
    expect(g.assign('farmer', -2)).toBe(2);
    expect(g.s.jobs.farmer).toBe(1);
  });

  it('每人每秒吃 0.5 个果子；吃光了每 10 秒走一个，先走闲着的', () => {
    const g = game({ ...crew, workers: 4, jobs: { woodcutter: 3 }, res: { fruit: 4 * FOOD_PER_WORKER } });
    g.tick(1);
    expect(g.s.res.fruit).toBe(0);
    expect(g.s.workers).toBe(4);
    g.tick(1);
    expect(g.s.log[0]).toBe(T.hungry);
    g.tick(LEAVE_SECONDS);
    expect(g.s.workers).toBe(3);
    expect(g.s.jobs.woodcutter).toBe(3);
    g.tick(LEAVE_SECONDS);
    expect(g.s.workers).toBe(2);
    expect(g.s.jobs.woodcutter).toBe(2);
  });

  it('果农和推销员', () => {
    const g = game({ workers: 2, jobs: { farmer: 1, seller: 1 }, res: { fruit: 1000 }, level: 3 });
    const before = g.s.res.fruit;
    g.tick(1);
    // 果农 +3，吃掉 1，推销员卖掉 20
    expect(g.s.res.fruit).toBeCloseTo(before + 3 - 2 * FOOD_PER_WORKER - 20);
    expect(g.s.res.money).toBeCloseTo(20 * BUYERS[0].price / 100);
  });
});

describe('季节和天气', () => {
  it('没有日历时没有季节；有了以后苹果树冬天不结果', () => {
    const g = game({ b: { tree: 10 }, level: 5 });
    expect(g.season()).toBe(-1);
    g.s.cal.on = true;
    g.s.cal.t = SEASON_SECONDS * 3 + 1;
    const f0 = g.s.res.fruit;
    g.tick(1);
    expect(g.season()).toBe(3);
    expect(g.s.res.fruit).toBe(f0);
    g.s.cal.t = SEASON_SECONDS * 2 + 1;
    g.s.cal.weather = 0;
    g.tick(1);
    expect(g.s.res.fruit - f0).toBeCloseTo(10 * ORCHARD_SEASON[2]);
  });

  it('天气由存档里的种子决定，同样的种子同样的天气', () => {
    const a = game({ cal: { on: true, rng: 7 } }), b = game({ cal: { on: true, rng: 7 } });
    const wa: number[] = [], wb: number[] = [];
    for (let i = 0; i < 40; i++) {
      a.tick(SEASON_SECONDS); b.tick(SEASON_SECONDS);
      wa.push(a.s.cal.weather); wb.push(b.s.cal.weather);
    }
    expect(wa).toEqual(wb);
    expect(new Set(wa).size).toBeGreaterThan(1);
  });

  it('旱灾 −30%；研究灌溉后不怕旱，研究气象后坏天气减半', () => {
    const g = game({ cal: { on: true, weather: 2 } });
    expect(g.weatherMult()).toBeCloseTo(0.7);
    g.s.techs.push('meteorology');
    expect(new Game(g.s).weatherMult()).toBeCloseTo(0.85);
    g.s.techs.push('irrigation');
    expect(new Game(g.s).weatherMult()).toBe(1);
    g.s.cal.weather = -1;
    expect(new Game(g.s).weatherMult()).toBeCloseTo(0.85);
  });
});

describe('农技', () => {
  it('盖了书屋才出现农技和科技；研究要先研究前置', () => {
    const g = game({ workers: 3, res: { wood: 1000, money: 1000 } });
    expect(g.isSeen('b:library')).toBe(true);
    expect(g.isSeen('tech:farming')).toBe(false);
    g.build('library');
    g.check();
    expect(g.isSeen('tech:farming') && g.isSeen('tech:grafting') && g.isSeen('act:read')).toBe(true);
    expect(g.isSeen('tech:citrus')).toBe(false);
    expect(g.entries('study').slice(0, 3)).toEqual(['b:library', 'act:read', 'tech:farming']);
    expect(g.cap('science')).toBe(100);
  });

  it('研究花掉农技，加成生效，出现新东西', () => {
    const g = game({ seen: ['res:science'], b: { library: 1, tree: 10 }, res: { science: 100 } });
    const r0 = g.rates().fruit;
    expect(g.research('grafting')).toBe(true);
    expect(g.s.res.science).toBe(40);
    expect(g.rates().fruit).toBeCloseTo(r0 * 1.2);
    expect(g.isSeen('b:peach') && g.isSeen('tech:citrus')).toBe(true);
    expect(g.research('grafting')).toBe(false);
  });

  it('书屋给农技员加成，藏书加农技上限', () => {
    const g = game({ seen: ['res:science'], b: { library: 4, station: 1 }, workers: 1, jobs: { scholar: 1 } });
    // 同一组的加成相加：4 间书屋 +20%，1 间农技站 +10%
    expect(g.rates().science).toBeCloseTo(0.25 * 1.3);
    expect(g.cap('science')).toBe(1400);
    g.s.techs.push('catalog');
    expect(new Game(g.s).cap('science')).toBe(2100);
  });
});

describe('手工', () => {
  it('做多少受原料和上限限制；第一罐果酱出现作坊', () => {
    const g = game({ techs: ['carpentry', 'jam'], level: 3, res: { wood: 1000, fruit: 300 } });
    expect(g.craftable('plank')).toBe(20);
    expect(g.craft('plank', 100)).toBe(20);
    expect(g.s.res.wood).toBe(0);
    g.s.res.wood = 100;
    expect(g.craft('jam', 10)).toBe(3);
    expect(g.s.f.cooked).toBe(true);
    expect(g.s.log[0]).toBe(T.firstJar);
    g.check();
    expect(g.isSeen('b:jamShop') && g.isSeen('act:sellJam')).toBe(true);
  });
});

describe('货架和买家', () => {
  it('五金店一件一件卖，卖到冷藏车要等果酱放满过', () => {
    const g = game({ f: { sold: true }, res: { money: 1e9, wood: 1000 }, shelves: upTo('coldTruck') });
    expect(g.shelfItem('hardware')).toBeUndefined();
    expect(g.shelfDone('hardware')).toBe(false);
    g.s.f.jamFull = true;
    expect(g.shelfItem('hardware')!.id).toBe('coldTruck');
    expect(g.buyShelf('hardware')).toBe(true);
    expect(g.flag('coldTruck')).toBe(true);
    g.buyShelf('hardware');
    expect(g.shelfDone('hardware')).toBe(true);
    expect(g.lot()).toBe(1000000);
  });

  it('买奢侈品加面子，新认识的买家一开始收得满', () => {
    const g = game({ res: { money: 1e9 }, shelves: { hardware: 5 } });
    expect(g.isSeen('shelf:lux')).toBe(true);
    g.buyShelf('lux');
    expect(g.face()).toBe(1);
    expect(g.s.dem[1]).toBe(BUYERS[1].cap);
    expect(g.isSeen('shelf:prod')).toBe(true);
  });

  it('卖给出价最高、还收得下的买家；果酱一罐按 100 个算、3 倍价', () => {
    const dem = BUYERS.map(() => 0);
    dem[2] = 150;
    const g = game({ res: { fruit: 5000, jam: 50 }, shelves: { hardware: 5, lux: 2 }, dem,
      seen: ['act:sell', 'act:sellJam'] });
    expect(g.nextBuyer()).toBe(2);
    expect(g.sell('fruit')).toBe(100);
    expect(g.s.res.money).toBeCloseTo(BUYERS[2].price);
    expect(g.nextBuyer()).toBe(0);
    expect(g.sell('jam')).toBe(10);
    expect(g.s.res.money).toBeCloseTo(BUYERS[2].price + 10 * BUYERS[0].price * 3);
  });

  it('果摊把放不下的果子按出价从高到低卖掉', () => {
    const dem = BUYERS.map(() => 0);
    dem[1] = 10;
    const g = game({ res: { fruit: 100 }, b: { tree: 100 }, shelves: { hardware: 3, lux: 1 }, dem });
    // 有梯子，100 棵树一秒产 150 个，全部溢出；小贩收购量先恢复到 50
    const got = g.tick(1);
    expect(got).toBeCloseTo(50 * BUYERS[1].price / 100 + 100 * BUYERS[0].price / 100);
    expect(g.s.res.fruit).toBe(100);
  });
});

describe('时间', () => {
  it('一次推进很久和一秒一秒推进结果一样', () => {
    const p: Patch = { b: { tree: 200, timber: 5, hut: 5 }, shelves: { hardware: 3, lux: 3 }, level: 2, res: { fruit: 500 } };
    const a = game(p), b = game(p);
    a.tick(3000);
    for (let i = 0; i < 3000; i++) b.tick(1);
    expect(a.s.res.money).toBeCloseTo(b.s.res.money, 6);
    expect(a.s.workers).toBe(b.s.workers);
    expect(a.s.cal).toEqual(b.s.cal);
  });

  it('离线最多补算 12 小时，回来报一句收获', () => {
    const g = game({ b: { tree: 50 }, shelves: { hardware: 3 }, level: 3 });
    expect(g.catchUp(30 * 3600)).toBe(OFFLINE_MAX_SECONDS);
    expect(g.s.log[0]).toMatch(/^你离开了 30 小时 0 分钟。.*钱 \+/);
  });

  it('离开不到几秒照常推进，不报收获', () => {
    const g = game({ b: { tree: 50 }, level: 3 });
    g.catchUp(3);
    expect(g.s.res.fruit).toBeCloseTo(150);
    expect(g.s.log.some(l => l.startsWith('你离开了'))).toBe(false);
  });
});

describe('结尾', () => {
  it('研究完所有科技、买完所有货架就到结尾；有了新内容会收回结尾那句', () => {
    const shelves = Object.fromEntries(SHELVES.map(sh => [sh.id, sh.items.length]));
    const g = game({ techs: TECHS.map(t => t.id), shelves });
    expect(g.s.f.end).toBe(true);
    expect(g.s.log[0]).toBe(T.end);
    g.s.techs.pop();
    g.check();
    expect(g.s.f.end).toBe(false);
    expect(g.s.log).not.toContain(T.end);
  });
});

describe('年代二：加工', () => {
  it('手工做出第一包果干，出现晒架和卖果干', () => {
    const g = game({ techs: ['jam', 'drying'], level: 5, res: { fruit: 1000 } });
    expect(g.isSeen('craft:dried')).toBe(true);
    expect(g.isSeen('b:rack')).toBe(false);
    expect(g.craft('dried', 2)).toBe(2);
    expect(g.s.made).toContain('dried');
    g.check();
    expect(g.isSeen('b:rack') && g.isSeen('act:sellDried')).toBe(true);
    expect(g.entries('market')).toContain('act:sellDried');
  });

  it('晒架夏秋晒得快，研究太阳能烘干以后不看季节', () => {
    const g = game({ b: { rack: 1 }, level: 5, res: { fruit: 1e5 }, cal: { on: true, t: SEASON_SECONDS * 3 + 1 } });
    g.tick(1);
    expect(g.s.res.dried).toBeCloseTo(0.25);
    g.s.techs.push('solarDrying');
    const h = new Game(g.s);
    h.tick(1);
    expect(h.s.res.dried).toBeCloseTo(1.25);
  });

  it('果酒要先有酒窖才放得下', () => {
    const g = game({ techs: ['brewing'], res: { fruit: 1000, wood: 100 } });
    expect(g.cap('wine')).toBe(0);
    expect(g.isSeen('craft:wine')).toBe(false);
    g.s.b.cellar = 1;
    const h = new Game(g.s);
    h.check();
    expect(h.cap('wine')).toBe(200);
    expect(h.craft('wine', 10)).toBe(5);
  });

  it('不同买家偏爱不同的东西：果汁卖给航空公司，果酒卖给米其林', () => {
    const dem = BUYERS.map(b => b.cap);
    const g = game({ shelves: { hardware: 5, lux: 9 }, dem });
    const airline = BUYERS.findIndex(b => b.name === '航空公司'), michelin = BUYERS.findIndex(b => b.name === '米其林餐厅');
    expect(g.nextBuyer('juice')).toBe(airline);
    expect(g.nextBuyer('wine')).toBe(michelin);
    expect(g.unitPrice(airline, 'juice')).toBeCloseTo(BUYERS[airline].price / 100 * PRODUCT.get('juice')!.mult * 2);
  });

  it('有了冷藏车，所有加工品放满了都自动卖', () => {
    const g = game({ shelves: { hardware: 7 }, level: 3, res: { dried: 1e6, juice: 1e6 } });
    const got = g.tick(1);
    expect(g.s.res.dried).toBe(g.cap('dried'));
    expect(g.s.res.juice).toBe(g.cap('juice'));
    expect(got).toBeGreaterThan(0);
  });

  it('研究了冷链，冷藏车不用等果酱放满也会上货架', () => {
    const g = game({ f: { sold: true }, shelves: { hardware: 6 }, techs: ['coldChain'] });
    expect(g.shelfItem('hardware')!.id).toBe('coldTruck');
  });
});

describe('心情', () => {
  it('帮工到 20 人开始有心情，人越多心情越低，乘在岗位产量上', () => {
    const g = game({ workers: MOOD_FREE_WORKERS - 1, jobs: { farmer: 10 } });
    expect(g.mood()).toBe(1);
    g.s.workers = MOOD_FREE_WORKERS + 30;
    g.check();
    expect(g.s.f.mood).toBe(true);
    expect(g.s.log[0]).toBe(T.mood);
    expect(g.isSeen('b:canteen') && g.isSeen('shelf:comfort')).toBe(true);
    expect(g.mood()).toBeCloseTo(1 - 30 * MOOD_PER_WORKER);
    expect(g.flows().prod.fruit).toBeCloseTo(10 * 3 * g.mood());
  });

  it('食堂、生活用品、仓库里的加工品都加心情；营养搭配让加工品的加成翻倍；有上限', () => {
    const g = game({ workers: MOOD_FREE_WORKERS, f: { mood: true }, b: { canteen: 2 }, shelves: { comfort: 2 }, res: { jam: 5, dried: 1 } });
    expect(g.mood()).toBeCloseTo(1 + 0.06 + 0.15 + 2 * VARIETY_MOOD);
    g.s.techs.push('nutrition');
    expect(new Game(g.s).mood()).toBeCloseTo(1 + 0.06 + 0.15 + 4 * VARIETY_MOOD);
    g.s.b.canteen = 100;
    expect(new Game(g.s).mood()).toBe(MOOD_MAX);
  });
});

describe('年代三：市场', () => {
  const online = BUYERS.findIndex(b => b.name === '网购顾客');
  const shop = BUYERS.findIndex(b => b.name === '精品超市');

  it('有了品牌、像样的买家收满了，才出现销路问题；集市商人和电商同时出现', () => {
    const dem = BUYERS.map(() => 0);
    const g = game({ shelves: { hardware: 5, lux: 5 }, dem, seen: ['res:science'], techs: ['branding', 'packaging', 'juicing', 'drying', 'jam'] });
    expect(g.s.f.market).toBe(true);
    expect(g.s.log).toContain(T.market);
    expect(g.isSeen('craft:fertilizer') && g.isSeen('craft:seedling') && g.isSeen('tech:ecommerce') && g.isSeen('shelf:marketing')).toBe(true);
    expect(g.entries('market')).toContain('craft:fertilizer');
    const h = game({ shelves: { hardware: 5, lux: 5 }, dem });
    expect(h.s.f.market).toBe(false);
  });

  it('销路：收得越满越便宜，研究市场调研以后最多降到七折', () => {
    const dem = BUYERS.map(() => 0);
    const g = game({ shelves: { hardware: 5, lux: 5 }, dem, f: { market: true } });
    const cap = g.buyerCap(shop);
    g.s.dem[shop] = cap;
    expect(g.saturation(shop)).toBe(1);
    g.s.dem[shop] = 0;
    expect(g.saturation(shop)).toBe(SAT_FLOOR);
    g.s.dem[shop] = cap / 2;
    expect(g.saturation(shop)).toBeCloseTo((1 + SAT_FLOOR) / 2);
    expect(g.saturation(0)).toBe(1);
    g.s.techs.push('marketResearch');
    const h = new Game(g.s);
    h.s.dem[shop] = 0;
    expect(h.saturation(shop)).toBeCloseTo(0.7);
  });

  it('网购顾客不看面子，网店开得越多收得越多，直播带货翻倍', () => {
    const g = game({ shelves: { hardware: 5 } });
    expect(g.knows(online)).toBe(false);
    g.s.b.eshop = 3;
    const h = new Game(g.s);
    expect(h.knows(online)).toBe(true);
    expect(h.buyerRefill(online)).toBe(3 * BUYERS[online].refill);
    h.s.techs.push('livestream');
    expect(new Game(h.s).buyerRefill(online)).toBe(6 * BUYERS[online].refill);
  });

  it('营销货架加所有买家的收购量', () => {
    const g = game({ shelves: { marketing: 2 } });
    expect(g.buyerCap(shop)).toBeCloseTo(BUYERS[shop].cap * 1.2 * 1.3);
  });

  it('商人交易一次出好几个，放在集市页', () => {
    const g = game({ f: { market: true }, level: 5, res: { money: 5000, dried: 25 } });
    expect(g.craftable('fertilizer')).toBe(2);
    expect(g.craft('fertilizer', 10)).toBe(2);
    expect(g.s.res.fertilizer).toBe(40);
    expect(g.s.made).toContain('fertilizer');
  });

  it('仓库里有化肥就自动施肥，果园加成，化肥按树的数量消耗', () => {
    const g = game({ b: { tree: 100, peach: 20 }, level: 6, res: { fertilizer: 10 } });
    const base = g.flows().prod.fruit;
    g.tick(1);
    expect(g.fertilized).toBe(true);
    expect(g.s.res.fertilizer).toBeCloseTo(10 - 120 * FERT_PER_TREE);
    expect(g.flows().prod.fruit).toBeCloseTo(base * (1 + FERT_BONUS));
    g.s.res.fertilizer = 0;
    g.tick(1);
    expect(g.fertilized).toBe(false);
  });

  it('良种果树要用良种苗木种', () => {
    const g = game({ made: ['seedling'], level: 9, res: { fruit: 3e6 } });
    expect(g.isSeen('b:elite')).toBe(true);
    expect(g.build('elite')).toBe(false);
    g.s.res.seedling = 1;
    expect(g.build('elite')).toBe(true);
  });

  it('离线按 10 秒一步补算，和在线一秒一步差不多', () => {
    const p: Patch = { b: { tree: 200, timber: 5, hut: 5 }, shelves: { hardware: 3, lux: 3 }, level: 3, res: { fruit: 500 } };
    const a = game(p), b = game(p);
    a.catchUp(3 * 3600);
    b.tick(3 * 3600);
    expect(a.s.res.money / b.s.res.money).toBeCloseTo(1, 1);
    expect(a.s.workers).toBe(b.s.workers);
    expect(OFFLINE_STEP_SECONDS).toBe(10);
  });
});
