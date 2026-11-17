import { expect, it } from 'vitest';
import { studioPhotoPeriod } from './studio-photo-time';
it.each([
 ['2026-11-17T00:29:59Z','night'], ['2026-11-17T00:30:00Z','day'],
 ['2026-11-17T12:29:59Z','day'], ['2026-11-17T12:30:00Z','night'],
 ['2026-11-17T18:30:00Z','night'], ['2026-11-17T23:59:59Z','night'],
 ['2026-11-17T06:00:00-08:00','night'],
])('uses proposed studio IST boundaries for %s', (instant, expected) => {
 expect(studioPhotoPeriod(new Date(instant))).toBe(expected);
});
