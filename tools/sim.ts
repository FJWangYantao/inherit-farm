// 节奏模拟：用一套固定打法把游戏从头跑一遍，打印每个节点出现的时间。
// 直接用游戏本体的规则和数值（src/game），改了数值不用再同步。
//
//     npm run sim             从头打到买完所有东西
//     npm run sim -- --away   另外算一下各个节点离开 8 小时回来能拿多少
//
// 打法：
// - 前 5 棵树之前每秒手动摘 3 下；果子够就种树。
// - 仓库第一次满时每秒砍 3 下柴，够扩建就扩建。
// - 林木数量按仓库等级种到 TIMBER_PLAN。
// - 出现卖果以后，优先攒钱买五金店的四件工具。
// - 买完高梯以后，产出的果子一半留着种树和扩建，一半拿去卖；三个货架里哪件最便宜就先买哪件。
//
// 真人会更聪明（比如先买汽车再买电动三轮），所以时间只用来比较改动前后的快慢。

import { TOOLS, cap, expandCost, timberCost, treeCost } from '../src/game/config';
import { clock, fmt } from '../src/game/format';
import { Game, type Shelf } from '../src/game/game';
import { fresh } from '../src/game/state';

const DT = 0.05;
const CLICKS_PER_SECOND = 3;
const TIMBER_PLAN: Record<number, number> = { 1: 3, 2: 5, 3: 8, 4: 12, 5: 16 };
const SELL_SHARE = 0.5;
const MAX_SECONDS = 6 * 3600;

interface Event { t: number; text: string; game: Game }

function run(): Event[] {
  const g = new Game(fresh(0));
  const s = g.s;
  const events: Event[] = [];
  const log = (text: string) => events.push({ t, text, game: new Game(structuredClone(s)) });
  let t = 0, clicks = 0, chops = 0, toSell = 0;
  let sawSell = false;

  while (t < MAX_SECONDS) {
    // 手动点击
    if (s.trees < 5) clicks += CLICKS_PER_SECOND * DT;
    for (; clicks >= 1; clicks--) g.pick();
    if (s.level === 0 && s.f.cap && s.wood < expandCost(0).wood) chops += CLICKS_PER_SECOND * DT;
    for (; chops >= 1; chops--) g.chop();

    const stage5 = s.tools >= TOOLS.length;
    if (stage5) toSell += g.fruitRate() * DT * SELL_SHARE;
    g.tick(DT);
    t += DT;

    if (!sawSell && s.f.sell) { sawSell = true; log('卖果出现'); }

    if (stage5) {
      // 攒够一整趟再卖，卖掉的量才接近产出的一半
      while (toSell >= g.lot()) {
        const q = g.sell();
        if (!q) break;
        toSell = Math.max(0, toSell - q);
      }
      const shelves = (['tech', 'lux', 'prod'] as Shelf[])
        .map(key => ({ key, item: g.shelfItem(key) }))
        .filter(x => x.item)
        .sort((a, b) => a.item!.money - b.item!.money);
      if (!shelves.length) break;
      const { key, item } = shelves[0];
      if (g.buy(key)) log(`${item!.name}（${fmt(item!.money)} 钱），果子每秒 ${g.fruitRate().toFixed(0)}`);
    }

    // 果子的去处：工具 > 林木 > 果树 > 扩建
    for (let changed = true; changed;) {
      changed = false;
      const c = cap(s.level);
      if (s.f.sell && s.tools < TOOLS.length) {
        const tool = TOOLS[s.tools];
        if (s.money < tool.money) {
          if (g.sell()) changed = true;
          continue;
        }
        if (g.buy('tools')) { log(tool.name); changed = true; continue; }
      }
      if (s.level >= 1 && s.timber < (TIMBER_PLAN[s.level] ?? 20) && timberCost(s.timber) <= c) {
        if (g.plantTimber()) changed = true;
        continue;
      }
      if (treeCost(s.trees) <= c) {
        if (g.plant()) {
          if (s.trees === 1) log('第一棵树');
          changed = true;
        }
        continue;
      }
      if (g.expand()) {
        log(`第 ${s.level} 次扩建，上限 ${fmt(g.cap())}（果树 ${s.trees}，林木 ${s.timber}）`);
        changed = true;
      }
    }
  }
  return events;
}

/** 从某个节点的状态离开 hours 小时，回来多了多少钱 */
function awayGain(from: Game, hours: number): number {
  const g = new Game(structuredClone(from.s));
  const m0 = g.s.money;
  g.catchUp(hours * 3600);
  return g.s.money - m0;
}

const events = run();
const showAway = process.argv.includes('--away');
for (const e of events) {
  let line = `${clock(e.t).padStart(7)}  ${e.text}`;
  if (showAway && e.game.s.f.sold) line += `    离开 8 小时 +${fmt(awayGain(e.game, 8))} 钱`;
  console.log(line);
}
