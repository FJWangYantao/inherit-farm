// 故事栏里出现的固定句子。商品买下时的句子在 config.ts 里跟着商品走。

import { fmt } from './format';

export const T = {
  start: '你毕业了。爷爷留给你一块地。',
  canPlant: '地上落了不少果核。也许可以种。',
  capFull: '仓库满了，果子放不下了。得弄些木头来扩建。',
  canSell: '果香飘到了村口，有人来问你卖不卖。',
  firstSale: '换到了第一笔钱。镇上的五金店有工具卖。',
  firstTree: '种下了第一棵树。它自己会结果。',
  firstTimber: '坡上种了第一棵林木。木头不用自己砍了。',
  firstExpand: (c: number) => `仓库宽敞了，能放 ${fmt(c)} 个。坡上还能种些林木。`,
  expand: (c: number) => `仓库又扩了一圈，能放 ${fmt(c)} 个。`,
  canJam: '柴房堆满了木头。收拾爷爷的老屋时，翻出奶奶留下的果酱方子，要用柴火慢慢熬。',
  firstJar: '熬好了第一罐果酱。买家尝了一口，说比果子值钱多了。',
  firstShop: '在坡下盖了间果酱作坊。仓库里的果子和柴火，作坊自己会拿去熬。',
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
