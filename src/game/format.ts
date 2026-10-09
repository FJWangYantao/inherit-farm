export function fmt(n: number): string {
  return Math.floor(n + 1e-9).toLocaleString('en-US');
}

export function fmtRate(r: number): string {
  return '+' + (Math.abs(r - Math.round(r)) < 1e-9 ? fmt(Math.round(r)) : r.toFixed(1)) + '/秒';
}

/** 秒数写成 m:ss 或 h:mm:ss */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r;
}
