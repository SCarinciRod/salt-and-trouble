import { DEFAULT_OPTIONS, validateOptions, type PlayerOptions } from '../game/config';

export const SETTINGS_KEY = 'salt-and-trouble:options:v1';
type OptionsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadOptions(storage?: OptionsStorage): PlayerOptions {
  try {
    const source = storage ?? window.localStorage;
    const stored: unknown = JSON.parse(source.getItem(SETTINGS_KEY) ?? 'null');
    if (
      typeof stored === 'object' &&
      stored !== null &&
      'sessionSeconds' in stored &&
      'spawnSeconds' in stored
    ) {
      const { sessionSeconds, spawnSeconds } = stored;
      if (typeof sessionSeconds === 'number' && typeof spawnSeconds === 'number') {
        const options = { sessionSeconds, spawnSeconds };
        if (Object.keys(validateOptions(options)).length === 0) return options;
      }
    }
  } catch {
    /* Storage may be unavailable or contain an older/corrupt value. */
  }
  return { ...DEFAULT_OPTIONS };
}

export function saveOptions(options: PlayerOptions, storage?: OptionsStorage): boolean {
  if (Object.keys(validateOptions(options)).length) return false;
  try {
    (storage ?? window.localStorage).setItem(SETTINGS_KEY, JSON.stringify(options));
    return true;
  } catch {
    return false;
  }
}
