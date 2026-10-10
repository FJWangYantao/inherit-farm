import { BASE_LOT, LAUNCH_COST, LAUNCH_MAX, LAUNCH_SECONDS, LAUNCH_YIELD, SELL_UNLOCK_TREES, expandCost } from '../balance';
import type { Amounts, ProductId, Show, TabId } from '../defs';
import { clock, fmt } from '../format';
import type { Game } from '../game';
import { BUYERS, PRODUCT } from './shop';

/** 手动操作的按钮：摘果、砍柴、卖果…… */
export interface ActionDef {
  id: string;
  name: string;
  tab: TabId;
  show: Show;
  /** 摘果那样的大按钮 */
  main?: boolean;
  intro?: string;
  /** 按钮上的小字 */
  desc: (g: Game) => string;
  /** 要花的东西，显示在按钮右边 */
  cost?: (g: Game) => Amounts;
  can: (g: Game) => boolean;
  run: (g: Game) => unknown;
}

function sellDesc(g: Game, product: ProductId): string {
  const i = g.nextBuyer(product), p = PRODUCT.get(product)!;
  const price = g.unitPrice(i, product) * p.units;
  return product === 'fruit'
    ? `${BUYERS[i].name} · 100 个换 ${fmt(price * 100)} 钱`
    : `${BUYERS[i].name} · 1 ${p.unit}换 ${fmt(price)} 钱`;
}

/** 卖加工品的按钮，做出第一份以后出现在集市 */
function sellAction(product: ProductId, name: string): ActionDef {
  const p = PRODUCT.get(product)!;
  return {
    id: p.action, name, tab: 'market', show: g => g.s.made.includes(product),
    desc: g => sellDesc(g, product), can: g => g.s.res[p.res] >= 1, run: g => g.sell(product)
  };
}

export const ACTIONS: ActionDef[] = [
  { id: 'pick', name: '摘果', tab: 'farm', main: true, show: () => true,
    desc: () => '', can: () => true, run: g => g.pick() },
  { id: 'chop', name: '砍柴', tab: 'farm', show: g => g.s.f.cap,
    desc: () => '+1 木头', can: g => g.s.res.wood < g.cap('wood'), run: g => g.gather('wood') },
  { id: 'expand', name: '扩建仓库', tab: 'farm', show: g => g.s.f.cap,
    desc: g => `上限 ${fmt(g.warehouse())} → ${fmt(g.warehouse() * 5)}`, cost: g => expandCost(g.s.level),
    can: g => { const c = expandCost(g.s.level); return g.s.res.fruit >= c.fruit && g.s.res.wood >= c.wood; },
    run: g => g.expand() },
  { id: 'sell', name: '卖果', tab: 'farm', show: g => g.count('tree') >= SELL_UNLOCK_TREES,
    intro: '果香飘到了村口，有人来问你卖不卖。',
    desc: g => g.face() >= 1 ? sellDesc(g, 'fruit') : '100 果子 换 10 钱',
    can: g => g.s.res.fruit >= BASE_LOT, run: g => g.sell('fruit') },
  { id: 'dig', name: '挖土', tab: 'farm', show: g => g.has('brickmaking'),
    desc: () => '+1 黏土', can: g => g.s.res.clay < g.cap('clay'), run: g => g.gather('clay') },
  { id: 'sellJam', name: '卖果酱', tab: 'farm', show: g => g.s.f.cooked,
    desc: g => sellDesc(g, 'jam'), can: g => g.s.res.jam >= 1, run: g => g.sell('jam') },
  { id: 'read', name: '看书', tab: 'study', show: g => g.isSeen('b:library'),
    desc: () => '+1 农技', can: g => g.s.res.science < g.cap('science'), run: g => g.gather('science') },
  { id: 'patrol', name: '巡园记录', tab: 'study', show: g => g.s.f.smart,
    desc: () => '+1 数据', can: g => g.s.res.data < g.cap('data'), run: g => g.gather('data') },
  { id: 'launch', name: '送种子上天', tab: 'study', show: g => g.has('spaceBreeding'),
    desc: g => {
      const n = g.s.launches.length;
      return n ? `天上有 ${n} 批 · 下一批 ${clock(g.nextLanding())} 后回来` : `${LAUNCH_SECONDS / 60} 分钟后带回 ${LAUNCH_YIELD} 颗太空种子，最多 ${LAUNCH_MAX} 批`;
    },
    cost: () => LAUNCH_COST, can: g => g.canLaunch(), run: g => g.launch() },
  sellAction('dried', '卖果干'),
  sellAction('juice', '卖果汁'),
  sellAction('wine', '卖果酒')
];
