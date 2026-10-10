// 一个一直在线、反应很快的玩家。节奏模拟（tools/sim.ts）和界面测试都用它来推进游戏。
//
// 打法：
// - 前 5 棵树之前每秒手动摘 3 下；仓库第一次满时砍柴扩建；有了书屋、黏土以后，没人干活时手动看书、挖土。
// - 卖果：五金店前四件买齐之前，缺钱就卖；之后每秒卖掉产出的一半，但留够过冬的口粮。
// - 有出价比王婶高、还收得下的买家，就把加工品和仓库三成以上的果子卖给他；加工品放满了连王婶也卖。
// - 帮工按比例分：果农 3、伐木工 2、农技员 3、挖土工 1、推销员 1（没出现的岗位不算）。
// - 能研究的科技挑最便宜的研究；货架上的东西买得起就买。
// - 建筑：果树、林木价钱不超过仓库上限就种；其他建筑要等手里每样资源都至少是价钱的 2 倍（钱要 4 倍，给大件留着）才盖，
//   加工建筑还要原料供得上（作坊加起来最多用掉果子产量的一半）。
// - 每样加工品先手工做一份；木板、砖手里不到上限一半时，每秒用掉一成能做的量去做。
// - 集市商人：化肥不够 10 分钟用就去换；果酱有 500 罐以上、苗木不够种下一棵良种果树时换苗木。

import { BASE_LOT, FOOD_PER_WORKER, SEASON_SECONDS, expandCost } from '../src/game/balance';
import { BUILDINGS, JOBS, SHELVES, TECHS } from '../src/game/content';
import { PRODUCTS } from '../src/game/content/shop';
import type { BuildingDef, ResId } from '../src/game/defs';
import type { Game } from '../src/game/game';

const CLICKS_PER_SECOND = 3;
const DECIDE_SECONDS = 5;
const SELL_SHARE = 0.5;
const JOB_WEIGHTS: Record<string, number> = { farmer: 3, woodcutter: 2, scholar: 3, digger: 1, seller: 1 };

export interface BotEvents {
  built?: (id: string, n: number) => void;
  expanded?: (level: number) => void;
}

export class Bot {
  private clicks = 0;
  private toSell = 0;
  private lastWorkers = -1;
  private lastSeen = 0;
  private sinceDecide = 0;
  /** 饿跑了几个帮工 */
  left = 0;

  constructor(private g: Game, private on: BotEvents = {}) {}

  /** 玩 dt 秒（建议 0.5） */
  play(dt: number): void {
    const g = this.g, s = g.s;
    this.clicks += CLICKS_PER_SECOND * dt;
    for (; this.clicks >= 1; this.clicks--) {
      if (g.count('tree') < 5) g.pick();
      if (s.level === 0 && s.f.cap && s.res.wood < expandCost(0).wood) g.gather('wood');
      if (g.isSeen('act:read') && !(s.jobs.scholar > 0)) g.gather('science');
      if (g.isSeen('act:dig') && !(s.jobs.digger > 0) && s.res.clay < 200) g.gather('clay');
    }

    const fruitRate = Math.max(0, g.rates().fruit), w0 = s.workers;
    g.tick(dt);
    if (s.workers < w0) this.left += w0 - s.workers;

    if (s.workers !== this.lastWorkers || s.seen.length !== this.lastSeen) {
      this.assignJobs();
      this.lastWorkers = s.workers;
      this.lastSeen = s.seen.length;
    }

    const early = !g.owns('tallLadder');
    if (early) {
      const item = g.shelfItem('hardware');
      while (item && s.res.money < (item.cost.money ?? 0) && g.sell('fruit')) { /* 缺钱就卖 */ }
    } else {
      const reserve = s.workers * FOOD_PER_WORKER * SEASON_SECONDS * 1.5;
      this.toSell = Math.min(this.toSell + fruitRate * SELL_SHARE * dt, g.lot() * 2);
      while (this.toSell >= Math.min(g.lot(), 100000) && s.res.fruit - BASE_LOT >= reserve) {
        const q = g.sell('fruit');
        if (!q) break;
        this.toSell -= q;
      }
    }
    // 有出价比王婶高、还收得下的买家，就把加工品卖给他；放满了就连王婶也卖
    for (const p of PRODUCTS) {
      if (p.id === 'fruit') continue;
      while (s.res[p.res] >= 1 && g.nextBuyer(p.id) !== 0 && g.sell(p.id)) { /* 卖给好买家 */ }
      if (g.cap(p.res) > 0 && s.res[p.res] >= g.cap(p.res) - 1e-9) while (g.sell(p.id)) { /* 卖空 */ }
    }
    if (!early) {
      const reserve = s.workers * FOOD_PER_WORKER * SEASON_SECONDS * 1.5;
      while (s.res.fruit - BASE_LOT >= reserve + g.cap('fruit') * 0.3 && g.nextBuyer('fruit') !== 0 && g.sell('fruit')) { /* 同上 */ }
    }

    // 买东西、分人手这些决定每 DECIDE_SECONDS 秒做一次（前期反应快一点）
    this.sinceDecide += dt;
    if (!early && this.sinceDecide < DECIDE_SECONDS) return;
    this.sinceDecide = 0;

    if (early) g.buyShelf('hardware');
    for (const tech of TECHS.filter(x => g.isSeen('tech:' + x.id) && !g.has(x.id))
      .sort((a, b) => (a.cost.science ?? 0) - (b.cost.science ?? 0))) {
      g.research(tech.id);
    }
    if (!early) for (const shelf of SHELVES) g.buyShelf(shelf.id);

    for (let changed = true; changed;) {
      changed = false;
      for (const b of BUILDINGS) {
        if (!g.isSeen('b:' + b.id)) continue;
        const cost = g.costOf(b.id);
        const ok = b.id === 'tree' || b.id === 'timber'
          ? (cost.fruit ?? 0) <= g.cap('fruit') && g.canPay(cost)
          : g.canPay(cost, 2) && (!cost.money || g.canPay({ money: cost.money }, 4)) && this.canFeed(b);
        if (ok && g.build(b.id)) { changed = true; this.on.built?.(b.id, g.count(b.id)); }
      }
      if (g.isSeen('act:expand') && g.expand()) { changed = true; this.on.expanded?.(s.level); }
    }

    // 每样加工品先手工做一份，作坊才会出现
    for (const c of ['jam', 'dried', 'juice', 'wine']) if (g.isSeen('craft:' + c) && !s.made.includes(c)) g.craft(c, 1);
    // 集市商人：化肥不够 10 分钟用就换；果酱有富余、苗木不够种下一棵良种果树就换
    if (g.isSeen('craft:fertilizer') && s.res.fertilizer < g.fertNeed() * 600 && s.res.money > 1e6) {
      g.craft('fertilizer', Math.ceil((g.fertNeed() * 600 - s.res.fertilizer) / 20));
    }
    if (g.isSeen('craft:seedling') && s.res.jam >= 500 && s.res.seedling < (g.costOf('elite').seedling ?? 1) * 2) {
      g.craft('seedling', 1);
    }
    for (const c of ['plank', 'brick'] as const) {
      if (g.isSeen('craft:' + c) && s.res[c] < g.cap(c) / 2) g.craft(c, Math.ceil(g.craftable(c) / 10));
    }
  }

  /** 加工建筑：再盖一个以后原料还供得上（果子最多拿出产量的一半给作坊，其他原料不能入不敷出） */
  private canFeed(b: BuildingDef): boolean {
    if (!b.use) return true;
    const { prod, use } = this.g.flows(), k = this.g.prodMult(b);
    for (const [r, v] of Object.entries(b.use) as [ResId, number][]) {
      const after = use[r] + v * k;
      if (after > prod[r] * (r === 'fruit' ? 0.5 : 0.9)) return false;
    }
    return true;
  }

  private assignJobs(): void {
    const g = this.g, s = g.s;
    const open = JOBS.filter(j => g.isSeen('job:' + j.id) && JOB_WEIGHTS[j.id]);
    const total = open.reduce((a, j) => a + JOB_WEIGHTS[j.id], 0);
    if (!total) return;
    // 先全部收回，再按比例分；余数从前往后补
    for (const j of JOBS) g.assign(j.id, -(s.jobs[j.id] ?? 0));
    for (const j of open) g.assign(j.id, Math.floor(s.workers * JOB_WEIGHTS[j.id] / total));
    for (const j of open) if (g.idle() > 0) g.assign(j.id, 1);
  }
}
