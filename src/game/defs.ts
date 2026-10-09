// 内容表的类型。具体内容在 content/ 下，引擎在 game.ts。

import type { Game } from './game';

export type ResId =
  | 'fruit' | 'wood' | 'money' | 'clay' | 'science' | 'plank' | 'brick' | 'jam';

export type TabId = 'farm' | 'market' | 'crew' | 'study' | 'craft' | 'home';

/** 资源数量，比如 { wood: 100, money: 50 } */
export type Amounts = Partial<Record<ResId, number>>;

/** 春夏秋冬四季的产量倍数 */
export type SeasonProfile = readonly [number, number, number, number];

/** 判断某样东西现在该不该出现。出现过一次就一直在（记在存档的 seen 里）。 */
export type Show = (g: Game) => boolean;

/** 加成。科技、工具、奢侈品买下以后生效。 */
export interface Effects {
  /** 产量组的倍数：{ orchard: 0.5 } 表示果园产量 ×1.5。同一组的多个加成相乘 */
  mult?: Record<string, number>;
  /** 资源上限的倍数，同上 */
  capMult?: Amounts;
  /** 开关类效果，比如果摊、冷藏车 */
  flags?: string[];
  /** 卖一趟最多卖多少个 */
  lot?: number;
  /** 面子 */
  face?: number;
}

export interface ResDef {
  id: ResId;
  name: string;
  show: Show;
  /** 上限：返回 Infinity 表示不设上限 */
  cap: (g: Game) => number;
  /** 第一次出现时故事栏的一句话 */
  intro?: string;
}

/** 可以重复盖、价格按指数涨的东西：果树、工棚、书屋、作坊…… */
export interface BuildingDef {
  id: string;
  name: string;
  tab: TabId;
  /** 按钮上的一行说明 */
  desc: string;
  cost: Amounts;
  /** 每多一个，价格乘以这个数 */
  ratio: number;
  show: Show;
  intro?: string;
  /** 盖第一个时故事栏的一句话 */
  first?: string;
  /** 每个每秒产出 */
  prod?: Amounts;
  /** 每个每秒消耗。有消耗的是加工建筑，原料不够或产品放不下就按比例减速 */
  use?: Amounts;
  /** 产量组，决定吃哪些加成 */
  group?: string;
  /** 季节倍数，不写就是四季一样 */
  season?: SeasonProfile;
  /** 天气影不影响它 */
  weather?: boolean;
  /** 每个加多少上限 */
  caps?: Amounts;
  /** 每个住几个帮工 */
  housing?: number;
  /** 每个给某个产量组加多少，比如书屋 { study: 0.05 } 是农技员 +5%。同一组的加在一起 */
  boost?: Record<string, number>;
}

export interface JobDef {
  id: string;
  name: string;
  desc: string;
  show: Show;
  intro?: string;
  /** 每人每秒产出 */
  prod: Amounts;
  group?: string;
  season?: SeasonProfile;
  weather?: boolean;
  /** 推销员：每人每秒按最好的价卖掉多少个果子 */
  sells?: number;
}

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  cost: Amounts;
  /** 要先研究完的科技 */
  deps: string[];
  /** 除了前置以外的出现条件 */
  show?: Show;
  /** 出现时的一句话 */
  intro?: string;
  /** 研究完时的一句话 */
  line: string;
  effects?: Effects;
}

/** 货架上一次摆一件、买完换下一件的东西 */
export interface ShopItem {
  id: string;
  name: string;
  cost: Amounts;
  desc: string;
  line: string;
  effects?: Effects;
  /** 要先研究的科技或先出现的节点，满足了才摆上货架 */
  need?: Show;
  /** 奢侈品：买下以后在家里那行字的描述 */
  own?: string;
  /** 货架标题，不写就用货架的 */
  label?: string;
}

export interface ShelfDef {
  id: string;
  tab: TabId;
  label: string;
  items: ShopItem[];
  show: Show;
}

export interface CraftDef {
  id: string;
  name: string;
  /** 做一个要的原料 */
  cost: Amounts;
  out: ResId;
  show: Show;
  intro?: string;
}

export interface Buyer {
  name: string;
  /** 需要多少面子才认识 */
  face: number;
  /** 每 100 个果子给多少钱 */
  price: number;
  /** 最多收多少个，0 表示不限量 */
  cap: number;
  /** 收购量每秒恢复多少个 */
  refill: number;
  remark: string;
}

/** 能卖的东西：一份按多少个果子算、价钱是果子的几倍 */
export interface Product {
  res: ResId;
  /** 一份占买家多少个果子的收购量 */
  units: number;
  /** 价钱倍数 */
  mult: number;
}

export interface TabDef {
  id: TabId;
  name: string;
  show: Show;
}
