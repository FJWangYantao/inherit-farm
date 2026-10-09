// 把游戏状态画到页面上。只读 Game，不改规则。
// 布局约定：按钮上方的区域高度固定，新内容出现时已有的按钮不移位。

import { BUYERS, LUX, TOOLS, expandCost, timberCost, treeCost } from '../game/config';
import { fmt, fmtRate } from '../game/format';
import type { Game, Shelf } from '../game/game';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error('页面上缺少 #' + id);
  return el;
}
function btn(id: string): HTMLButtonElement {
  return $(id) as HTMLButtonElement;
}
function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
/** 第一次出现时播一下入场动画 */
function show(el: HTMLElement, on: boolean): void {
  if (on && el.hidden) { el.hidden = false; el.classList.add('arrive'); }
  else if (!on && !el.hidden) el.hidden = true;
}
function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

export class View {
  /** 果摊每秒卖到的钱，主循环每帧更新 */
  stallRate = 0;

  constructor(private game: Game) {}

  /** 换了一局（重新开始）后清掉入场动画和缓存的列表 */
  reset(): void {
    this.stallRate = 0;
    document.querySelectorAll('.arrive').forEach(el => el.classList.remove('arrive'));
    $('buyer-list').textContent = '';
    $('trees').textContent = '';
  }

  bumpFruit(): void {
    replay($('v-fruit'), 'bump');
  }

  render(): void {
    const g = this.game, s = g.s, c = g.cap();

    this.renderLog();

    // 库存
    setText($('v-fruit'), fmt(s.fruit));
    setText($('c-fruit'), s.f.cap ? ' / ' + fmt(c) : '');
    setText($('r-fruit'), s.trees > 0 ? fmtRate(g.fruitRate()) : '');
    $('m-fruit').style.width = s.f.cap ? Math.min(100, s.fruit / c * 100) + '%' : '0';

    $('row-wood').classList.toggle('off', !s.f.cap);
    setText($('v-wood'), fmt(s.wood));
    setText($('c-wood'), ' / ' + fmt(c));
    setText($('r-wood'), s.timber > 0 ? fmtRate(g.woodRate()) : '');
    $('m-wood').style.width = Math.min(100, s.wood / c * 100) + '%';

    $('row-money').classList.toggle('off', !s.f.sold);
    setText($('v-money'), fmt(s.money));
    setText($('r-money'), g.hasStall() ? (s.fruit >= c ? '果摊在卖 ' + fmtRate(this.stallRate) : '果摊等仓库满') : '');

    // 能做的事
    show(btn('b-plant'), s.f.tree);
    setText($('s-plant'), fmt(treeCost(s.trees)) + ' 果子');
    btn('b-plant').disabled = s.fruit < treeCost(s.trees);

    show(btn('b-chop'), s.f.cap);

    show(btn('b-timber'), s.level >= 1);
    setText($('s-timber'), fmt(timberCost(s.timber)) + ' 果子');
    btn('b-timber').disabled = s.fruit < timberCost(s.timber);

    const e = expandCost(s.level);
    show(btn('b-expand'), s.f.cap);
    setText($('s-expand'), fmt(e.fruit) + ' 果子 + ' + fmt(e.wood) + ' 木头');
    btn('b-expand').disabled = s.fruit < e.fruit || s.wood < e.wood;

    show(btn('b-sell'), s.f.sell);
    const nb = BUYERS[g.nextBuyer()];
    setText($('s-sell'), s.lux >= 1 ? nb.name + ' · 100 个换 ' + nb.price + ' 钱' : '100 果子 换 10 钱');
    btn('b-sell').disabled = s.fruit < 100;

    // 货架：第一个货架先是五金店，卖完了换成科技工具
    let any = false;
    any = this.shelf('tech', s.tools < TOOLS.length ? 'tools' : 'tech',
      s.tools < TOOLS.length ? '镇上五金店' : '科技工具') || any;
    any = this.shelf('lux', 'lux', '奢侈品') || any;
    any = this.shelf('prod', 'prod', '生产工具') || any;
    $('shop').hidden = !any;

    this.renderBuyers();
    this.renderPlot();
  }

  private renderLog(): void {
    const g = this.game, ol = $('log');
    if (!g.newLine && ol.children.length === g.s.log.length) return;
    ol.textContent = '';
    g.s.log.forEach((line, i) => {
      const li = document.createElement('li');
      li.textContent = line;
      if (i === 0 && g.newLine) li.className = 'new';
      ol.appendChild(li);
    });
    g.newLine = false;
  }

  /** 一个货架卡片：显示货架上的下一件，没有就藏起来 */
  private shelf(card: string, key: Shelf, label: string): boolean {
    const g = this.game, item = g.shelfItem(key), cardEl = $('card-' + card);
    if (!item) { show(cardEl, false); return false; }
    const changed = !cardEl.hidden && $('n-' + card).textContent !== item.name;
    show(cardEl, true);
    if (changed) replay(cardEl, 'arrive');
    setText($('l-' + card), label);
    setText($('n-' + card), item.name);
    setText($('d-' + card), item.desc);
    setText($('b-' + card), fmt(item.money) + ' 钱' + (item.wood ? ' + ' + fmt(item.wood) + ' 木头' : ''));
    btn('b-' + card).disabled = !g.canAfford(item);
    return true;
  }

  private renderBuyers(): void {
    const g = this.game, s = g.s, box = $('buyers'), list = $('buyer-list');
    show(box, s.lux >= 1);
    if (s.lux < 1) { if (list.children.length) list.textContent = ''; return; }
    const known: number[] = [];
    for (let i = BUYERS.length - 1; i >= 0; i--) if (g.knows(i)) known.push(i);
    if (list.children.length !== known.length) {
      const had = list.children.length;
      list.textContent = '';
      known.forEach((i, n) => {
        const b = BUYERS[i], li = document.createElement('li');
        li.dataset.i = String(i);
        if (had && n === 0) li.className = 'arrive';
        li.innerHTML = '<div class="who"><strong></strong><p></p></div><div class="deal"><span class="price"></span><span class="left"></span></div><span class="meter"></span>';
        li.querySelector('strong')!.textContent = b.name;
        li.querySelector('p')!.textContent = b.remark;
        li.querySelector('.price')!.textContent = '每 100 个 ' + b.price + ' 钱';
        list.appendChild(li);
      });
    }
    const next = g.nextBuyer();
    for (const li of Array.from(list.children) as HTMLElement[]) {
      const i = Number(li.dataset.i), b = BUYERS[i];
      li.classList.toggle('next', i === next);
      setText(li.querySelector('.left')!, b.cap ? '还收 ' + fmt(s.dem[i]) : '不限量');
      (li.querySelector('.meter') as HTMLElement).style.width = b.cap ? Math.min(100, s.dem[i] / b.cap * 100) + '%' : '0';
    }
    setText($('face'), '面子 ' + s.lux);
  }

  /** 果园：每棵树一个小图标 */
  private renderPlot(): void {
    const g = this.game, s = g.s, plot = $('plot'), trees = $('trees');
    plot.hidden = s.trees + s.timber === 0;
    let haveT = trees.querySelectorAll('.t').length, haveP = trees.querySelectorAll('.p').length;
    if (haveT > s.trees || haveP > s.timber) { trees.textContent = ''; haveT = 0; haveP = 0; }
    const burst = (s.trees - haveT) + (s.timber - haveP) <= 3;
    const firstPine = trees.querySelector('.p');
    for (; haveT < s.trees; haveT++) {
      const a = document.createElement('i'); a.className = burst ? 't new' : 't';
      trees.insertBefore(a, firstPine);
    }
    for (; haveP < s.timber; haveP++) {
      const b = document.createElement('i'); b.className = burst ? 'p new' : 'p';
      trees.appendChild(b);
    }
    setText($('plot-cap'), '果树 ' + s.trees + ' 棵' + (s.timber ? ' · 林木 ' + s.timber + ' 棵' : '') +
      (g.hasStall() ? ' · 路边一个果摊' : '') + (s.lux >= 1 ? ' · ' + LUX[s.lux - 1].own : ''));
  }
}
