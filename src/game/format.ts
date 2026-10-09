/** 数字的写法：十万以下带千分位，再往上用万、亿、万亿，太大了用科学计数法 */
export function fmt(n: number): string {
  const v = Math.floor(n + 1e-9);
  const a = Math.abs(v);
  if (a < 1e5) return v.toLocaleString('en-US');
  if (a < 1e8) return short(v / 1e4) + '万';
  if (a < 1e12) return short(v / 1e8) + '亿';
  if (a < 1e16) return short(v / 1e12) + '万亿';
  return v.toExponential(2).replace('e+', 'e');
}

/** 三位有效数字：12.3、123、1,234 */
function short(x: number): string {
  const a = Math.abs(x);
  const digits = a < 10 ? 2 : a < 100 ? 1 : 0;
  const s = (Math.floor(x * 10 ** digits) / 10 ** digits).toFixed(digits);
  return digits ? s.replace(/\.?0+$/, '') : Number(s).toLocaleString('en-US');
}

/** 每秒的变化量，带正负号 */
export function fmtRate(r: number): string {
  const sign = r < 0 ? '−' : '+';
  const a = Math.abs(r);
  let body: string;
  if (a >= 1e5) body = fmt(a);
  else if (a >= 100 || Math.abs(a - Math.round(a)) < 1e-9) body = fmt(Math.round(a));
  else if (a >= 1) body = a.toFixed(1);
  else body = a.toFixed(2);
  return sign + body + '/秒';
}

/** 秒数写成 m:ss 或 h:mm:ss */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r;
}
