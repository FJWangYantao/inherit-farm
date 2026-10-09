// 游戏规则。这里不碰界面，游戏页面、节奏模拟和测试用的是同一套。
// 具体有哪些东西、数值多少在 content/ 下，这里只管怎么算。

import {
  ARRIVE_SECONDS, BASE_LOT, FOOD_PER_WORKER, LEAVE_SECONDS, OFFLINE_EFFICIENCY, OFFLINE_MAX_SECONDS,
  OFFLINE_MIN_SECONDS, OFFLINE_REPORT_SECONDS, SEASON_SECONDS, WEATHERS, WINTER_BAD, expandCost, warehouseCap
} from './balance';
import {
  ACTIONS, BUILDING, BUILDINGS, CRAFT, CRAFTS, ITEM, JOB, JOBS, RES, RESOURCES, SHELF, SHELVES, TABS, TECH, TECHS,
  entryTab
} from './content';
import { BUYERS, PRODUCTS } from './content/shop';
import type { Amounts, BuildingDef, Effects, JobDef, ResId, SeasonProfile, Show, ShopItem, TabId } from './defs';
import { fmt } from './format';
import { LOG_LENGTH, fresh, type GameState } from './state';
import { T } from './text';

/** 所有加成汇总后的结果，买东西、盖房子以后重算 */
interface Fx {
  mult: Map<string, number>;
  capMult: Map<ResId, number>;
  caps: Map<ResId, number>;
  flags: Set<string>;
  lot: number;
  face: number;
  housing: number;
}

/** 解锁检查的顺序：同一刻出现好几样东西时，按这个顺序排进 seen */
interface Unlock { id: string; show: Show; intro?: string }
const UNLOCKS: Unlock[] = [
  ...RESOURCES.map(r => ({ id: 'res:' + r.id, show: r.show, intro: r.intro })),
  ...TABS.map(t => ({ id: 'tab:' + t.id, show: t.show })),
  ...ACTIONS.map(a => ({ id: 'act:' + a.id, show: a.show, intro: a.intro })),
  ...BUILDINGS.map(b => ({ id: 'b:' + b.id, show: b.show, intro: b.intro })),
  ...JOBS.map(j => ({ id: 'job:' + j.id, show: j.show, intro: j.intro })),
  ...CRAFTS.map(c => ({ id: 'craft:' + c.id, show: c.show, intro: c.intro })),
  ...TECHS.map(t => ({
    id: 'tech:' + t.id, intro: t.intro,
    // 有了农技这项资源（盖了书屋）以后科技才出现
    show: (g: Game) => g.isSeen('res:science') && t.deps.every(d => g.has(d)) && (t.show ? t.show(g) : true)
  })),
  ...SHELVES.map(s => ({ id: 'shelf:' + s.id, show: s.show }))
];

/** mulberry32：给天气用的小随机数，状态是一个 32 位整数 */
function nextRandom(state: number): [number, number] {
  const t = (state + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [t, ((r ^ (r >>> 14)) >>> 0) / 4294967296];
}

export class Game {
  s: GameState;
  /** 故事栏有没有新的一句还没显示，界面显示后清掉 */
  newLine = false;
  private fx: Fx | null = null;
  private seenSet: Set<string>;

  constructor(state: GameState = fresh()) {
    this.s = state;
    this.seenSet = new Set(state.seen);
  }

  reset(now = Date.now()): void {
    this.s = fresh(now);
    this.seenSet = new Set(this.s.seen);
    this.fx = null;
    this.newLine = false;
  }

  // ---- 查询 ----

  has(tech: string): boolean { return this.s.techs.includes(tech); }
  count(building: string): number { return this.s.b[building] ?? 0; }
  /** 货架上的这件买了没有 */
  owns(item: string): boolean {
    const loc = ITEM.get(item);
    if (!loc) throw new Error('没有这件东西：' + item);
    return (this.s.shelves[loc.shelf.id] ?? 0) > loc.index;
  }
  isSeen(entry: string): boolean { return this.seenSet.has(entry); }
  warehouse(): number { return warehouseCap(this.s.level); }
  housing(): number { return this.effects().housing; }
  idle(): number {
    let busy = 0;
    for (const j of JOBS) busy += this.s.jobs[j.id] ?? 0;
    return this.s.workers - busy;
  }
  /** 建筑加的上限之和 */
  capOf(res: ResId): number { return this.effects().caps.get(res) ?? 0; }
  cap(res: ResId): number { return RES.get(res)!.cap(this) * (this.effects().capMult.get(res) ?? 1); }
  flag(name: string): boolean { return this.effects().flags.has(name); }
  face(): number { return this.effects().face; }
  /** 卖一趟最多卖多少个果子（果酱按一罐 100 个算） */
  lot(): number { return this.effects().lot; }
  priceMult(): number { return this.mult('price'); }
  /** 某个产量组的总倍数 */
  mult(group: string): number { return this.effects().mult.get(group) ?? 1; }
  knows(i: number): boolean { return this.face() >= BUYERS[i].face; }
  /** 出价最高、还收得下一整份（100 个）的买家 */
  nextBuyer(): number {
    let best = 0;
    for (let i = 1; i < BUYERS.length; i++) if (this.knows(i) && this.s.dem[i] >= BASE_LOT) best = i;
    return best;
  }

  /** 当前季节，0 春 1 夏 2 秋 3 冬；还没有日历时是 -1 */
  season(): number {
    return this.s.cal.on ? Math.floor(this.s.cal.t / SEASON_SECONDS) % 4 : -1;
  }
  year(): number { return Math.floor(this.s.cal.t / (SEASON_SECONDS * 4)) + 1; }
  /** 当前天气的名字，正常天气是空字符串 */
  weatherName(): string {
    const w = this.s.cal.weather;
    return w === -1 ? WINTER_BAD.name : WEATHERS[w]?.name ?? '';
  }
  weatherMult(): number {
    if (!this.s.cal.on) return 1;
    const w = this.s.cal.weather;
    let m = w === -1 ? WEATHERS[2].mult : WEATHERS[w]?.mult ?? 1;
    if (w === 2 && this.flag('noDrought')) m = 1;
    if (m < 1 && this.flag('halfBadWeather')) m = 1 - (1 - m) / 2;
    return m;
  }
  private seasonMult(profile?: SeasonProfile): number {
    const i = this.season();
    return profile && i >= 0 ? profile[i] : 1;
  }
  /** 一个建筑或一个帮工的产量倍数：加成 × 季节 × 天气 */
  prodMult(def: BuildingDef | JobDef): number {
    return (def.group ? this.mult(def.group) : 1) * this.seasonMult(def.season) * (def.weather ? this.weatherMult() : 1);
  }

  // ---- 价格 ----

  costOf(id: string): Amounts {
    const def = BUILDING.get(id)!, n = this.count(id), out: Amounts = {};
    for (const [r, v] of Object.entries(def.cost) as [ResId, number][]) out[r] = Math.ceil(v * Math.pow(def.ratio, n));
    return out;
  }
  canPay(cost: Amounts, times = 1): boolean {
    for (const [r, v] of Object.entries(cost) as [ResId, number][]) if (this.s.res[r] < v * times - 1e-9) return false;
    return true;
  }
  private pay(cost: Amounts, times = 1): void {
    for (const [r, v] of Object.entries(cost) as [ResId, number][]) this.s.res[r] = Math.max(0, this.s.res[r] - v * times);
  }

  // ---- 货架 ----

  /** 货架上现在摆的那件。卖空了、或者下一件的条件还没满足，就是 undefined */
  shelfItem(shelfId: string): ShopItem | undefined {
    const shelf = SHELF.get(shelfId)!, item = shelf.items[this.s.shelves[shelfId] ?? 0];
    return item && (!item.need || item.need(this)) ? item : undefined;
  }
  shelfDone(shelfId: string): boolean {
    return (this.s.shelves[shelfId] ?? 0) >= SHELF.get(shelfId)!.items.length;
  }

  // ---- 加成汇总 ----

  private effects(): Fx {
    if (this.fx) return this.fx;
    const fx: Fx = { mult: new Map(), capMult: new Map(), caps: new Map(), flags: new Set(), lot: BASE_LOT, face: 0, housing: 0 };
    const apply = (e?: Effects) => {
      if (!e) return;
      for (const [k, v] of Object.entries(e.mult ?? {})) fx.mult.set(k, (fx.mult.get(k) ?? 1) * (1 + v));
      for (const [k, v] of Object.entries(e.capMult ?? {}) as [ResId, number][]) fx.capMult.set(k, (fx.capMult.get(k) ?? 1) * (1 + v));
      for (const f of e.flags ?? []) fx.flags.add(f);
      if (e.lot) fx.lot = Math.max(fx.lot, e.lot);
      fx.face += e.face ?? 0;
    };
    for (const id of this.s.techs) apply(TECH.get(id)?.effects);
    for (const shelf of SHELVES) {
      const n = this.s.shelves[shelf.id] ?? 0;
      for (let i = 0; i < n && i < shelf.items.length; i++) apply(shelf.items[i].effects);
    }
    const boost = new Map<string, number>();
    for (const b of BUILDINGS) {
      const n = this.count(b.id);
      if (!n) continue;
      for (const [r, v] of Object.entries(b.caps ?? {}) as [ResId, number][]) fx.caps.set(r, (fx.caps.get(r) ?? 0) + v * n);
      for (const [k, v] of Object.entries(b.boost ?? {})) boost.set(k, (boost.get(k) ?? 0) + v * n);
      fx.housing += (b.housing ?? 0) * n;
    }
    for (const [k, v] of boost) fx.mult.set(k, (fx.mult.get(k) ?? 1) * (1 + v));
    this.fx = fx;
    return fx;
  }
  /** 买了东西、盖了房子、研究了科技以后调用 */
  private changed(): void { this.fx = null; }

  // ---- 产出 ----

  /** 每种资源每秒的净变化（不考虑上限和原料够不够），给界面显示用 */
  rates(): Record<ResId, number> {
    const r = Object.fromEntries(RESOURCES.map(d => [d.id, 0])) as Record<ResId, number>;
    for (const b of BUILDINGS) {
      const n = this.count(b.id);
      if (!n) continue;
      const k = n * this.prodMult(b);
      for (const [res, v] of Object.entries(b.prod ?? {}) as [ResId, number][]) r[res] += v * k;
      for (const [res, v] of Object.entries(b.use ?? {}) as [ResId, number][]) r[res] -= v * k;
    }
    for (const j of JOBS) {
      const n = this.s.jobs[j.id] ?? 0;
      if (!n) continue;
      const k = n * this.prodMult(j);
      for (const [res, v] of Object.entries(j.prod) as [ResId, number][]) r[res] += v * k;
      if (j.sells) r.fruit -= j.sells * n;
    }
    r.fruit -= this.s.workers * FOOD_PER_WORKER;
    return r;
  }

  /**
   * 放不下或推销员卖的东西，卖给出价高、还收得下的买家，剩下的给村口。返回卖到的钱。
   * units 按果子个数算（一罐果酱算 100 个），mult 是价钱倍数（果酱是 3）。
   */
  private sellUnits(units: number, mult = 1): number {
    const s = this.s, price = this.priceMult() * mult;
    let got = 0;
    for (let i = BUYERS.length - 1; i >= 1 && units > 0; i--) {
      if (!this.knows(i) || s.dem[i] <= 0) continue;
      const q = Math.min(units, s.dem[i]);
      s.dem[i] -= q; units -= q; got += q * BUYERS[i].price / 100 * price;
    }
    got += units * BUYERS[0].price / 100 * price;
    s.res.money += got;
    return got;
  }

  /** 把超过上限的部分收掉：果子有果摊就卖，果酱有冷藏车就卖，其余直接扔掉。返回卖到的钱 */
  private settle(): number {
    const s = this.s;
    let got = 0;
    for (const def of RESOURCES) {
      const c = this.cap(def.id);
      if (s.res[def.id] <= c) continue;
      const over = s.res[def.id] - c;
      if (def.id === 'fruit' && this.flag('stall')) got += this.sellUnits(over);
      if (def.id === 'jam' && this.flag('coldTruck')) got += this.sellUnits(over * PRODUCTS.jam.units, PRODUCTS.jam.mult);
      s.res[def.id] = c;
    }
    return got;
  }

  say(text: string): void {
    const log = this.s.log;
    log.unshift(text);
    if (log.length > LOG_LENGTH) log.length = LOG_LENGTH;
    this.newLine = true;
  }

  private markSeen(id: string, intro?: string): void {
    this.s.seen.push(id);
    this.seenSet.add(id);
    if (intro) this.say(intro);
  }

  /**
   * 检查一次性的节点和新出现的东西。quiet 时新出现的东西不报故事，
   * 读档时用：旧版本的存档里早就有的东西，不该再报一遍「出现了」。
   */
  check(quiet = false): void {
    const s = this.s;
    if (!s.f.cap && s.level === 0 && s.res.fruit >= warehouseCap(0)) { s.f.cap = true; this.say(T.capFull); }
    if (s.f.cooked && !s.f.jamFull && s.res.jam >= this.cap('jam') - 1e-9) { s.f.jamFull = true; this.say(T.jamFull); }
    for (const u of UNLOCKS) if (!this.seenSet.has(u.id) && u.show(this)) this.markSeen(u.id, quiet ? undefined : u.intro);
    const done = s.techs.length === TECHS.length && SHELVES.every(sh => this.shelfDone(sh.id));
    if (done && !s.f.end) { s.f.end = true; this.say(T.end); }
    // 旧版本到过结尾的存档，更新出了新内容就收回结尾那句
    if (!done && s.f.end) { s.f.end = false; s.log = s.log.filter(line => line !== T.end); }
  }

  private advanceCalendar(dt: number): void {
    const cal = this.s.cal;
    if (!cal.on) return;
    const before = Math.floor(cal.t / SEASON_SECONDS);
    cal.t += dt;
    if (Math.floor(cal.t / SEASON_SECONDS) === before) return;
    const season = this.season();
    const [next, roll] = nextRandom(cal.rng);
    cal.rng = next;
    let w = 0;
    if (roll < WEATHERS[1].chance) w = 1;
    else if (roll < WEATHERS[1].chance + WEATHERS[2].chance) w = season === 3 ? -1 : 2;
    cal.weather = w;
    if (season === 3 && !this.s.f.winter) { this.s.f.winter = true; this.say(T.winter); }
    if (w !== 0) this.say(w === -1 ? WINTER_BAD.line : WEATHERS[w].line);
  }

  /** 帮工吃饭，果子不够吃就返回 true */
  private feedWorkers(dt: number): boolean {
    const s = this.s, need = s.workers * FOOD_PER_WORKER * dt;
    if (s.res.fruit >= need) { s.res.fruit -= need; return false; }
    s.res.fruit = 0;
    return true;
  }

  private moveWorkers(dt: number, hungry: boolean): void {
    const s = this.s;
    if (hungry) {
      if (!s.f.hungry) { s.f.hungry = true; this.say(T.hungry); }
      s.timer.arrive = 0;
      s.timer.leave += dt;
      while (s.timer.leave >= LEAVE_SECONDS && s.workers > 0) {
        s.timer.leave -= LEAVE_SECONDS;
        s.workers -= 1;
        if (this.idle() < 0) {
          // 先走闲着的，没有闲着的就从人最多的岗位走
          const job = JOBS.reduce((a, b) => ((s.jobs[b.id] ?? 0) > (s.jobs[a.id] ?? 0) ? b : a));
          s.jobs[job.id] -= 1;
        }
        this.say(T.workerLeft);
      }
      return;
    }
    s.f.hungry = false;
    s.timer.leave = 0;
    if (s.workers >= this.housing() || s.res.fruit <= 0) { s.timer.arrive = 0; return; }
    s.timer.arrive += dt;
    while (s.timer.arrive >= ARRIVE_SECONDS && s.workers < this.housing()) {
      s.timer.arrive -= ARRIVE_SECONDS;
      s.workers += 1;
      if (!s.cal.on) { s.cal.on = true; this.say(T.firstWorker); }
    }
  }

  private step(dt: number): number {
    const s = this.s;
    let got = 0;
    for (let i = 1; i < BUYERS.length; i++) {
      if (this.knows(i)) s.dem[i] = Math.min(BUYERS[i].cap, s.dem[i] + BUYERS[i].refill * dt);
    }
    this.advanceCalendar(dt);

    // 不消耗原料的：果树、林木、土坑、帮工
    for (const b of BUILDINGS) {
      if (b.use || !b.prod) continue;
      const n = this.count(b.id);
      if (!n) continue;
      const k = n * this.prodMult(b) * dt;
      for (const [r, v] of Object.entries(b.prod) as [ResId, number][]) s.res[r] += v * k;
    }
    for (const j of JOBS) {
      const n = s.jobs[j.id] ?? 0;
      if (!n) continue;
      const k = n * this.prodMult(j) * dt;
      for (const [r, v] of Object.entries(j.prod) as [ResId, number][]) s.res[r] += v * k;
    }

    const hungry = this.feedWorkers(dt);

    // 加工：原料不够或者产品放不下，就按比例少做
    for (const b of BUILDINGS) {
      if (!b.use) continue;
      const n = this.count(b.id);
      if (!n) continue;
      const k = n * this.prodMult(b) * dt;
      let frac = 1;
      for (const [r, v] of Object.entries(b.use) as [ResId, number][]) frac = Math.min(frac, s.res[r] / (v * k));
      for (const [r, v] of Object.entries(b.prod ?? {}) as [ResId, number][]) {
        if (r === 'jam' && this.flag('coldTruck')) continue;
        frac = Math.min(frac, Math.max(0, this.cap(r) - s.res[r]) / (v * k));
      }
      if (!(frac > 0)) continue;
      for (const [r, v] of Object.entries(b.use) as [ResId, number][]) s.res[r] = Math.max(0, s.res[r] - v * k * frac);
      for (const [r, v] of Object.entries(b.prod ?? {}) as [ResId, number][]) s.res[r] += v * k * frac;
    }

    // 推销员
    for (const j of JOBS) {
      if (!j.sells) continue;
      const q = Math.min(s.res.fruit, (s.jobs[j.id] ?? 0) * j.sells * dt);
      if (q > 0) { s.res.fruit -= q; got += this.sellUnits(q); }
    }

    got += this.settle();
    this.moveWorkers(dt, hungry);
    this.check();
    return got;
  }

  /**
   * 推进 dt 秒，返回这段时间自动卖到的钱（果摊、冷藏车、推销员）。
   * 超过 1 秒的部分按每秒一步来算，这样买家的收购量恢复和一口气算的结果一致。
   */
  tick(dt: number): number {
    let got = 0;
    while (dt > 1) { got += this.step(1); dt -= 1; }
    if (dt > 0) got += this.step(dt);
    return got;
  }

  /**
   * 补算离开期间的产出。离开的时间最多算 OFFLINE_MAX_SECONDS，再乘 OFFLINE_EFFICIENCY。
   * 不到 OFFLINE_MIN_SECONDS 的照常推进。返回实际推进了多少秒。
   */
  catchUp(awaySeconds: number): number {
    if (!(awaySeconds > 0)) return 0;
    if (awaySeconds < OFFLINE_MIN_SECONDS) { this.tick(awaySeconds); return awaySeconds; }
    const counted = Math.min(awaySeconds, OFFLINE_MAX_SECONDS) * OFFLINE_EFFICIENCY;
    const before = { ...this.s.res }, w0 = this.s.workers;
    this.tick(counted);
    if (awaySeconds >= OFFLINE_REPORT_SECONDS) {
      const gains: string[] = [];
      for (const def of RESOURCES) {
        const d = this.s.res[def.id] - before[def.id];
        if (d >= 1) gains.push(def.name + ' +' + fmt(d));
      }
      if (this.s.workers > w0) gains.push(`来了 ${this.s.workers - w0} 个帮工`);
      this.say(T.away(awaySeconds, gains));
    }
    return counted;
  }

  // ---- 玩家操作：做成了返回 true 或做成的数量 ----

  pick(): boolean {
    this.s.res.fruit += 1;
    this.settle();
    this.check();
    return true;
  }

  /** 手动 +1：砍柴、挖土、看书 */
  gather(res: ResId): boolean {
    if (this.s.res[res] >= this.cap(res)) return false;
    this.s.res[res] = Math.min(this.cap(res), this.s.res[res] + 1);
    this.check();
    return true;
  }

  expand(): boolean {
    const s = this.s, c = expandCost(s.level);
    if (!s.f.cap || s.res.fruit < c.fruit || s.res.wood < c.wood) return false;
    s.res.fruit -= c.fruit; s.res.wood -= c.wood; s.level += 1;
    this.say(s.level === 1 ? T.firstExpand(this.warehouse()) : T.expand(this.warehouse()));
    this.check();
    return true;
  }

  /** 卖一趟给 nextBuyer()，返回卖掉的份数（果子按个，果酱按罐） */
  sell(product: 'fruit' | 'jam'): number {
    const s = this.s, p = PRODUCTS[product];
    if (!this.isSeen(product === 'fruit' ? 'act:sell' : 'act:sellJam')) return 0;
    const i = this.nextBuyer(), b = BUYERS[i], step = product === 'fruit' ? BASE_LOT : 1;
    let n = Math.min(this.lot() / p.units, s.res[p.res]);
    if (b.cap) n = Math.min(n, s.dem[i] / p.units);
    n = Math.floor((n + 1e-9) / step) * step;
    if (n < step) return 0;
    s.res[p.res] -= n;
    s.res.money += n * p.units * b.price / 100 * p.mult * this.priceMult();
    if (b.cap) s.dem[i] -= n * p.units;
    if (!s.f.sold) { s.f.sold = true; this.say(T.firstSale); }
    this.check();
    return n;
  }

  build(id: string): boolean {
    const def = BUILDING.get(id);
    if (!def || !this.isSeen('b:' + id)) return false;
    const cost = this.costOf(id);
    if (!this.canPay(cost)) return false;
    this.pay(cost);
    this.s.b[id] = this.count(id) + 1;
    this.changed();
    if (this.s.b[id] === 1 && def.first) this.say(def.first);
    this.check();
    return true;
  }

  /** 给岗位加人（n > 0）或减人（n < 0），返回实际变动的人数 */
  assign(jobId: string, n: number): number {
    if (!JOB.has(jobId) || !this.isSeen('job:' + jobId)) return 0;
    const cur = this.s.jobs[jobId] ?? 0;
    const k = n > 0 ? Math.min(n, this.idle()) : -Math.min(-n, cur);
    this.s.jobs[jobId] = cur + k;
    return Math.abs(k);
  }

  /** 最多能做几个 */
  craftable(id: string): number {
    const def = CRAFT.get(id)!;
    let n = Math.floor(this.cap(def.out) - this.s.res[def.out] + 1e-9);
    for (const [r, v] of Object.entries(def.cost) as [ResId, number][]) n = Math.min(n, Math.floor(this.s.res[r] / v + 1e-9));
    return Math.max(0, n);
  }

  /** 手动做 n 个，返回实际做了几个 */
  craft(id: string, n: number): number {
    const def = CRAFT.get(id);
    if (!def || !this.isSeen('craft:' + id)) return 0;
    const k = Math.min(n, this.craftable(id));
    if (k < 1) return 0;
    this.pay(def.cost, k);
    this.s.res[def.out] += k;
    if (def.out === 'jam' && !this.s.f.cooked) { this.s.f.cooked = true; this.say(T.firstJar); }
    this.check();
    return k;
  }

  research(id: string): boolean {
    const def = TECH.get(id);
    if (!def || this.has(id) || !this.isSeen('tech:' + id) || !this.canPay(def.cost)) return false;
    this.pay(def.cost);
    this.s.techs.push(id);
    this.changed();
    this.say(def.line);
    this.check();
    return true;
  }

  buyShelf(shelfId: string): boolean {
    const item = this.isSeen('shelf:' + shelfId) ? this.shelfItem(shelfId) : undefined;
    if (!item || !this.canPay(item.cost)) return false;
    const face0 = this.face();
    this.pay(item.cost);
    this.s.shelves[shelfId] = (this.s.shelves[shelfId] ?? 0) + 1;
    this.changed();
    // 面子到了，新认识的买家一开始收得满
    for (let i = 1; i < BUYERS.length; i++) {
      if (BUYERS[i].face > face0 && BUYERS[i].face <= this.face()) this.s.dem[i] = BUYERS[i].cap;
    }
    this.say(item.line);
    this.check();
    return true;
  }

  /** 某一页上的条目，按出现的先后 */
  entries(tab: TabId): string[] {
    return this.s.seen.filter(e => entryTab(e) === tab);
  }
}
