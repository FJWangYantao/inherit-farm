// 游戏规则。这里不碰界面，游戏页面、节奏模拟和测试用的是同一套。

import {
  BASE_LOT, BUYERS, LADDER_BONUS, LUX, OFFLINE_EFFICIENCY, OFFLINE_MAX_SECONDS, OFFLINE_MIN_SECONDS,
  OFFLINE_REPORT_SECONDS, PROD, PROD_BONUS, SAW_BONUS, SELL_UNLOCK_TREES, TECH, TIMBER_RATE, TOOL_LADDER,
  TOOL_SAW, TOOL_STALL, TOOL_TALL_LADDER, TOOLS, TREE_RATE, TREE_UNLOCK_FRUIT, cap, expandCost, timberCost,
  treeCost, type ShopItem
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
  /** 卖果一趟最多卖多少个 */
  lot(): number { return this.s.tech >= 1 ? TECH[this.s.tech - 1].lot : BASE_LOT; }
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
      case 'tech': return s.tools >= TOOLS.length ? TECH[s.tech] : undefined;
      case 'lux': return s.tech >= 1 ? LUX[s.lux] : undefined;
      case 'prod': return s.lux >= 1 ? PROD[s.prod] : undefined;
    }
  }
  canAfford(item: ShopItem | undefined): boolean {
    return !!item && this.s.money >= item.money && this.s.wood >= (item.wood ?? 0);
  }

  // ---- 产出 ----

  /** 果子放不下的部分卖给出价高、还收得下的买家，剩下的给村口。返回卖到的钱。 */
  private sellOverflow(x: number): number {
    const s = this.s;
    let got = 0;
    for (let i = BUYERS.length - 1; i >= 1 && x > 0; i--) {
      if (!this.knows(i) || s.dem[i] <= 0) continue;
      const q = Math.min(x, s.dem[i]);
      s.dem[i] -= q; x -= q; got += q * BUYERS[i].price / 100;
    }
    got += x * BUYERS[0].price / 100;
    s.money += got;
    return got;
  }
  /** 返回果摊卖到的钱 */
  private addFruit(x: number): number {
    const s = this.s, c = this.cap();
    let got = 0;
    s.fruit += x;
    if (s.fruit > c) {
      if (this.hasStall()) got = this.sellOverflow(s.fruit - c);
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
    if (!s.f.end && s.tech === TECH.length && s.lux === LUX.length && s.prod === PROD.length) {
      s.f.end = true; this.say(T.end);
    }
  }

  private step(dt: number): number {
    const s = this.s;
    for (let i = 1; i < BUYERS.length; i++) {
      if (this.knows(i)) s.dem[i] = Math.min(BUYERS[i].cap, s.dem[i] + BUYERS[i].refill * dt);
    }
    const got = this.addFruit(this.fruitRate() * dt);
    this.addWood(this.woodRate() * dt);
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
