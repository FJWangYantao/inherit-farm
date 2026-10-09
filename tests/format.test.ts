import { describe, expect, it } from 'vitest';
import { fmt, fmtRate } from '../src/game/format';

describe('数字写法', () => {
  it('十万以下带千分位，往上用万、亿、万亿', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(99999.9)).toBe('99,999');
    expect(fmt(100000)).toBe('10万');
    expect(fmt(312500)).toBe('31.2万');
    expect(fmt(1562500)).toBe('156万');
    expect(fmt(12345678)).toBe('1,234万');
    expect(fmt(250000000)).toBe('2.5亿');
    expect(fmt(3e12)).toBe('3万亿');
    expect(fmt(1.5e17)).toBe('1.50e17');
  });

  it('每秒变化量带正负号', () => {
    expect(fmtRate(12)).toBe('+12/秒');
    expect(fmtRate(1.25)).toBe('+1.3/秒');
    expect(fmtRate(0.25)).toBe('+0.25/秒');
    expect(fmtRate(-1016.4)).toBe('−1,016/秒');
    expect(fmtRate(156000)).toBe('+15.6万/秒');
  });
});
