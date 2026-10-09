import '@fontsource/zcool-xiaowei/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';

import { OFFLINE_MIN_SECONDS } from './game/balance';
import { ACTION, TAB } from './game/content';
import type { TabId } from './game/defs';
import { Game } from './game/game';
import { load, save } from './game/save';
import { View } from './ui/view';

const SAVE_EVERY = 5;
const FRAME_MS = 100;
/** 上次看的是哪一页，只是方便，存不了也没关系 */
const TAB_KEY = 'inherit-farm-tab';
/** 农技页是不是收起了已研究的科技，同上 */
const FOLD_KEY = 'inherit-farm-fold';

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const store = storage();
const saved = store ? load(store) : null;
const game = new Game(saved ?? undefined);
if (saved) {
  game.check(true);
  game.catchUp((Date.now() - saved.last) / 1000);
}
game.check();

let lastTab: TabId = 'farm';
try {
  const t = store?.getItem(TAB_KEY) as TabId | null;
  if (t && TAB.has(t)) lastTab = t;
} catch { /* 用默认的农场页 */ }

const view = new View(game, lastTab, tab => {
  try { store?.setItem(TAB_KEY, tab); } catch { /* 记不住就算了 */ }
}, fold => {
  try { store?.setItem(FOLD_KEY, fold ? '1' : ''); } catch { /* 同上 */ }
});
try { view.foldDone = store?.getItem(FOLD_KEY) === '1'; } catch { /* 默认展开 */ }
/** 游戏时间的倍速，只有调试面板会改 */
let speed = 1;

function persist(): void {
  game.s.last = Date.now();
  if (store) save(store, game.s);
}

// 页里所有按钮的点击都在这里处理，按钮上的 data-op、data-id、data-n 说明要做什么
document.getElementById('pages')!.addEventListener('click', ev => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-op]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const id = el.dataset.id!, n = Number(el.dataset.n ?? 0);
  switch (el.dataset.op) {
    case 'act':
      ACTION.get(id)!.run(game);
      if (id === 'pick') view.bumpFruit();
      break;
    case 'build': game.build(id); break;
    case 'tech': game.research(id); break;
    case 'shelf': game.buyShelf(id); break;
    case 'job': game.assign(id, n); break;
    case 'craft': game.craft(id, n); break;
  }
  view.render();
});

// 页面在后台的时间（切到别的 App、锁屏、切标签页）一律按离线规则补算
let prev = performance.now(), sinceSave = 0, hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    persist();
  } else if (hiddenAt) {
    game.catchUp((performance.now() - hiddenAt) / 1000);
    hiddenAt = 0;
    prev = performance.now();
    view.stallRate = 0;
    view.render();
  }
});
window.addEventListener('pagehide', persist);

setInterval(() => {
  const now = performance.now(), real = (now - prev) / 1000;
  prev = now;
  if (document.hidden) return;
  if (real >= OFFLINE_MIN_SECONDS) {
    // 定时器被挂起了却没收到 visibilitychange，也按离线算
    game.catchUp(real);
    view.stallRate = 0;
  } else {
    const dt = real * speed;
    game.s.played += dt;
    const got = game.tick(dt);
    if (dt > 0) view.stallRate = got / dt;
  }
  view.render();
  sinceSave += real;
  if (sinceSave >= SAVE_EVERY) { sinceSave = 0; persist(); }
}, FRAME_MS);

view.render();

if (import.meta.env.DEV) {
  void import('./ui/debug').then(({ mountDebug }) => mountDebug({
    game, view,
    setSpeed: (x: number) => { speed = x; },
    restart: () => { game.reset(); view.reset(); persist(); view.render(); }
  }));
}
