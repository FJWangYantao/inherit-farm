// 把 dist/ 打成 TapTap 网页游戏要的 zip：解压后第一层只有一个英文名文件夹，里面直接就是 index.html。
// 用法：npm run package，结果在 release/ 下。

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const FOLDER = 'inherit-farm';
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/index.html 不存在，先运行 npm run build');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const entries: Record<string, Uint8Array> = {};
for (const p of walk(DIST)) {
  if (p.split(/[\\/]/).pop()!.startsWith('.')) continue;
  entries[`${FOLDER}/${relative(DIST, p).split('\\').join('/')}`] = readFileSync(p);
}

const out = join(ROOT, 'release', `${FOLDER}-${version}.zip`);
mkdirSync(join(ROOT, 'release'), { recursive: true });
writeFileSync(out, zipSync(entries, { level: 9 }));
console.log(`${relative(ROOT, out)}：${Object.keys(entries).length} 个文件，${(statSync(out).size / 1024).toFixed(0)} KB`);
