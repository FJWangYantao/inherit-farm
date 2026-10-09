// 节奏模拟：用 tools/bot.ts 的固定打法把游戏从头跑一遍，打印每个节点出现的时间。
// 直接用游戏本体的规则和数值（src/game），改了数值不用再同步。
//
//     npm run sim                 打到买完所有东西，最多 72 小时
//     npm run sim -- --hours 24   只跑前 24 小时
//     npm run sim -- --all        连建筑每盖到 10、25、50 个也打印
//
// 真人会更聪明，时间只用来比较改动前后的快慢。

import { BUILDING, SHELVES, TECH, TECHS, entryKind, TAB } from '../src/game/content';
import type { TabId } from '../src/game/defs';
import { clock, fmt } from '../src/game/format';
import { Game } from '../src/game/game';
import { fresh } from '../src/game/state';
import { Bot } from './bot';

const DT = 0.5;
const MILESTONES = [10, 25, 50, 100, 200];

const args = process.argv.slice(2);
const hoursArg = args.indexOf('--hours');
const MAX_SECONDS = (hoursArg >= 0 ? Number(args[hoursArg + 1]) : 72) * 3600;
const SHOW_ALL = args.includes('--all');

const g = new Game(fresh(0));
const s = g.s;
let t = 0;
const out: string[] = [];
const log = (text: string) => out.push(`${clock(t).padStart(8)}  ${text}`);
const bot = new Bot(g, {
  built: (id, n) => { if (n === 1 || (SHOW_ALL && MILESTONES.includes(n))) log(`盖了第 ${n} 个${BUILDING.get(id)!.name}`); },
  expanded: level => log(`第 ${level} 次扩建，仓库 ${fmt(g.warehouse())}`)
});

let lastSeen = 0, lastHour = 0;
const shownTechs = new Set<string>();
const shownItems = new Set<string>();

while (t < MAX_SECONDS && !s.f.end) {
  bot.play(DT);
  t += DT;

  for (; lastSeen < s.seen.length; lastSeen++) {
    const { kind, id } = entryKind(s.seen[lastSeen]);
    if (kind === 'tab') log(`【${TAB.get(id as TabId)!.name}】页出现`);
  }
  for (const id of s.techs) {
    if (shownTechs.has(id)) continue;
    shownTechs.add(id);
    log(`研究完：${TECH.get(id)!.name}`);
  }
  for (const shelf of SHELVES) {
    const n = s.shelves[shelf.id], key = shelf.id + n;
    if (n > 0 && !shownItems.has(key)) {
      shownItems.add(key);
      const item = shelf.items[n - 1];
      log(`买了：${item.name}（${fmt(item.cost.money ?? 0)} 钱）`);
    }
  }
  if (t - lastHour >= 3600) {
    lastHour = t;
    const r = g.rates();
    out.push(`         ── 第 ${Math.round(t / 3600)} 小时：帮工 ${s.workers}，果子 ${fmt(r.fruit)}/秒，钱 ${fmt(s.res.money)}，` +
      `农技 ${fmt(s.res.science)}/${fmt(g.cap('science'))}，心情 ${Math.round(g.mood() * 100)}%，饿跑 ${bot.left}`);
  }
}

console.log(out.join('\n'));
const rest = [
  ...TECHS.filter(x => !g.has(x.id)).map(x => x.name),
  ...SHELVES.flatMap(sh => sh.items.slice(s.shelves[sh.id]).map(i => i.name))
];
console.log(s.f.end ? `\n买完所有东西：${clock(t)}` : `\n${clock(t)} 时还没买完，剩下：${rest.join('、')}`);
