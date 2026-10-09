import '@fontsource/zcool-xiaowei/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';

import { OFFLINE_MIN_SECONDS } from './game/config';
import { Game } from './game/game';
import { load, save } from './game/save';
import { View } from './ui/view';

const SAVE_EVERY = 5;
const FRAME_MS = 100;

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const store = storage();
const saved = store ? load(store) : null;
const game = new Game(saved ?? undefined);
if (saved) game.catchUp((Date.now() - saved.last) / 1000);

const view = new View(game);
/** 游戏时间的倍速，只有调试面板会改 */
let speed = 1;

function persist(): void {
  game.s.last = Date.now();
  if (store) save(store, game.s);
}

function wire(id: string, action: () => unknown): void {
  document.getElementById(id)!.addEventListener('click', () => { action(); view.render(); });
}
wire('b-pick', () => { game.pick(); view.bumpFruit(); });
wire('b-plant', () => game.plant());
wire('b-chop', () => game.chop());
wire('b-timber', () => game.plantTimber());
wire('b-expand', () => game.expand());
wire('b-sell', () => game.sell());
wire('b-tech', () => game.buy(game.shelfItem('tools') ? 'tools' : 'tech'));
wire('b-lux', () => game.buy('lux'));
wire('b-prod', () => game.buy('prod'));

// 页面在后台的时间（切到别的 App、锁屏、切标签页）一律按离线规则补算，不然离线上限就形同虚设
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
