// 不属于某一件东西的全局数值。具体建筑、科技、商品的数值在 content/ 下。

import type { SeasonProfile } from './defs';

// ---- 开局 ----
/** 果子到这个数出现 [种树] */
export const TREE_UNLOCK_FRUIT = 10;
/** 果树到这个数出现 [卖果] */
export const SELL_UNLOCK_TREES = 30;
/** 卖果的最小单位，也是没有手推车时一趟的数量 */
export const BASE_LOT = 100;

// ---- 仓库 ----
/** 仓库上限：100、500、2,500……每扩建一次 ×5 */
export function warehouseCap(level: number): number {
  return 100 * Math.pow(5, level);
}
/** 前三次扩建要的木头，之后是上限的 40% */
export const WOOD_FOR_EXPAND = [20, 200, 1000];
export const WOOD_SHARE_AFTER = 0.4;
/** 扩建要一整仓果子加木头 */
export function expandCost(level: number): { fruit: number; wood: number } {
  const w = WOOD_FOR_EXPAND[level];
  return { fruit: warehouseCap(level), wood: w !== undefined ? w : Math.round(warehouseCap(level) * WOOD_SHARE_AFTER) };
}

// ---- 帮工 ----
/** 每个帮工每秒吃几个果子 */
export const FOOD_PER_WORKER = 0.5;
/** 有空床位、有果子时，多少秒来一个人 */
export const ARRIVE_SECONDS = 15;
/** 果子吃光以后，多少秒走一个人 */
export const LEAVE_SECONDS = 10;
/** 帮工到几个人出现书屋和看书 */
export const STUDY_UNLOCK_WORKERS = 3;

// ---- 心情 ----
/** 帮工到这么多人开始有心情，超过的每多一个人心情少 MOOD_PER_WORKER */
export const MOOD_FREE_WORKERS = 20;
export const MOOD_PER_WORKER = 0.008;
/** 心情最低最高 */
export const MOOD_MIN = 0.3;
export const MOOD_MAX = 1.5;
/** 仓库里每有一种加工品（果酱、果干、果汁、果酒），心情加多少 */
export const VARIETY_MOOD = 0.05;

// ---- 季节和天气 ----
export const SEASON_SECONDS = 300;
export const SEASONS = ['春', '夏', '秋', '冬'] as const;
/** 苹果树、林木这类普通果树的季节倍数 */
export const ORCHARD_SEASON: SeasonProfile = [1, 1.25, 1.5, 0];
export const FARMER_SEASON: SeasonProfile = [1, 1, 1.25, 0.5];

export interface Weather {
  name: string;
  /** 天气影响的东西乘以这个数 */
  mult: number;
  /** 出现的概率 */
  chance: number;
  /** 故事栏里的一句话 */
  line: string;
  /** 研究了「灌溉」后不受影响 */
  drought?: boolean;
}
/** 第 0 个是正常天气 */
export const WEATHERS: Weather[] = [
  { name: '', mult: 1, chance: 0.8, line: '' },
  { name: '丰年', mult: 1.25, chance: 0.1, line: '风调雨顺，今季是个丰年。' },
  { name: '旱灾', mult: 0.7, chance: 0.1, line: '好久没下雨了，果树蔫蔫的。', drought: true }
];
/** 冬天的坏天气叫寒潮，不受灌溉影响 */
export const WINTER_BAD = { name: '寒潮', line: '寒潮来了，地里冻得硬邦邦。' };

// ---- 离线 ----
/** 离开的时间最多算这么久，按 OFFLINE_EFFICIENCY 折算 */
export const OFFLINE_MAX_SECONDS = 12 * 3600;
export const OFFLINE_EFFICIENCY = 1;
/** 离开不到这么久不算离线，照常推进 */
export const OFFLINE_MIN_SECONDS = 5;
/** 离开超过这么久，回来时故事栏报一句收获 */
export const OFFLINE_REPORT_SECONDS = 60;
