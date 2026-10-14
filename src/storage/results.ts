import type { MatchResult } from '../game/types';
import { parseMatchRecord, parseMatchResult, type MatchRecord } from '../data/contracts';

type ResultStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const LAST_KEY = 'salt-and-trouble:result:v1';
const LEGACY_OUTBOX_KEY = 'salt-and-trouble:outbox:v1';
const OUTBOX_PREFIX = 'salt-and-trouble:outbox:v2:';
const PLAYER_KEY = 'salt-and-trouble:player:v1';
const RECEIPT_PREFIX = 'salt-and-trouble:receipt:v1:';
const PENDING_EVENT = 'salt-and-trouble:pending-changed';
let pendingRevision = 0;
let ephemeralPlayer: string | undefined;
const memoryQueues = new WeakMap<object, Map<string, MatchResult>>();
const memoryResults = new WeakMap<object, MatchResult>();
const memoryReceipts = new WeakMap<object, Map<string, MatchRecord>>();
const blockedStorage: ResultStorage = {
  getItem: () => {
    throw new Error('Storage unavailable');
  },
  setItem: () => {
    throw new Error('Storage unavailable');
  },
  removeItem: () => {
    throw new Error('Storage unavailable');
  },
  key: () => null,
  length: 0,
};

function source(storage?: ResultStorage): ResultStorage {
  try {
    return storage ?? localStorage;
  } catch {
    return blockedStorage;
  }
}
function queue(storage: ResultStorage) {
  let values = memoryQueues.get(storage);
  if (!values) {
    values = new Map();
    memoryQueues.set(storage, values);
  }
  return values;
}

function read(key: string, storage: ResultStorage): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function write(key: string, value: unknown, storage: ResultStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function signalPendingChange() {
  pendingRevision++;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_EVENT));
}
export const getPendingRevision = () => pendingRevision;
export function subscribePending(listener: () => void) {
  const storageEvent = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key.startsWith(OUTBOX_PREFIX) ||
      event.key.startsWith(RECEIPT_PREFIX)
    ) {
      pendingRevision++;
      listener();
    }
  };
  window.addEventListener(PENDING_EVENT, listener);
  window.addEventListener('storage', storageEvent);
  return () => {
    window.removeEventListener(PENDING_EVENT, listener);
    window.removeEventListener('storage', storageEvent);
  };
}
export function getConfirmation(id: string, storage?: ResultStorage): MatchRecord | null {
  const store = source(storage);
  return memoryReceipts.get(store)?.get(id) ?? parseMatchRecord(read(RECEIPT_PREFIX + id, store));
}
export function rememberConfirmation(record: MatchRecord, storage?: ResultStorage) {
  const store = source(storage);
  let receipts = memoryReceipts.get(store);
  if (!receipts) {
    receipts = new Map();
    memoryReceipts.set(store, receipts);
  }
  receipts.set(record.id, record);
  const saved = write(RECEIPT_PREFIX + record.id, record, store);
  signalPendingChange();
  return saved;
}
export function loadLastResult(storage?: ResultStorage): MatchResult | null {
  const store = source(storage);
  const saved = parseMatchResult(read(LAST_KEY, store));
  const memory = memoryResults.get(store);
  if (memory && (!saved || Date.parse(memory.completedAt) >= Date.parse(saved.completedAt)))
    return memory;
  return saved;
}
export function saveLastResult(result: MatchResult, storage?: ResultStorage) {
  const store = source(storage);
  memoryResults.set(store, result);
  return write(LAST_KEY, result, store);
}
export function getPending(storage?: ResultStorage): MatchResult[] {
  const store = source(storage);
  const values = new Map(queue(store));
  const legacy = read(LEGACY_OUTBOX_KEY, store);
  if (Array.isArray(legacy)) {
    let migrated = true;
    for (const record of legacy
      .map(parseMatchResult)
      .filter((item): item is MatchResult => item !== null)) {
      values.set(record.id, record);
      if (!write(OUTBOX_PREFIX + record.id, record, store)) migrated = false;
    }
    if (migrated) {
      try {
        store.removeItem(LEGACY_OUTBOX_KEY);
      } catch {
        /* Keep the legacy source if removal is blocked. */
      }
    }
  }
  try {
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index);
      if (!key?.startsWith(OUTBOX_PREFIX)) continue;
      const record = parseMatchResult(read(key, store));
      if (record) values.set(record.id, record);
    }
  } catch {
    /* In-memory pending records remain available. */
  }
  return [...values.values()].sort(
    (a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id),
  );
}
export function addPending(result: MatchResult, storage?: ResultStorage) {
  const store = source(storage);
  queue(store).set(result.id, result);
  const saved = write(OUTBOX_PREFIX + result.id, result, store);
  if (saved) queue(store).delete(result.id);
  signalPendingChange();
  return saved;
}
export function persistPending(storage?: ResultStorage) {
  const store = source(storage);
  let saved = true;
  for (const result of getPending(store)) if (!addPending(result, store)) saved = false;
  return saved;
}
export function removePending(id: string, storage?: ResultStorage) {
  const store = source(storage);
  queue(store).delete(id);
  try {
    store.removeItem(OUTBOX_PREFIX + id);
    signalPendingChange();
    return true;
  } catch {
    signalPendingChange();
    return false;
  }
}
export function getPlayerId() {
  try {
    const saved = localStorage.getItem(PLAYER_KEY);
    if (saved) return saved;
    const id = (ephemeralPlayer ??= crypto.randomUUID());
    localStorage.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    return (ephemeralPlayer ??= crypto.randomUUID());
  }
}
