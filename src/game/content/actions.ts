import { BASE_LOT, SELL_UNLOCK_TREES, expandCost } from '../balance';
import type { Amounts, Show, TabId } from '../defs';
import { fmt } from '../format';
import type { Game } from '../game';
import { BUYERS, PRODUCTS } from './shop';

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

function sellDesc(g: Game, product: 'fruit' | 'jam'): string {
  const b = BUYERS[g.nextBuyer()], p = PRODUCTS[product];
  const price = b.price * p.mult * g.priceMult();
  return product === 'fruit'
    ? `${b.name} · 100 个换 ${fmt(price)} 钱`
    : `${b.name} · 1 罐换 ${fmt(price * p.units / 100)} 钱`;
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
    desc: () => '+1 农技', can: g => g.s.res.science < g.cap('science'), run: g => g.gather('science') }
];
