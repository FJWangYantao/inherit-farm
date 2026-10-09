// 游戏规则。这里不碰界面，游戏页面、节奏模拟和测试用的是同一套。

import {
  BASE_LOT, BUYERS, JAM_FRUIT, JAM_MULT, JAM_UNLOCK_LUX, JAM_UNLOCK_WOOD, JAM_WOOD, LADDER_BONUS, LUX, OFFLINE_EFFICIENCY,
  OFFLINE_MAX_SECONDS, OFFLINE_MIN_SECONDS, OFFLINE_REPORT_SECONDS, PROD, PROD_BONUS, SAW_BONUS,
  SELL_UNLOCK_TREES, TECH, TECH_COLD_TRUCK, TIMBER_RATE, TOOL_LADDER, TOOL_SAW, TOOL_STALL, TOOL_TALL_LADDER,
  TOOLS, TREE_RATE, TREE_UNLOCK_FRUIT, WORKSHOP_RATE, cap, expandCost, jamCap, timberCost, treeCost,
  workshopCost, type ShopItem
} from './config';
import { fmt } from './format';
import { LOG_LENGTH, fresh, type GameState } from './state';
import { T } from './text';

export type Shelf = 'tools' | 'tech' | 'lux' | 'prod';

export class Game {
  s: GameState;
  /** 故事栏有没有新的一句还没显示，界面显示后清掉 */
  newLine = false;

  constructor(state: GameState = fresh()) {
    this.s = state;
  }

  reset(now = Date.now()): void {
    this.s = fresh(now);
    this.newLine = false;
  }

  // ---- 读数 ----

  fruitRate(): number {
    const s = this.s;
    return s.trees * TREE_RATE
      * (s.tools >= TOOL_LADDER ? LADDER_BONUS : 1)
      * (s.tools >= TOOL_TALL_LADDER ? LADDER_BONUS : 1)
      * Math.pow(PROD_BONUS, s.prod);
  }
  woodRate(): number {
    return this.s.timber * TIMBER_RATE * (this.s.tools >= TOOL_SAW ? SAW_BONUS : 1);
  }
  cap(): number { return cap(this.s.level); }
  hasStall(): boolean { return this.s.tools >= TOOL_STALL; }
  jamCap(): number { return jamCap(this.s.level); }
  hasColdTruck(): boolean { return this.s.tech >= TECH_COLD_TRUCK; }
  /** 卖果一趟最多卖多少个（果酱按一罐 100 个算） */
  lot(): number {
    for (let i = this.s.tech - 1; i >= 0; i--) {
      const lot = TECH[i].lot;
      if (lot) return lot;
    }
    return BASE_LOT;
  }
  /** 作坊每秒最多熬几罐 */
  jamRate(): number { return this.s.shops * WORKSHOP_RATE; }
  knows(i: number): boolean { return this.s.lux >= BUYERS[i].face; }
  /** 出价最高、还收得下一整份（100 个）的买家 */
  nextBuyer(): number {
    let best = 0;
    for (let i = 1; i < BUYERS.length; i++) if (this.knows(i) && this.s.dem[i] >= BASE_LOT) best = i;
    return best;
  }

  // ---- 货架 ----

  /** 货架上现在摆的那件，卖完了或还没出现就是 undefined */
  shelfItem(key: Shelf): ShopItem | undefined {
    const s = this.s;
    switch (key) {
      case 'tools': return s.f.sold ? TOOLS[s.tools] : undefined;
      case 'tech': {
        const item = s.tools >= TOOLS.length ? TECH[s.tech] : undefined;
        return item && (!item.need || s.f[item.need]) ? item : undefined;
      }
      case 'lux': return s.tech >= 1 ? LUX[s.lux] : undefined;
      case 'prod': return s.lux >= 1 ? PROD[s.prod] : undefined;
    }
  }
  canAfford(item: ShopItem | undefined): boolean {
    return !!item && this.s.money >= item.money && this.s.wood >= (item.wood ?? 0);
  }

  // ---- 产出 ----

  /**
   * 放不下的东西卖给出价高、还收得下的买家，剩下的给村口。返回卖到的钱。
   * x 按果子个数算（一罐果酱算 100 个），mult 是价钱倍数（果酱是 JAM_MULT）。
   */
  private sellOverflow(x: number, mult = 1): number {
    const s = this.s;
    let got = 0;
    for (let i = BUYERS.length - 1; i >= 1 && x > 0; i--) {
      if (!this.knows(i) || s.dem[i] <= 0) continue;
      const q = Math.min(x, s.dem[i]);
      s.dem[i] -= q; x -= q; got += q * BUYERS[i].price / 100 * mult;
    }
    got += x * BUYERS[0].price / 100 * mult;
    s.money += got;
    return got;
  }
  /**
   * 加果子，dt 是这批果子是几秒里产的。作坊先从仓库里拿果子和木头熬果酱
   * （dt 秒内最多熬 jamRate() * dt 罐），仓库还放不下的给果摊卖。返回自动卖到的钱。
   */
  private addFruit(x: number, dt = 0): number {
    const s = this.s, c = this.cap();
    let got = 0;
    s.fruit += x;
    if (s.shops > 0 && dt > 0) {
      const jars = Math.max(0, Math.min(this.jamRate() * dt, s.fruit / JAM_FRUIT, s.wood / JAM_WOOD,
        this.hasColdTruck() ? Infinity : this.jamCap() - s.jam));
      s.fruit -= jars * JAM_FRUIT;
      s.wood -= jars * JAM_WOOD;
      s.jam += jars;
      if (s.jam > this.jamCap()) {
        got += this.sellOverflow((s.jam - this.jamCap()) * JAM_FRUIT, JAM_MULT);
        s.jam = this.jamCap();
      }
    }
    if (s.fruit > c) {
      if (this.hasStall()) got += this.sellOverflow(s.fruit - c);
      s.fruit = c;
    }
    return got;
  }
  private addWood(x: number): void {
    this.s.wood = Math.min(this.cap(), this.s.wood + x);
  }

  say(text: string): void {
    const log = this.s.log;
    log.unshift(text);
    if (log.length > LOG_LENGTH) log.length = LOG_LENGTH;
    this.newLine = true;
  }

  /** 检查一次性的节点 */
  check(): void {
    const s = this.s;
    if (!s.f.tree && s.fruit >= TREE_UNLOCK_FRUIT) { s.f.tree = true; this.say(T.canPlant); }
    if (!s.f.cap && s.level === 0 && s.fruit >= cap(0)) { s.f.cap = true; this.say(T.capFull); }
    if (!s.f.sell && s.trees >= SELL_UNLOCK_TREES) { s.f.sell = true; this.say(T.canSell); }
    if (!s.f.jam && s.lux >= JAM_UNLOCK_LUX && s.wood >= JAM_UNLOCK_WOOD) { s.f.jam = true; this.say(T.canJam); }
    if (s.f.jam && !s.f.jamFull && s.jam >= this.jamCap()) { s.f.jamFull = true; this.say(T.jamFull); }
    const done = s.tech === TECH.length && s.lux === LUX.length && s.prod === PROD.length;
    if (done && !s.f.end) { s.f.end = true; this.say(T.end); }
    // 旧版本到过结尾的存档，更新出了新内容就收回结尾那句
    if (!done && s.f.end) { s.f.end = false; s.log = s.log.filter(line => line !== T.end); }
  }

  private step(dt: number): number {
    const s = this.s;
    for (let i = 1; i < BUYERS.length; i++) {
      if (this.knows(i)) s.dem[i] = Math.min(BUYERS[i].cap, s.dem[i] + BUYERS[i].refill * dt);
    }
    this.addWood(this.woodRate() * dt);
    const got = this.addFruit(this.fruitRate() * dt, dt);
    this.check();
    return got;
  }

  /**
   * 推进 dt 秒，返回这段时间果摊卖到的钱。
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
    const s = this.s, f0 = s.fruit, w0 = s.wood, m0 = s.money;
    this.tick(counted);
    if (awaySeconds >= OFFLINE_REPORT_SECONDS) {
      const gains: string[] = [];
      if (s.fruit - f0 >= 1) gains.push('果子 +' + fmt(s.fruit - f0));
      if (s.wood - w0 >= 1) gains.push('木头 +' + fmt(s.wood - w0));
      if (s.money - m0 >= 1) gains.push('钱 +' + fmt(s.money - m0));
      this.say(T.away(awaySeconds, gains));
    }
    return counted;
  }

  // ---- 玩家操作：做成了返回 true ----

  pick(): boolean {
    this.addFruit(1);
    this.check();
    return true;
  }

  plant(): boolean {
    const s = this.s, c = treeCost(s.trees);
    if (!s.f.tree || s.fruit < c) return false;
    s.fruit -= c; s.trees += 1;
    if (s.trees === 1) this.say(T.firstTree);
    this.check();
    return true;
  }

  chop(): boolean {
    if (!this.s.f.cap) return false;
    this.addWood(1);
    return true;
  }

  plantTimber(): boolean {
    const s = this.s, c = timberCost(s.timber);
    if (s.level < 1 || s.fruit < c) return false;
    s.fruit -= c; s.timber += 1;
    if (s.timber === 1) this.say(T.firstTimber);
    return true;
  }

  expand(): boolean {
    const s = this.s, c = expandCost(s.level);
    if (!s.f.cap || s.fruit < c.fruit || s.wood < c.wood) return false;
    s.fruit -= c.fruit; s.wood -= c.wood; s.level += 1;
    this.say(s.level === 1 ? T.firstExpand(this.cap()) : T.expand(this.cap()));
    return true;
  }

  /** 手动熬一罐果酱 */
  cook(): boolean {
    const s = this.s;
    if (!s.f.jam || s.fruit < JAM_FRUIT || s.wood < JAM_WOOD || s.jam + 1 > this.jamCap()) return false;
    s.fruit -= JAM_FRUIT; s.wood -= JAM_WOOD; s.jam += 1;
    if (!s.f.cooked) { s.f.cooked = true; this.say(T.firstJar); }
    this.check();
    return true;
  }

  buildShop(): boolean {
    const s = this.s, c = workshopCost(s.shops);
    if (!s.f.cooked || s.money < c) return false;
    s.money -= c; s.shops += 1;
    if (s.shops === 1) this.say(T.firstShop);
    return true;
  }

  /** 卖一趟果酱给 nextBuyer()，返回卖掉的罐数 */
  sellJam(): number {
    const s = this.s;
    if (!s.f.cooked) return 0;
    const i = this.nextBuyer(), b = BUYERS[i];
    let jars = Math.min(this.lot() / JAM_FRUIT, Math.floor(s.jam + 1e-9));
    if (b.cap) jars = Math.min(jars, Math.floor(s.dem[i] / JAM_FRUIT));
    if (jars < 1) return 0;
    s.jam -= jars; s.money += jars * b.price / 100 * JAM_FRUIT * JAM_MULT;
    if (b.cap) s.dem[i] -= jars * JAM_FRUIT;
    return jars;
  }

  /** 卖一趟果给 nextBuyer()，返回卖掉的个数 */
  sell(): number {
    const s = this.s;
    if (!s.f.sell) return 0;
    const i = this.nextBuyer(), b = BUYERS[i];
    let q = Math.min(this.lot(), Math.floor((s.fruit + 1e-9) / BASE_LOT) * BASE_LOT);
    if (b.cap) q = Math.min(q, Math.floor(s.dem[i] / BASE_LOT) * BASE_LOT);
    if (q < BASE_LOT) return 0;
    s.fruit -= q; s.money += q * b.price / 100;
    if (b.cap) s.dem[i] -= q;
    if (!s.f.sold) { s.f.sold = true; this.say(T.firstSale); }
    return q;
  }

  buy(key: Shelf): boolean {
    const s = this.s, item = this.shelfItem(key);
    if (!item || !this.canAfford(item)) return false;
    s.money -= item.money; s.wood -= item.wood ?? 0; s[key] += 1;
    this.say(item.line);
    // 面子到了，新认识的买家一开始收得满
    if (key === 'lux') {
      for (let i = 1; i < BUYERS.length; i++) if (BUYERS[i].face === s.lux) s.dem[i] = BUYERS[i].cap;
    }
    this.check();
    return true;
  }
}
