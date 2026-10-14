import { describe, expect, it } from 'vitest';
import { validateOptions } from './config';

describe('player options', () => {
  it.each([60, 120, 180])('accepts a %s-second match', (sessionSeconds) => {
    expect(validateOptions({ sessionSeconds, spawnSeconds: 3 })).toEqual({});
  });
  it.each([59, 181, 0, NaN, Infinity])('rejects invalid match duration %s', (sessionSeconds) => {
    expect(validateOptions({ sessionSeconds, spawnSeconds: 3 }).sessionSeconds).toBeTruthy();
  });
  it.each([0.5, 3, 15])('accepts a %s-second spawn interval', (spawnSeconds) => {
    expect(validateOptions({ sessionSeconds: 120, spawnSeconds })).toEqual({});
  });
  it.each([0, -1, 0.49, 15.01, NaN, Infinity])(
    'rejects unsafe spawn interval %s',
    (spawnSeconds) => {
      expect(validateOptions({ sessionSeconds: 120, spawnSeconds }).spawnSeconds).toBeTruthy();
    },
  );
});
