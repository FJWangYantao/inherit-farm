// 游戏里所有可调的数值都在这里。游戏本体、节奏模拟（tools/sim.ts）和测试都从这里读，只改这一处。

export interface ShopItem {
  name: string;
  money: number;
  /** 需要的木头，没有就是 0 */
  wood?: number;
  desc: string;
  /** 买下时故事栏出现的一句话 */
  line: string;
}

export interface TechItem extends ShopItem {
  /** 卖果一趟最多卖多少个，不改就不写 */
  lot?: number;
  /** 要先出现过这个节点才摆上货架（Flags 里的键） */
  need?: 'jamFull';
}

export interface LuxItem extends ShopItem {
  /** 果园下方那行字里的描述 */
  own: string;
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

/** 前三次扩建要的木头，之后是上限的 40% */
export const WOOD_FOR_EXPAND = [20, 200, 1000];
export const WOOD_SHARE_AFTER = 0.4;

/** 果子到这个数出现 [种树] */
export const TREE_UNLOCK_FRUIT = 10;
/** 果树到这个数出现 [卖果] */
export const SELL_UNLOCK_TREES = 30;
/** 没有手推车时卖果一趟的数量，也是卖果的最小单位 */
export const BASE_LOT = 100;

/** 每棵果树每秒产的果子 */
export const TREE_RATE = 1;
/** 每棵林木每秒产的木头 */
export const TIMBER_RATE = 0.5;

// 阶段 4：五金店一次卖一件
export const TOOLS: ShopItem[] = [
  { name: '梯子', money: 50, desc: '果树产量 +50%',
    line: '有了梯子，高处的果子也够得着了。' },
  { name: '锯子', money: 100, desc: '林木产量翻倍',
    line: '锯子比斧头快得多。' },
  { name: '果摊', money: 200, wood: 300, desc: '仓库满了以后，多出来的果子自动卖掉',
    line: '在路边支了个果摊。仓库放不下的果子摆在那儿，自己就卖掉了。' },
  { name: '高梯', money: 500, desc: '果树产量再 +50%',
    line: '卖果一趟一趟地背，太慢了。五金店里有手推车。' }
];
/** TOOLS 里各件的效果，按买下的件数判断 */
export const TOOL_LADDER = 1;
export const TOOL_SAW = 2;
export const TOOL_STALL = 3;
export const TOOL_TALL_LADDER = 4;
export const LADDER_BONUS = 1.5;
export const SAW_BONUS = 2;

// 阶段 5：三个货架，每件比前一件贵好几倍
export const TECH: TechItem[] = [
  { name: '手推车', money: 500, lot: 1000, desc: '卖果一趟最多卖 1,000 个',
    line: '有了手推车，一趟能拉一千个。手头宽裕了，也该置办点像样的东西。' },
  { name: '电动三轮', money: 8000, lot: 10000, desc: '卖果一趟最多卖 10,000 个',
    line: '电动三轮一趟能拉一万个。' },
  { name: '冷藏车', money: 600000, need: 'jamFull', desc: '果酱放满了以后，多出来的自动送去卖',
    line: '买了辆冷藏车。果酱放不下了，就直接拉去给买家。' },
  { name: '重型卡车', money: 3000000, lot: 1000000, desc: '卖果一趟最多卖 1,000,000 个',
    line: '重卡一趟能拉一百万个，买家那边得派人来卸货。' }
];
/** TECH 里冷藏车是第几件 */
export const TECH_COLD_TRUCK = 3;

// 奢侈品：每件面子 +1，面子够了就有新买家（BUYERS 的 face）
export const LUX: LuxItem[] = [
  { name: '一身新衣服', money: 1200, own: '穿着一身新衣服', desc: '面子 +1。穿得体面些，镇上的人才愿意跟你谈',
    line: '换了一身新衣服。镇上的小贩主动过来打招呼。' },
  { name: '二手桑塔纳', money: 12000, own: '门口停着一辆桑塔纳', desc: '面子 +1。开车去谈，大买家才肯见你',
    line: '开着桑塔纳去谈，批发商把你请进了屋。' },
  { name: '镇上一套房', money: 100000, own: '镇上有一套房', desc: '面子 +1。在镇上有了住处，就是自己人',
    line: '在镇上买了房。饭店老板说，都是邻居了。' },
  { name: '宝马 5 系', money: 450000, own: '开着宝马 5 系', desc: '面子 +1。县里的连锁超市只跟像样的老板谈',
    line: '提了一辆宝马 5 系。连锁超市的采购经理请你去县里吃饭。' },
  { name: '保时捷 911', money: 1500000, own: '开着保时捷 911', desc: '面子 +1。精品超市的高端货架等着你',
    line: '保时捷 911 开进县城，精品超市的老板专门出来看车。' },
  { name: '法拉利 SF90', money: 4500000, own: '车库里有一辆法拉利 SF90', desc: '面子 +1。五星酒店的大堂经理会亲自出来接',
    line: '红色的法拉利停在酒店门口，大堂经理一路小跑出来。' },
  { name: '劳斯莱斯 幻影', money: 10000000, own: '有专职司机开劳斯莱斯幻影', desc: '面子 +1。航空公司的头等舱果盘找你供货',
    line: '坐着劳斯莱斯幻影去签合同，航空公司的人在楼下等。' },
  { name: '省城江景大平层', money: 25000000, own: '省城有一套江景大平层', desc: '面子 +1。出口商只跟住在省城的老板做生意',
    line: '在省城买了江景大平层。出口商说，海外的订单交给你放心。' },
  { name: '布加迪 Chiron', money: 50000000, own: '开着布加迪 Chiron', desc: '面子 +1。全世界独一份的派头',
    line: '布加迪 Chiron 开回村口，全村的人都出来看。米其林餐厅的主厨亲自打来电话。' }
];
export const PROD: ShopItem[] = [
  { name: '修枝剪', money: 3000, desc: '果树产量 +50%', line: '修过枝的树，果子结得更密。' },
  { name: '喷灌', money: 15000, desc: '果树产量 +50%', line: '装了喷灌，不用再挑水了。' },
  { name: '拖拉机', money: 60000, desc: '果树产量 +50%', line: '拖拉机开进了果园。' },
  { name: '温室大棚', money: 300000, desc: '果树产量 +50%', line: '搭起了温室大棚，冬天也结果。' },
  { name: '植保无人机', money: 1200000, desc: '果树产量 +50%', line: '无人机在果园上空来回飞，打药施肥都不用人了。' },
  { name: '采摘机器人', money: 5000000, desc: '果树产量 +50%', line: '采摘机器人一排排地走过果树，一个果子都不落下。' },
  { name: '智慧果园系统', money: 20000000, desc: '果树产量 +50%', line: '每棵树都装了传感器，手机上就能看到哪棵该浇水了。' }
];
export const PROD_BONUS = 1.5;

export const BUYERS: Buyer[] = [
  { name: '村口王婶', face: 0, price: 10, cap: 0, refill: 0, remark: '来多少收多少。' },
  { name: '镇上小贩', face: 1, price: 20, cap: 3000, refill: 40, remark: '穿得挺精神。你的果子我要了。' },
  { name: '批发商', face: 2, price: 40, cap: 30000, refill: 200, remark: '开车来的？进来坐，量大好说。' },
  { name: '饭店老板', face: 3, price: 80, cap: 300000, refill: 1000, remark: '都是邻居了，店里的果子以后都找你。' },
  { name: '连锁超市', face: 4, price: 120, cap: 1000000, refill: 2500, remark: '开宝马来的老板，货一定差不了。' },
  { name: '精品超市', face: 5, price: 180, cap: 3000000, refill: 6000, remark: '保时捷？那我们的进口货架也给你留一排。' },
  { name: '五星酒店', face: 6, price: 270, cap: 8000000, refill: 15000, remark: '酒店的水果和甜点，以后都用你家的。' },
  { name: '航空公司', face: 7, price: 400, cap: 20000000, refill: 35000, remark: '头等舱的果盘，就用你家的。' },
  { name: '出口商', face: 8, price: 600, cap: 50000000, refill: 80000, remark: '东南亚、中东都有人要，有多少收多少。' },
  { name: '米其林餐厅', face: 9, price: 900, cap: 100000000, refill: 150000, remark: '主厨说，你的果酱是他吃过最好的。' }
];

// 阶段 6：果酱。买了房、柴房里的木头也攒够了以后出现
/** 熬一罐果酱要的果子和木头 */
export const JAM_FRUIT = 100;
export const JAM_WOOD = 10;
/** 一罐果酱的价钱是同一个买家收 100 个果子价钱的几倍 */
export const JAM_MULT = 3;
/** 果酱的上限是仓库上限的几分之一 */
export const JAM_CAP_DIV = 100;
/** 要先有几件奢侈品（镇上的房），木头攒到多少，才会想到熬果酱 */
export const JAM_UNLOCK_LUX = 3;
export const JAM_UNLOCK_WOOD = 20000;
/** 每间作坊每秒熬几罐 */
export const WORKSHOP_RATE = 1;

// 离线收益：离开的时间最多算这么久，再按效率折算成在线时间。
// 默认最多 2 小时、按一半算，即离开再久也只相当于在线玩了 1 小时。
export const OFFLINE_MAX_SECONDS = 2 * 3600;
export const OFFLINE_EFFICIENCY = 0.5;
/** 离开不到这么久不算离线，照常推进 */
export const OFFLINE_MIN_SECONDS = 5;
/** 离开超过这么久，回来时故事栏报一句收获 */
export const OFFLINE_REPORT_SECONDS = 60;

export function cap(level: number): number {
  return 100 * Math.pow(5, level);
}
export function expandCost(level: number): { fruit: number; wood: number } {
  const w = WOOD_FOR_EXPAND[level];
  return { fruit: cap(level), wood: w !== undefined ? w : Math.round(cap(level) * WOOD_SHARE_AFTER) };
}
export function treeCost(n: number): number {
  return Math.ceil(10 * Math.pow(1.15, n));
}
export function timberCost(n: number): number {
  return Math.ceil(50 * Math.pow(1.15, n));
}
export function workshopCost(n: number): number {
  return Math.ceil(100000 * Math.pow(1.6, n));
}
export function jamCap(level: number): number {
  return cap(level) / JAM_CAP_DIV;
}
