// 把游戏状态画到页面上。只读 Game，不改规则。
// 布局约定（设计规则 9）：页签以上的区域高度固定；每一页的条目按出现先后只往后加，
// 条目的高度也固定，所以新东西出现时已有的按钮不会移位。

import { BASE_LOT, SEASONS } from '../game/balance';
import {
  ACTION, BUILDING, CRAFT, JOB, SHELF, TAB, TECH, entryKind, entryTab
} from '../game/content';
import { BUYERS, PRODUCTS } from '../game/content/shop';
import { resName } from '../game/content/resources';
import type { Amounts, ResId, TabId } from '../game/defs';
import { fmt, fmtRate } from '../game/format';
import type { Game } from '../game/game';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error('页面上缺少 #' + id);
  return el;
}
function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}
function setText(el: Element | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}
function setHTML(el: Element | null, html: string): void {
  if (el && el.innerHTML !== html) el.innerHTML = html;
}
function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}
function escape(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** 果园图里画哪些东西，按这个顺序 */
const PLOT = ['tree', 'peach', 'citrus', 'timber', 'greenhouse'] as const;
const PLOT_MAX = 60;

interface Page { root: HTMLElement; list: HTMLElement; foot: HTMLElement }

export class View {
  /** 自动卖到的钱每秒多少（果摊、冷藏车、推销员），主循环每帧更新 */
  stallRate = 0;
  tab: TabId;
  private pages = new Map<TabId, Page>();
  private tabBtns = new Map<TabId, HTMLButtonElement>();
  private nodes = new Map<string, HTMLElement>();
  private cells = new Map<ResId, HTMLElement>();
  private built = 0;
  private dots = new Set<TabId>();
  /** 农技页上研究完的科技收起来了没有，玩家自己点的 */
  foldDone = false;

  constructor(private game: Game, tab: TabId, private onTab: (tab: TabId) => void, private onFold: (fold: boolean) => void) {
    this.tab = tab;
  }

  /** 换了一局（重新开始）后整个重画 */
  reset(): void {
    for (const id of ['res', 'tabs', 'pages', 'log']) $(id).textContent = '';
    this.pages.clear(); this.tabBtns.clear(); this.nodes.clear(); this.cells.clear(); this.dots.clear();
    this.built = 0;
    this.stallRate = 0;
    this.tab = 'farm';
  }

  bumpFruit(): void {
    const b = this.cells.get('fruit')?.querySelector('b');
    if (b) replay(b as HTMLElement, 'bump');
  }

  select(tab: TabId): void {
    if (!this.tabBtns.has(tab)) return;
    this.tab = tab;
    this.dots.delete(tab);
    this.onTab(tab);
    this.render();
  }

  render(): void {
    this.build();
    if (!this.tabBtns.has(this.tab)) this.tab = 'farm';
    this.renderHead();
    this.renderLog();
    this.renderRes();
    for (const [id, btn] of this.tabBtns) {
      btn.setAttribute('aria-selected', String(id === this.tab));
      btn.classList.toggle('dot', this.dots.has(id));
    }
    for (const [id, page] of this.pages) page.root.hidden = id !== this.tab;
    const page = this.pages.get(this.tab);
    if (!page) return;
    for (const e of this.game.entries(this.tab)) this.renderEntry(e);
    this.renderFoot(this.tab, page.foot);
  }

  // ---- 新出现的东西：建节点，按出现先后往后加 ----

  private build(): void {
    const seen = this.game.s.seen, animate = this.built > 0;
    for (; this.built < seen.length; this.built++) {
      const e = seen[this.built], { kind, id } = entryKind(e);
      if (kind === 'res') this.addCell(id as ResId, animate);
      else if (kind === 'tab') this.addTab(id as TabId, animate);
      else {
        const tab = entryTab(e);
        if (!tab) continue;
        const node = this.makeEntry(e);
        if (!node) continue;
        if (animate) node.classList.add('arrive');
        this.page(tab).list.appendChild(node);
        this.nodes.set(e, node);
        if (animate && tab !== this.tab) this.dots.add(tab);
      }
    }
  }

  private addCell(id: ResId, animate: boolean): void {
    const cell = h('div', 'cell' + (animate ? ' arrive' : ''),
      `<span class="nm"><i></i>${resName(id)}</span><span class="rt"></span><span class="v"><b>0</b><small></small></span><span class="meter"></span>`);
    cell.style.setProperty('--c', `var(--r-${id})`);
    $('res').appendChild(cell);
    this.cells.set(id, cell);
  }

  private addTab(id: TabId, animate: boolean): void {
    const btn = h('button', 'tab' + (animate ? ' arrive' : ''));
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.textContent = TAB.get(id)!.name;
    btn.addEventListener('click', () => this.select(id));
    $('tabs').appendChild(btn);
    this.tabBtns.set(id, btn);
    this.page(id);
    if (animate && id !== this.tab) this.dots.add(id);
  }

  private page(id: TabId): Page {
    let p = this.pages.get(id);
    if (p) return p;
    const root = h('section', 'tabpage');
    root.dataset.tab = id;
    root.hidden = true;
    if (id === 'crew') root.appendChild(h('p', 'crewline'));
    if (id === 'study') {
      // 收起已研究的科技：玩家自己点的，下面的按钮跟着动不算违反规则 9
      const fold = h('button', 'fold');
      fold.type = 'button';
      fold.addEventListener('click', () => {
        this.foldDone = !this.foldDone;
        this.onFold(this.foldDone);
        this.render();
      });
      root.appendChild(fold);
    }
    const list = h('div', 'list'), foot = h('div', 'foot');
    root.append(list, foot);
    // 页面在 #pages 里的顺序不重要，同一时间只显示一页
    $('pages').appendChild(root);
    p = { root, list, foot };
    this.pages.set(id, p);
    return p;
  }

  private makeEntry(e: string): HTMLElement | null {
    const { kind, id } = entryKind(e);
    const data = (el: HTMLElement, op: string, n?: number) => {
      el.dataset.op = op; el.dataset.id = id;
      if (n !== undefined) el.dataset.n = String(n);
      return el;
    };
    switch (kind) {
      case 'act': {
        const def = ACTION.get(id)!;
        const btn = data(h('button', 'item' + (def.main ? ' main' : ''),
          `<span class="t">${def.name}</span>` + (def.main ? '' : '<span class="d"></span><span class="k"></span>')), 'act');
        (btn as HTMLButtonElement).type = 'button';
        return btn;
      }
      case 'b': case 'tech': {
        const name = kind === 'b' ? BUILDING.get(id)!.name : TECH.get(id)!.name;
        const btn = data(h('button', 'item', `<span class="t">${name}<em></em></span><span class="d"></span><span class="k"></span>`),
          kind === 'b' ? 'build' : 'tech');
        (btn as HTMLButtonElement).type = 'button';
        return btn;
      }
      case 'job': {
        const def = JOB.get(id)!;
        const row = h('div', 'item', `<span class="t">${def.name}<em></em></span><span class="d">${escape(def.desc)}</span><span class="ops"></span>`);
        const ops = row.querySelector('.ops')!;
        for (const n of [-1, 1]) {
          const b = data(h('button', 'mini'), 'job', n) as HTMLButtonElement;
          b.type = 'button';
          b.textContent = n < 0 ? '−' : '+';
          b.setAttribute('aria-label', (n < 0 ? '少派一个' : '多派一个') + def.name);
          ops.appendChild(b);
        }
        return row;
      }
      case 'craft': {
        const def = CRAFT.get(id)!;
        const recipe = costText(def.cost) + ` → ${def.amount ?? 1} ` + resName(def.out);
        const row = h('div', 'item', `<span class="t">${def.name}<em></em></span><span class="d">${escape(recipe)}</span><span class="ops"></span>`);
        const ops = row.querySelector('.ops')!;
        for (const n of [1, 10, 100]) {
          const b = data(h('button', 'mini'), 'craft', n) as HTMLButtonElement;
          b.type = 'button';
          b.textContent = '×' + n;
          ops.appendChild(b);
        }
        return row;
      }
      case 'shelf': {
        const card = data(h('section', 'shelf',
          '<h2 class="label"></h2><div class="what"><strong></strong><p></p></div><button type="button"></button>'), 'shelf');
        card.querySelector('button')!.dataset.op = 'shelf';
        card.querySelector('button')!.dataset.id = id;
        delete card.dataset.op;
        return card;
      }
      default: return null;
    }
  }

  // ---- 每帧更新 ----

  private renderHead(): void {
    const g = this.game, cal = $('cal');
    if (!g.s.cal.on) { setHTML(cal, ''); return; }
    const w = g.weatherName();
    setHTML(cal, `第 ${g.year()} 年 · <b>${SEASONS[g.season()]}</b>` + (w ? ` · <span class="${g.weatherMult() < 1 ? 'bad' : ''}">${w}</span>` : ''));
  }

  private renderLog(): void {
    const g = this.game, ol = $('log');
    if (!g.newLine && ol.children.length === g.s.log.length) return;
    ol.textContent = '';
    g.s.log.slice(0, 4).forEach((line, i) => {
      const li = h('li');
      li.textContent = line;
      if (i === 0 && g.newLine) li.className = 'new';
      ol.appendChild(li);
    });
    g.newLine = false;
  }

  private renderRes(): void {
    const g = this.game, rates = g.rates();
    for (const [id, cell] of this.cells) {
      const v = g.s.res[id], c = g.cap(id), finite = Number.isFinite(c);
      setText(cell.querySelector('b'), fmt(v));
      setText(cell.querySelector('small'), finite ? ' / ' + fmt(c) : '');
      let r = rates[id];
      if (id === 'money') r = this.stallRate;
      const rt = cell.querySelector('.rt')!;
      setText(rt, Math.abs(r) > 1e-9 ? fmtRate(r) : '');
      rt.classList.toggle('neg', r < -1e-9);
      (cell.querySelector('.meter') as HTMLElement).style.width = finite && c > 0 ? Math.min(100, v / c * 100) + '%' : '0';
    }
  }

  private renderEntry(e: string): void {
    const node = this.nodes.get(e);
    if (!node) return;
    const g = this.game, { kind, id } = entryKind(e);
    switch (kind) {
      case 'act': {
        const def = ACTION.get(id)!;
        if (def.main) return;
        setText(node.querySelector('.d'), def.desc(g));
        setHTML(node.querySelector('.k'), def.cost ? costLines(g, def.cost(g)) : '');
        (node as HTMLButtonElement).disabled = !def.can(g);
        return;
      }
      case 'b': {
        const def = BUILDING.get(id)!, cost = g.costOf(id);
        setText(node.querySelector('em'), String(g.count(id)));
        setText(node.querySelector('.d'), def.desc);
        setHTML(node.querySelector('.k'), costLines(g, cost));
        (node as HTMLButtonElement).disabled = !g.canPay(cost);
        return;
      }
      case 'tech': {
        const def = TECH.get(id)!, done = g.has(id);
        node.classList.toggle('done', done);
        node.hidden = done && this.foldDone;
        setText(node.querySelector('.d'), def.desc);
        setHTML(node.querySelector('.k'), done ? '已研究' : costLines(g, def.cost));
        (node as HTMLButtonElement).disabled = done || !g.canPay(def.cost);
        return;
      }
      case 'job': {
        const n = g.s.jobs[id] ?? 0;
        setText(node.querySelector('em'), String(n));
        const [minus, plus] = node.querySelectorAll('button');
        minus.disabled = n <= 0;
        plus.disabled = g.idle() <= 0;
        return;
      }
      case 'craft': {
        const def = CRAFT.get(id)!, max = g.craftable(id);
        setText(node.querySelector('em'), fmt(g.s.res[def.out]));
        node.querySelectorAll('button').forEach(b => { b.disabled = max < 1; });
        return;
      }
      case 'shelf': {
        const shelf = SHELF.get(id)!, item = g.shelfItem(id), done = g.shelfDone(id);
        const btn = node.querySelector('button')!;
        node.classList.toggle('empty', !item);
        const next = shelf.items[g.s.shelves[id]];
        setText(node.querySelector('.label'), (item?.label ?? next?.label ?? shelf.items[shelf.items.length - 1].label ?? shelf.label));
        if (item) {
          setText(node.querySelector('strong'), item.name);
          setText(node.querySelector('p'), item.desc);
          setText(btn, costText(item.cost));
          btn.disabled = !g.canPay(item.cost);
          btn.hidden = false;
        } else {
          setText(node.querySelector('strong'), done ? '都买齐了' : '暂时没有新货');
          setText(node.querySelector('p'), '');
          btn.hidden = true;
        }
        return;
      }
    }
  }

  private renderFoot(tab: TabId, foot: HTMLElement): void {
    const g = this.game, s = g.s;
    if (tab === 'crew') {
      const mood = Math.round(g.mood() * 100);
      setHTML(this.pages.get('crew')!.root.querySelector('.crewline'),
        `帮工 <b>${s.workers}</b> / ${g.housing()} 个床位 · 闲着 <b>${g.idle()}</b>` +
        (s.f.mood ? ` · 心情 <b class="${mood < 100 ? 'low' : ''}">${mood}%</b>` : ''));
    }
    if (tab === 'study') {
      const done = s.techs.length;
      setText(this.pages.get('study')!.root.querySelector('.fold'),
        done ? (this.foldDone ? `展开已研究的 ${done} 项` : `收起已研究的 ${done} 项`) : '');
    }
    if (tab === 'farm') this.renderPlot(foot);
    if (tab === 'resort') {
      let p = foot.querySelector('p');
      if (!p) { p = h('p', 'note'); foot.appendChild(p); }
      setText(p, `游客 ${fmt(s.res.guest)} / 住得下 ${fmt(g.cap('guest'))} · 景点吸引 ${fmt(g.appeal())} 人` +
        ` · 每人每秒花 ${fmtRate(g.guestSpend()).replace('/秒', '').replace('+', '')} 钱 · 每人每秒吃 0.5 个果子`);
    }
    if (tab === 'market') this.renderBuyers(foot);
    if (tab === 'home') {
      const own = SHELF.get('lux')!.items.slice(0, s.shelves.lux).map(i => i.own).filter(Boolean);
      let p = foot.querySelector('p');
      if (!p) { p = h('p', 'note'); foot.appendChild(p); }
      setText(p, `面子 ${g.face()}` + (own.length ? ' · ' + own.join(' · ') : ''));
    }
  }

  private renderPlot(foot: HTMLElement): void {
    const g = this.game;
    let trees = foot.querySelector('.trees') as HTMLElement | null, note = foot.querySelector('.note');
    if (!trees) {
      trees = h('div', 'trees');
      note = h('p', 'note');
      foot.append(trees, note);
    }
    const want = PLOT.map(id => Math.min(PLOT_MAX, g.count(id)));
    const have = PLOT.map(id => trees!.querySelectorAll('.' + id).length);
    if (have.some((n, i) => n > want[i])) { trees.textContent = ''; have.fill(0); }
    const burst = want.reduce((a, n, i) => a + n - have[i], 0) <= 3;
    PLOT.forEach((id, i) => {
      // 同一种东西挨在一起：插到下一种的第一个前面
      const before = PLOT.slice(i + 1).map(x => trees!.querySelector('.' + x)).find(Boolean) ?? null;
      for (let n = have[i]; n < want[i]; n++) trees!.insertBefore(h('i', id + (burst ? ' new' : '')), before);
    });
    const parts = PLOT.filter(id => g.count(id) > 0).map(id => `${BUILDING.get(id)!.name} ${g.count(id)}`);
    if (g.flag('stall')) parts.push('路边一个果摊');
    if (g.fertilized) parts.push('施着肥');
    setText(note, parts.join(' · '));
  }

  private renderBuyers(foot: HTMLElement): void {
    const g = this.game, s = g.s;
    let box = foot.querySelector('.buyers') as HTMLElement | null;
    if (g.face() < 1) { if (box) box.hidden = true; return; }
    if (!box) {
      box = h('section', 'buyers', '<h2 class="label"><span>买家</span><b></b></h2><ul></ul>');
      foot.appendChild(box);
    }
    box.hidden = false;
    const list = box.querySelector('ul')!;
    const known: number[] = [];
    for (let i = BUYERS.length - 1; i >= 0; i--) if (g.knows(i)) known.push(i);
    if (list.children.length !== known.length) {
      const had = list.children.length;
      list.textContent = '';
      known.forEach((i, n) => {
        const b = BUYERS[i], li = h('li', had && n === 0 ? 'arrive' : '',
          '<div class="who"><strong></strong><p></p></div><div class="deal"><span class="price"></span><span class="left"></span></div><p class="likes"></p><span class="meter"></span>');
        li.dataset.i = String(i);
        li.querySelector('strong')!.textContent = b.name;
        li.querySelector('p')!.textContent = b.remark;
        list.appendChild(li);
      });
    }
    const next = g.nextBuyer();
    for (const li of Array.from(list.children) as HTMLElement[]) {
      const i = Number(li.dataset.i), b = BUYERS[i];
      li.classList.toggle('next', i === next);
      // 价钱含卖价加成和销路（收得越满越便宜）
      setText(li.querySelector('.price'), `每 ${BASE_LOT} 个 ${fmt(g.unitPrice(i) * BASE_LOT)} 钱`);
      // 只说做出过的东西
      const likes = PRODUCTS.filter(p => s.made.includes(p.id) && (b.likes?.[p.id] ?? 1) > 1)
        .map(p => `${resName(p.res)} ×${b.likes![p.id]}`);
      setText(li.querySelector('.likes'), likes.length ? '偏爱 ' + likes.join(' · ') : '');
      const cap = g.buyerCap(i);
      setText(li.querySelector('.left'), cap ? '还收 ' + fmt(s.dem[i]) : '不限量');
      (li.querySelector('.meter') as HTMLElement).style.width = cap ? Math.min(100, s.dem[i] / cap * 100) + '%' : '0';
    }
    setText(box.querySelector('.label b'), '面子 ' + g.face());
  }
}

/** 「120 木头 + 50 钱」 */
export function costText(cost: Amounts): string {
  return (Object.entries(cost) as [ResId, number][]).map(([r, v]) => `${fmt(v)} ${resName(r)}`).join(' + ');
}

/** 每样一行，不够的标红 */
function costLines(g: Game, cost: Amounts): string {
  return (Object.entries(cost) as [ResId, number][])
    .map(([r, v]) => `<span${g.s.res[r] < v - 1e-9 ? ' class="short"' : ''}>${fmt(v)} ${resName(r)}</span>`).join('');
}



