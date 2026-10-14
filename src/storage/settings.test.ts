import { describe, expect, it } from 'vitest';
import { loadOptions, saveOptions, SETTINGS_KEY } from './settings';

function memoryStorage(initial?: string): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>(initial ? [[SETTINGS_KEY, initial]] : []);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('settings persistence', () => {
  it('round-trips saved settings', () => {
    const storage = memoryStorage();
    expect(saveOptions({ sessionSeconds: 90, spawnSeconds: 2 }, storage)).toBe(true);
    expect(loadOptions(storage)).toEqual({ sessionSeconds: 90, spawnSeconds: 2 });
  });
  it.each([
    'not json',
    'null',
    '{}',
    '{"sessionSeconds":0,"spawnSeconds":2}',
    '{"sessionSeconds":"90","spawnSeconds":2}',
  ])('recovers from corrupt storage: %s', (value) => {
    expect(loadOptions(memoryStorage(value))).toEqual({ sessionSeconds: 120, spawnSeconds: 3 });
  });
  it('recovers when browser storage is blocked', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadOptions(storage)).toEqual({ sessionSeconds: 120, spawnSeconds: 3 });
    expect(saveOptions({ sessionSeconds: 90, spawnSeconds: 2 }, storage)).toBe(false);
  });
  it('does not persist invalid values', () => {
    const storage = memoryStorage();
    expect(saveOptions({ sessionSeconds: 181, spawnSeconds: 2 }, storage)).toBe(false);
    expect(storage.getItem(SETTINGS_KEY)).toBe(null);
  });
});
