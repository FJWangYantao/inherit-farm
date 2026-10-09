import type { Buyer, Product, ShelfDef } from '../defs';

// 货架一次摆一件，买完换下一件。同一个货架在页面上占一个固定的位置，卖空了也不消失。

export const SHELVES: ShelfDef[] = [
  { id: 'hardware', tab: 'market', label: '镇上五金店', show: g => g.s.f.sold, items: [
    { id: 'ladder', name: '梯子', cost: { money: 50 }, desc: '果树产量 +50%',
      line: '有了梯子，高处的果子也够得着了。', effects: { mult: { orchard: 0.5 } } },
    { id: 'saw', name: '锯子', cost: { money: 100 }, desc: '木头产量翻倍',
      line: '锯子比斧头快得多。', effects: { mult: { forest: 1 } } },
    { id: 'stall', name: '果摊', cost: { money: 200, wood: 300 }, desc: '仓库满了以后，多出来的果子自动卖掉',
      line: '在路边支了个果摊。仓库放不下的果子摆在那儿，自己就卖掉了。', effects: { flags: ['stall'] } },
    { id: 'tallLadder', name: '高梯', cost: { money: 500 }, desc: '果树产量再 +50%',
      line: '卖果一趟一趟地背，太慢了。五金店里有手推车。', effects: { mult: { orchard: 0.5 } } },
    { id: 'cart', name: '手推车', label: '科技工具', cost: { money: 500 }, desc: '卖一趟最多卖 1,000 个',
      line: '有了手推车，一趟能拉一千个。手头宽裕了，也该置办点像样的东西。', effects: { lot: 1000 } },
    { id: 'trike', name: '电动三轮', label: '科技工具', cost: { money: 8000 }, desc: '卖一趟最多卖 10,000 个',
      line: '电动三轮一趟能拉一万个。', effects: { lot: 10000 } },
    { id: 'coldTruck', name: '冷藏车', label: '科技工具', cost: { money: 600000 }, need: g => g.s.f.jamFull,
      desc: '果酱放满了以后，多出来的自动送去卖',
      line: '买了辆冷藏车。果酱放不下了，就直接拉去给买家。', effects: { flags: ['coldTruck'] } },
    { id: 'truck', name: '重型卡车', label: '科技工具', cost: { money: 3000000 }, desc: '卖一趟最多卖 1,000,000 个',
      line: '重卡一趟能拉一百万个，买家那边得派人来卸货。', effects: { lot: 1000000 } }
  ] },
  { id: 'prod', tab: 'market', label: '生产工具', show: g => g.owns('clothes'), items: [
    { id: 'shears', name: '修枝剪', cost: { money: 3000 }, desc: '果树产量 +25%', line: '修过枝的树，果子结得更密。',
      effects: { mult: { orchard: 0.25 } } },
    { id: 'sprinkler', name: '喷灌', cost: { money: 15000 }, desc: '果树产量 +25%', line: '装了喷灌，不用再挑水了。',
      effects: { mult: { orchard: 0.25 } } },
    { id: 'tractor', name: '拖拉机', cost: { money: 60000 }, desc: '果树产量 +25%，木头产量 +50%', line: '拖拉机开进了果园。',
      effects: { mult: { orchard: 0.25, forest: 0.5 } } },
    { id: 'hailNet', name: '防雹网', cost: { money: 300000 }, desc: '果树产量 +25%', line: '果园上空拉起了防雹网。',
      effects: { mult: { orchard: 0.25 } } },
    { id: 'drone', name: '植保无人机', cost: { money: 1200000 }, desc: '果树产量 +25%',
      line: '无人机在果园上空来回飞，打药施肥都不用人了。', effects: { mult: { orchard: 0.25 } } },
    { id: 'robot', name: '采摘机器人', cost: { money: 50000000 }, need: g => g.has('mechanization'), desc: '果树产量 +25%',
      line: '采摘机器人一排排地走过果树，一个果子都不落下。', effects: { mult: { orchard: 0.25 } } },
    { id: 'smartFarm', name: '智慧果园系统', cost: { money: 200000000 }, need: g => g.has('mechanization'), desc: '果树产量 +25%',
      line: '每棵树都装了传感器，手机上就能看到哪棵该浇水了。', effects: { mult: { orchard: 0.25 } } }
  ] },
  // 奢侈品只加面子（规则 8），每级面子对应 BUYERS 里的一个买家
  { id: 'lux', tab: 'home', label: '奢侈品', show: g => g.owns('cart'), items: [
    { id: 'clothes', name: '一身新衣服', cost: { money: 1200 }, own: '穿着一身新衣服', effects: { face: 1 },
      desc: '面子 +1。穿得体面些，镇上的人才愿意跟你谈', line: '换了一身新衣服。镇上的小贩主动过来打招呼。' },
    { id: 'santana', name: '二手桑塔纳', cost: { money: 12000 }, own: '门口停着一辆桑塔纳', effects: { face: 1 },
      desc: '面子 +1。开车去谈，大买家才肯见你', line: '开着桑塔纳去谈，批发商把你请进了屋。' },
    { id: 'townHouse', name: '镇上一套房', cost: { money: 100000 }, own: '镇上有一套房', effects: { face: 1 },
      desc: '面子 +1。在镇上有了住处，就是自己人', line: '在镇上买了房。饭店老板说，都是邻居了。' },
    { id: 'bmw', name: '宝马 5 系', cost: { money: 450000 }, own: '开着宝马 5 系', effects: { face: 1 },
      desc: '面子 +1。县里的连锁超市只跟像样的老板谈', line: '提了一辆宝马 5 系。连锁超市的采购经理请你去县里吃饭。' },
    { id: 'porsche', name: '保时捷 911', cost: { money: 1500000 }, own: '开着保时捷 911', effects: { face: 1 },
      desc: '面子 +1。精品超市的高端货架等着你', line: '保时捷 911 开进县城，精品超市的老板专门出来看车。' },
    { id: 'ferrari', name: '法拉利 SF90', cost: { money: 4500000 }, own: '车库里有一辆法拉利 SF90', effects: { face: 1 },
      desc: '面子 +1。五星酒店的大堂经理会亲自出来接', line: '红色的法拉利停在酒店门口，大堂经理一路小跑出来。' },
    { id: 'rolls', name: '劳斯莱斯 幻影', cost: { money: 10000000 }, own: '有专职司机开劳斯莱斯幻影', effects: { face: 1 },
      desc: '面子 +1。航空公司的头等舱果盘找你供货', line: '坐着劳斯莱斯幻影去签合同，航空公司的人在楼下等。' },
    { id: 'flat', name: '省城江景大平层', cost: { money: 25000000 }, own: '省城有一套江景大平层', effects: { face: 1 },
      desc: '面子 +1。出口商只跟住在省城的老板做生意', line: '在省城买了江景大平层。出口商说，海外的订单交给你放心。' },
    { id: 'bugatti', name: '布加迪 Chiron', cost: { money: 50000000 }, own: '开着布加迪 Chiron', effects: { face: 1 },
      desc: '面子 +1。全世界独一份的派头', line: '布加迪 Chiron 开回村口，全村的人都出来看。米其林餐厅的主厨亲自打来电话。' }
  ] }
];

export const BUYERS: Buyer[] = [
  { name: '村口王婶', face: 0, price: 10, cap: 0, refill: 0, remark: '来多少收多少。' },
  { name: '镇上小贩', face: 1, price: 15, cap: 3000, refill: 40, remark: '穿得挺精神。你的果子我要了。' },
  { name: '批发商', face: 2, price: 20, cap: 12000, refill: 150, remark: '开车来的？进来坐，量大好说。' },
  { name: '饭店老板', face: 3, price: 30, cap: 30000, refill: 400, remark: '都是邻居了，店里的果子以后都找你。' },
  { name: '连锁超市', face: 4, price: 40, cap: 60000, refill: 800, remark: '开宝马来的老板，货一定差不了。' },
  { name: '精品超市', face: 5, price: 55, cap: 120000, refill: 1500, remark: '保时捷？那我们的进口货架也给你留一排。' },
  { name: '五星酒店', face: 6, price: 75, cap: 200000, refill: 2500, remark: '酒店的水果和甜点，以后都用你家的。' },
  { name: '航空公司', face: 7, price: 100, cap: 300000, refill: 4000, remark: '头等舱的果盘，就用你家的。' },
  { name: '出口商', face: 8, price: 130, cap: 450000, refill: 6000, remark: '东南亚、中东都有人要，有多少收多少。' },
  { name: '米其林餐厅', face: 9, price: 170, cap: 700000, refill: 9000, remark: '主厨说，你的果酱是他吃过最好的。' }
];

/** 能卖的东西。买家的价钱和收购量按果子算，一罐果酱占 100 个果子的量、价钱是 3 倍 */
export const PRODUCTS: Record<'fruit' | 'jam', Product> = {
  fruit: { res: 'fruit', units: 1, mult: 1 },
  jam: { res: 'jam', units: 100, mult: 3 }
};
