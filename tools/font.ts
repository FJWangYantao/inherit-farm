// 把标题字体（站酷小薇）裁成只含游戏里用到的汉字，整套字体 2 MB 多，裁完只剩几十 KB。
// npm run build 会先跑这一步；加了新文字后 npm run dev 前也可以手动跑：npm run font
//
// 收字的范围是 src/ 下所有 .ts 文件和 index.html 里出现的中日韩字符和全角标点，
// 所以游戏里的文字都要写在这些文件里（目前就是这样），不要从别处动态拼进来。

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = join(ROOT, 'node_modules/@fontsource/zcool-xiaowei/files/zcool-xiaowei-chinese-simplified-400-normal.woff2');
const OUT_DIR = join(ROOT, 'src/fonts');
const OUT = join(OUT_DIR, 'zcool-xiaowei-subset.woff2');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

const text = [join(ROOT, 'index.html'), ...files(join(ROOT, 'src'))].map(p => readFileSync(p, 'utf8')).join('');
// 中日韩统一表意文字、中文标点、全角符号
const chars = [...new Set(text.match(/[　-〿一-鿿＀-￯]/g) ?? [])].sort().join('');

const out = await subsetFont(readFileSync(SOURCE), chars, { targetFormat: 'woff2' });
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, out);
console.log(`标题字体：${chars.length} 个字，${(out.length / 1024).toFixed(1)} KB → ${OUT.slice(ROOT.length)}`);
