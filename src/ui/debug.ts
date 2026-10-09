// 调试面板，只在 npm run dev 时出现，打包后的正式版里没有。
// 控制台里还可以用 farm.game.s（状态）、farm.game.tick(秒数)、farm.game.build('hut')、farm.game.research('grafting') 等直接操作。

import { clock } from '../game/format';
import type { Game } from '../game/game';
import type { View } from './view';

interface DebugHooks {
  game: Game;
  view: View;
  setSpeed(x: number): void;
  restart(): void;
}

declare global {
  interface Window { farm?: DebugHooks }
}

const SPEEDS = [1, 10, 60];

export function mountDebug(hooks: DebugHooks): void {
  window.farm = hooks;

  const bar = document.createElement('footer');
  bar.className = 'dbg';
  bar.innerHTML = '<span>调试</span><span class="time"></span><span class="seg" role="group" aria-label="速度"></span>' +
    '<button type="button" class="push">重新开始</button>';
  document.querySelector('.page')!.appendChild(bar);

  const time = bar.querySelector('.time')!;
  setInterval(() => { time.textContent = '已玩 ' + clock(hooks.game.s.played); }, 250);

  const seg = bar.querySelector('.seg')!;
  for (const x of SPEEDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '×' + x;
    b.setAttribute('aria-pressed', String(x === 1));
    b.addEventListener('click', () => {
      hooks.setSpeed(x);
      seg.querySelectorAll('button').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    });
    seg.appendChild(b);
  }

  // 点两次才重新开始，防止误触
  const reset = bar.querySelector('.push') as HTMLButtonElement;
  let armed = 0;
  reset.addEventListener('click', () => {
    if (Date.now() < armed) {
      armed = 0;
      reset.textContent = '重新开始';
      hooks.restart();
    } else {
      armed = Date.now() + 3000;
      reset.textContent = '再点一次确认';
      setTimeout(() => { if (armed && Date.now() >= armed) { armed = 0; reset.textContent = '重新开始'; } }, 3100);
    }
  });
}
