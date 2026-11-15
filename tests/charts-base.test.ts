import { describe, expect, test } from 'bun:test';
import { computeNiceYScale, computePercentile } from '../src/panel/analytics/charts-base';
import {
  createTimeFilterContext,
  generateContinuousDateList,
  getRangeBounds,
  isTimeFilterContext,
  resolveTimeFilterContext
} from '../src/panel/analytics/time-range';
import { escapeHtml } from '../src/shared/format';

describe('Chart helpers, escaping & time range bounds', () => {
  test('computeNiceYScale produces monotonic ticks covering rawMax', () => {
    const scale = computeNiceYScale(3200, 1000, 4);
    expect(scale.yMax).toBeGreaterThanOrEqual(3200);
    expect(scale.yTicks).toHaveLength(5);
    expect(scale.yTicks[0]).toBe(0);
    expect(scale.yTicks[4]).toBe(scale.yMax);
  });

  test('computePercentile interpolates sorted bounds accurately', () => {
    expect(computePercentile([], 0.5)).toBe(0);
    expect(computePercentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(computePercentile([1, 2, 3, 4, 100], 0.95)).toBeCloseTo(80.8, 1);
  });

  test('escapeHtml neutralizes HTML special characters', () => {
    expect(escapeHtml(`<script>"a"&'b'</script>`)).toBe(
      '&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;'
    );
  });

  test('getRangeBounds and generateContinuousDateList handle calendar boundaries and safety limits', () => {
    const now = new Date('2026-11-09T10:00:00');
    expect(getRangeBounds('today', '', '', now)).toEqual({
      startDate: '2026-11-09',
      endDate: '2026-11-09'
    });
    expect(getRangeBounds('yesterday', '', '', now)).toEqual({
      startDate: '2026-11-08',
      endDate: '2026-11-08'
    });
    expect(getRangeBounds('custom', '2026-11-09', '2026-11-05', now)).toEqual({
      startDate: '2026-11-05',
      endDate: '2026-11-09'
    });

    const days = generateContinuousDateList('2026-11-01', '2026-11-05');
    expect(days).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);

    // Exceeds MAX_CONTINUOUS_DAYS (731) cap cleanly without infinite loop
    const capped = generateContinuousDateList('2020-01-01', '2026-11-09');
    expect(capped.length).toBe(731);
  });

  test('createTimeFilterContext and resolveTimeFilterContext manage unified context with cached dates', () => {
    const fixedNow = new Date('2026-11-09T12:00:00');
    const ctx = createTimeFilterContext('last-7-days', '', '', fixedNow);

    expect(isTimeFilterContext(ctx)).toBe(true);
    expect(ctx.range).toBe('last-7-days');
    expect(ctx.startDate).toBe('2026-11-03');
    expect(ctx.endDate).toBe('2026-11-09');
    expect(ctx.dates).toHaveLength(7);
    expect(ctx.dates[0]).toBe('2026-11-03');
    expect(ctx.dates[6]).toBe('2026-11-09');
    expect(ctx.now).toBe(fixedNow);

    // resolveTimeFilterContext preserves existing context instance
    const resolvedDirect = resolveTimeFilterContext(ctx);
    expect(resolvedDirect).toBe(ctx);

    // resolveTimeFilterContext falls back to createTimeFilterContext on string option
    const resolvedFromOption = resolveTimeFilterContext('today', '', '', fixedNow);
    expect(isTimeFilterContext(resolvedFromOption)).toBe(true);
    expect(resolvedFromOption.dates).toEqual(['2026-11-09']);
  });
});
