import { BUYERS } from './config';
import { T } from './text';

/** 只出现一次的节点，出现过就记下来 */
export interface Flags {
  /** 出现 [种树] */
  tree: boolean;
  /** 仓库第一次满，出现木头、[砍柴]、[扩建仓库] */
  cap: boolean;
  /** 出现 [卖果] */
  sell: boolean;
  /** 第一次卖出，出现钱和五金店 */
  sold: boolean;
  /** 出现 [熬果酱] */
  jam: boolean;
  /** 熬出过第一罐果酱，出现 [建作坊] */
  cooked: boolean;
  /** 果酱第一次放满，冷藏车上货架 */
  jamFull: boolean;
  /** 所有东西都买完了 */
  end: boolean;
}

/** 存档里的全部内容。加字段时在 fresh() 里给默认值，旧存档读进来会自动补上。 */
export interface GameState {
  fruit: number;
  wood: number;
  money: number;
  trees: number;
  timber: number;
  /** 果酱罐数 */
  jam: number;
  /** 果酱作坊间数 */
  shops: number;
  /** 仓库扩建过几次 */
  level: number;
  /** TOOLS、TECH、LUX、PROD 各买到第几件 */
  tools: number;
  tech: number;
  lux: number;
  prod: number;
  /** 每个买家还收多少个果子，下标对应 BUYERS */
  dem: number[];
  f: Flags;
  /** 故事栏，最新的在前 */
  log: string[];
  /** 已玩秒数，不含离线 */
  played: number;
  /** 上次存档的时间戳（毫秒），用来算离线多久 */
  last: number;
}

export const LOG_LENGTH = 8;

export function fresh(now = Date.now()): GameState {
  return {
    fruit: 0, wood: 0, money: 0, trees: 0, timber: 0, jam: 0, shops: 0, level: 0,
    tools: 0, tech: 0, lux: 0, prod: 0, dem: BUYERS.map(() => 0),
    f: { tree: false, cap: false, sell: false, sold: false, jam: false, cooked: false, jamFull: false, end: false },
    log: [T.start],
    played: 0, last: now
  };
}
