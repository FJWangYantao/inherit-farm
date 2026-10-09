import { BUILDINGS, JOBS } from './content/buildings';
import { RES_IDS } from './content/resources';
import { BUYERS, SHELVES } from './content/shop';
import type { ResId } from './defs';
import { T } from './text';

/** 只发生一次的事件 */
export interface Flags {
  /** 仓库第一次满，出现木头、[砍柴]、[扩建仓库] */
  cap: boolean;
  /** 第一次卖出，出现钱和集市 */
  sold: boolean;
  /** 熬出过第一罐果酱，出现果酱作坊 */
  cooked: boolean;
  /** 果酱第一次放满，冷藏车上货架 */
  jamFull: boolean;
  /** 帮工多到开始有心情 */
  mood: boolean;
  /** 销路饱和了：买家收得越满出价越低 */
  market: boolean;
  /** 见过第一个冬天 */
  winter: boolean;
  /** 正在挨饿（用来只报一次「果子吃光了」） */
  hungry: boolean;
  /** 所有东西都买完、研究完了 */
  end: boolean;
}

export interface Calendar {
  /** 第一个帮工来了以后才有季节 */
  on: boolean;
  /** 日历开始以后过了多少秒 */
  t: number;
  /** 当前季节的天气，WEATHERS 的下标；寒潮记作 -1 */
  weather: number;
  /** 天气用的随机数状态，存在存档里，离线补算和在线结果一样 */
  rng: number;
}

/** 存档里的全部内容。加字段时在 fresh() 里给默认值，旧存档读进来会自动补上。 */
export interface GameState {
  res: Record<ResId, number>;
  /** 每种建筑盖了几个，键是 BUILDINGS 的 id */
  b: Record<string, number>;
  /** 每个岗位派了几个人，键是 JOBS 的 id */
  jobs: Record<string, number>;
  /** 帮工总数，没派活的是闲着的 */
  workers: number;
  /** 仓库扩建过几次 */
  level: number;
  /** 每个货架卖到第几件，键是 SHELVES 的 id */
  shelves: Record<string, number>;
  /** 研究完的科技，按研究的先后 */
  techs: string[];
  /** 手工做过的东西（CRAFTS 的 id），做过第一个才出现对应的作坊 */
  made: string[];
  /** 每个买家还收多少个果子，下标对应 BUYERS */
  dem: number[];
  /** 出现过的东西，按出现的先后。页面按这个顺序排，所以新东西永远加在最后 */
  seen: string[];
  f: Flags;
  cal: Calendar;
  /** 帮工来、走的计时（秒） */
  timer: { arrive: number; leave: number };
  /** 故事栏，最新的在前 */
  log: string[];
  /** 已玩秒数，不含离线 */
  played: number;
  /** 上次存档的时间戳（毫秒），用来算离线多久 */
  last: number;
}

export const LOG_LENGTH = 8;

function zeros<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;
}

export function fresh(now = Date.now(), seed = 20240601): GameState {
  return {
    res: zeros(RES_IDS),
    b: zeros(BUILDINGS.map(b => b.id)),
    jobs: zeros(JOBS.map(j => j.id)),
    workers: 0,
    level: 0,
    shelves: zeros(SHELVES.map(s => s.id)),
    techs: [],
    made: [],
    dem: BUYERS.map(() => 0),
    seen: ['tab:farm', 'res:fruit', 'act:pick'],
    f: { cap: false, sold: false, cooked: false, jamFull: false, mood: false, market: false, winter: false, hungry: false, end: false },
    cal: { on: false, t: 0, weather: 0, rng: seed },
    timer: { arrive: 0, leave: 0 },
    log: [T.start],
    played: 0,
    last: now
  };
}
