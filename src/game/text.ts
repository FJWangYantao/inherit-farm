// 故事栏里不属于某件东西的句子。建筑、科技、商品的句子跟着它们写在 content/ 里。

import { fmt } from './format';

export const T = {
  start: '你毕业了。爷爷留给你一块地。',
  capFull: '仓库满了，果子放不下了。得弄些木头来扩建。',
  firstSale: '换到了第一笔钱。镇上的五金店有工具卖。',
  firstExpand: (c: number) => `仓库宽敞了，能放 ${fmt(c)} 个。坡上还能种些林木。`,
  expand: (c: number) => `仓库又扩了一圈，能放 ${fmt(c)} 个。`,
  firstWorker: '来了第一个帮工，老李。他提醒你：果树冬天不结果，入冬前得囤够果子，大家要吃饭。',
  winter: '入冬了，果树不结果了。仓库里的果子得省着吃。',
  hungry: '果子吃光了。有帮工饿着肚子，说再这样就要走了。',
  workerLeft: '一个帮工收拾铺盖走了。',
  firstJar: '熬好了第一罐果酱。买家尝了一口，说比果子值钱多了。',
  mood: '人一多，帮工们开始抱怨住得挤、天天吃一样的。心情不好，干活也慢。',
  family: '帮工们把家里人也接来了。孩子要上学，老人要看病，光有床位不够了。',
  smart: '帮工两百来号人，排班、记账、看地，样样都管不过来了。农大的教授来参观，说该上智慧农业了。',
  launch: '一批种子搭上了卫星，半个小时以后回来。',
  landed: (n: number) => `卫星返回舱落地，带回 ${n} 颗太空种子。`,
  tourism: '电视广告播出以后，周末有城里人开着车来，问能不能进果园摘果子、住一晚。',
  market: '牌子打响了，货多得买家吃不下。精品超市说库房压满了，再送来只能压价。集市上来了几个商人，问要不要换货。',
  jamFull: '果酱罐子堆满了，作坊停了火。听说县里有卖冷藏车的。',
  end: '（目前的内容到这里，后面的故事还在写。）',
  away: (seconds: number, gains: string[]) => {
    const mins = Math.round(seconds / 60);
    const span = mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分钟` : `${mins} 分钟`;
    return `你离开了 ${span}。` + (gains.length ? gains.join('，') + '。' : '仓库早就满了。');
  }
};

/** 旧版本写进存档的结尾句，读档时如果还没到结尾就去掉 */
export const OLD_END_LINES = ['（原型的内容到这里', '（目前的内容到这里'];
