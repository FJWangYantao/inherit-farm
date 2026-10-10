import type { Buyer, Product, ProductId, ShelfDef } from '../defs';

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
    { id: 'coldTruck', name: '冷藏车', label: '科技工具', cost: { money: 600000 }, need: g => g.s.f.jamFull || g.has('coldChain'),
      desc: '果酱这些加工品放满了以后，多出来的自动送去卖',
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
  // 年代二：加工设备，钱的大去处
  { id: 'equip', tab: 'craft', label: '加工设备', show: g => g.has('drying'), items: [
    { id: 'steelPot', name: '不锈钢大锅', cost: { money: 3000000 }, desc: '作坊、锯木坊、砖窑效率 +25%',
      line: '换了一口不锈钢大锅，果酱熬得又快又匀。', effects: { mult: { mill: 0.25 } } },
    { id: 'dryer', name: '热风烘干机', cost: { money: 12000000 }, desc: '晒架效率 +50%',
      line: '热风烘干机装好了，阴天也能做果干。', effects: { mult: { dry: 0.5 } } },
    { id: 'press', name: '冷榨机', cost: { money: 40000000 }, need: g => g.has('juicing'), desc: '榨汁坊效率 +50%',
      line: '冷榨机榨出来的汁，颜色都比以前鲜亮。', effects: { mult: { juice: 0.5 } } },
    { id: 'oak', name: '法国橡木桶', cost: { money: 300000000 }, need: g => g.has('brewing'), desc: '酒坊效率 +50%',
      line: '从法国运来一批橡木桶，酒里有了香草味。', effects: { mult: { winery: 0.5 } } },
    { id: 'filling', name: '自动灌装线', cost: { money: 1200000000 }, need: g => g.has('assembly'), desc: '所有加工效率 +50%',
      line: '自动灌装线一开，瓶子排着队从眼前走过。', effects: { mult: { mill: 0.5, dry: 0.5, juice: 0.5, winery: 0.5 } } },
    { id: 'cellarSys', name: '恒温酒窖系统', cost: { money: 2500000000 }, need: g => g.has('fermentation'), desc: '果酒上限翻倍，酒坊 +50%',
      line: '酒窖装上了恒温恒湿系统。', effects: { capMult: { wine: 1 }, mult: { winery: 0.5 } } }
  ] },
  // 年代二：帮工的生活用品，加心情
  { id: 'comfort', tab: 'crew', label: '生活用品', show: g => g.s.f.mood, items: [
    { id: 'radio', name: '收音机', cost: { money: 2000 }, desc: '心情 +5%', line: '工棚里放起了收音机，干活的时候能听戏。',
      effects: { mood: 0.05 } },
    { id: 'tv', name: '电视机', cost: { money: 50000 }, desc: '心情 +10%', line: '食堂里装了台电视，晚上大家一起看。',
      effects: { mood: 0.1 } },
    { id: 'washer', name: '洗衣机', cost: { money: 300000 }, desc: '心情 +10%', line: '有了洗衣机，不用再去河边洗衣服了。',
      effects: { mood: 0.1 } },
    { id: 'aircon', name: '空调', cost: { money: 2000000 }, desc: '心情 +10%', line: '宿舍都装了空调，夏天睡得着觉了。',
      effects: { mood: 0.1 } },
    { id: 'wifi', name: '全村 WiFi', cost: { money: 10000000 }, desc: '心情 +15%', line: '村里通了 WiFi，年轻人都愿意留下来了。',
      effects: { mood: 0.15 } },
    { id: 'gym', name: '健身房', cost: { money: 80000000 }, desc: '心情 +15%', line: '盖了间健身房，下了班也有地方去。',
      effects: { mood: 0.15 } }
  ] },
  // 年代三：营销，加所有买家的收购量
  { id: 'marketing', tab: 'market', label: '营销', show: g => g.s.f.market, items: [
    { id: 'billboard', name: '路边广告牌', cost: { money: 50000000 }, desc: '所有买家的收购量 +20%',
      line: '国道边立起了「爷爷的果园」的广告牌。', effects: { mult: { refill: 0.2 } } },
    { id: 'tvAd', name: '电视广告', cost: { money: 300000000 }, desc: '所有买家的收购量 +30%',
      line: '省台播了十五秒的广告，镜头里是秋天的果园。', effects: { mult: { refill: 0.3 } } },
    { id: 'endorse', name: '明星代言', cost: { money: 1500000000 }, desc: '所有买家的收购量 +40%',
      line: '请了明星代言，海报贴满了地铁站。', effects: { mult: { refill: 0.4 } } },
    { id: 'show', name: '冠名综艺', cost: { money: 6000000000 }, desc: '所有买家的收购量 +50%',
      line: '冠名了一档种田综艺，嘉宾们来果园住了一个月。', effects: { mult: { refill: 0.5 } } }
  ] },
  // 年代四：旅游设施，加游客和游客花的钱
  { id: 'tourism', tab: 'resort', label: '旅游设施', show: g => g.s.f.tourism, items: [
    { id: 'parking', name: '停车场', cost: { money: 200000000 }, desc: '游客多 20%，花得也多 20%',
      line: '修了个大停车场，周末停满了外地牌照的车。', effects: { mult: { tourism: 0.2 } } },
    { id: 'visitorCenter', name: '游客中心', cost: { money: 1000000000 }, desc: '游客多 30%，花得也多 30%',
      line: '游客中心盖好了，有导览图、有纪念品，还有果酱试吃。', effects: { mult: { tourism: 0.3 } } },
    { id: 'rating4A', name: '4A 景区评级', cost: { money: 5000000000 }, desc: '游客多 40%，花得也多 40%',
      line: '评上了 4A 景区，高速路口立起了棕色的指示牌。', effects: { mult: { tourism: 0.4 } } },
    { id: 'rating5A', name: '5A 景区评级', cost: { money: 15000000000 }, desc: '游客多 50%，花得也多 50%',
      line: '评上了 5A 景区。爷爷要是看到，大概不会相信这是他那块地。', effects: { mult: { tourism: 0.5 } } }
  ] },
  // 年代五：集团。最后一件「敲钟上市」是这一轮的终点
  { id: 'group', tab: 'home', label: '集团', show: g => g.has('crossBorder'), items: [
    { id: 'founding', name: '成立农业集团', cost: { money: 3000000000 }, desc: '卖东西的价钱 +10%',
      line: '「爷爷的果园农业集团」挂牌成立。', effects: { mult: { price: 0.1 } } },
    { id: 'beverage', name: '收购饮料厂', cost: { money: 8000000000 }, desc: '榨汁坊、酒坊效率 +50%',
      line: '收购了省里的一家饮料厂，果汁有了自己的灌装线。', effects: { mult: { juice: 0.5, winery: 0.5 } } },
    { id: 'merger', name: '海外并购', cost: { money: 25000000000 }, desc: '所有买家的收购量 +50%',
      line: '并购了一家海外的水果分销商，货能直接进当地超市了。', effects: { mult: { refill: 0.5 } } },
    { id: 'ipo', name: '敲钟上市', cost: { money: 50000000000 }, desc: '集团上市',
      line: '敲钟那天，你想起毕业那年第一次走进爷爷的果园，满地都是落下的果子。' }
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
      desc: '面子 +1。全世界独一份的派头', line: '布加迪 Chiron 开回村口，全村的人都出来看。米其林餐厅的主厨亲自打来电话。' },
    { id: 'yacht', name: '私人游艇', cost: { money: 200000000 }, own: '海边停着一艘私人游艇', effects: { face: 1 },
      need: g => g.has('juicing'),
      desc: '面子 +1。在游艇上谈生意，进口商超的人排着队来', line: '在游艇上请客。进口商超的采购总监当场签了合同。' },
    { id: 'jet', name: '湾流 G650 公务机', cost: { money: 500000000 }, own: '有一架湾流 G650 公务机', effects: { face: 1 },
      need: g => g.has('brewing'),
      desc: '面子 +1。飞去和国际食品集团谈', line: '坐公务机飞去总部。国际食品集团的董事长亲自到机场接。' },
    { id: 'chateau', name: '波尔多酒庄', cost: { money: 2000000000 }, own: '在波尔多有一座酒庄', effects: { face: 1 },
      need: g => g.has('ecommerce'),
      desc: '面子 +1。国际酒商只认有酒庄的人', line: '买下了波尔多的一座老酒庄。国际酒商说，以后是同行了。' },
    { id: 'island', name: '私人海岛', cost: { money: 8000000000 }, own: '有一座私人海岛', effects: { face: 1 },
      need: g => g.has('livestream'),
      desc: '面子 +1。全球会员店的创始人想来岛上度假', line: '买下了一座小岛。全球会员店的创始人坐游艇来做客，当场签了独家供货。' }
  ] }
];

export const BUYERS: Buyer[] = [
  { name: '村口王婶', face: 0, price: 10, cap: 0, refill: 0, remark: '来多少收多少。' },
  { name: '镇上小贩', face: 1, price: 15, cap: 3000, refill: 40, remark: '穿得挺精神。你的果子我要了。' },
  { name: '批发商', face: 2, price: 20, cap: 12000, refill: 150, remark: '开车来的？进来坐，量大好说。' },
  { name: '饭店老板', face: 3, price: 30, cap: 30000, refill: 400, remark: '都是邻居了，店里的果子以后都找你。', likes: { jam: 1.5 } },
  { name: '连锁超市', face: 4, price: 40, cap: 30000, refill: 400, remark: '开宝马来的老板，货一定差不了。', likes: { juice: 1.5 } },
  { name: '精品超市', face: 5, price: 55, cap: 45000, refill: 600, remark: '保时捷？那我们的进口货架也给你留一排。', likes: { dried: 1.5, juice: 1.3 } },
  { name: '五星酒店', face: 6, price: 75, cap: 70000, refill: 900, remark: '酒店的水果和甜点，以后都用你家的。', likes: { wine: 1.5, jam: 1.2 } },
  { name: '航空公司', face: 7, price: 100, cap: 100000, refill: 1300, remark: '头等舱的果盘，就用你家的。', likes: { juice: 2 } },
  { name: '出口商', face: 8, price: 130, cap: 140000, refill: 1800, remark: '东南亚、中东都有人要，有多少收多少。', likes: { dried: 1.5, wine: 1.3 } },
  { name: '米其林餐厅', face: 9, price: 170, cap: 200000, refill: 2500, remark: '主厨说，你的果酱是他吃过最好的。', likes: { wine: 2, jam: 1.5 } },
  { name: '进口商超', face: 10, price: 220, cap: 280000, refill: 3500, remark: '游艇主人推荐的货，我们照单全收。',
    likes: { juice: 1.5, dried: 1.5 } },
  { name: '国际食品集团', face: 11, price: 290, cap: 400000, refill: 5000, remark: '坐公务机来谈的供应商，全球就你一家。',
    likes: { wine: 1.5, jam: 1.5, juice: 1.3 } },
  { name: '国际酒商', face: 12, price: 380, cap: 560000, refill: 7000, remark: '有酒庄的人，酿的酒错不了。',
    likes: { wine: 2, dried: 1.2 } },
  { name: '全球会员店', face: 13, price: 500, cap: 800000, refill: 10000, remark: '岛主的货，我们的会员抢着要。',
    likes: { jam: 1.3, dried: 1.3, juice: 1.3, wine: 1.3 } },
  // 网购顾客不看面子，看网店开了几间
  { name: '网购顾客', face: 0, price: 50, cap: 36000, refill: 600, remark: '下单、付款、等快递，全国各地都有人买。',
    likes: { jam: 1.3, dried: 1.3, juice: 1.3 }, need: g => g.count('eshop') > 0, scale: g => g.count('eshop') * g.mult('online') },
  // 海外市场不看面子，看海外仓建了几个（新买家只往最后加：存档里的收购量是按位置存的）
  { name: '海外市场', face: 0, price: 400, cap: 60000, refill: 1000, remark: '东南亚、欧洲、中东，哪里都有人想尝尝中国的果子。',
    likes: { jam: 1.2, dried: 1.2, juice: 1.2, wine: 1.2 }, need: g => g.count('overseas') > 0, scale: g => g.count('overseas') }
];

/**
 * 能卖的东西。买家的价钱和收购量按果子算：一份占 units 个果子的量，价钱是果子的 mult 倍，
 * 再乘买家的偏爱（Buyer.likes）。
 */
export const PRODUCTS: Product[] = [
  { id: 'fruit', res: 'fruit', unit: '个', action: 'sell', units: 1, mult: 1 },
  { id: 'jam', res: 'jam', unit: '罐', action: 'sellJam', units: 100, mult: 3 },
  { id: 'dried', res: 'dried', unit: '包', action: 'sellDried', units: 50, mult: 2.5 },
  { id: 'juice', res: 'juice', unit: '瓶', action: 'sellJuice', units: 100, mult: 2.5 },
  { id: 'wine', res: 'wine', unit: '瓶', action: 'sellWine', units: 200, mult: 6 }
];
export const PRODUCT = new Map<ProductId, Product>(PRODUCTS.map(p => [p.id, p]));
