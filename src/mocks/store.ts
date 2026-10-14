import {
  parseMatchRecord,
  type HistoryRequest,
  type MatchRecord,
  type PagedResponse,
  type RankingEntry,
  type RankingRequest,
} from '../data/contracts';

export type MockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export const CONFIRMED_PREFIX = 'salt-and-trouble:confirmed:v1:';
export type FixtureMode = 'none' | 'standard' | 'all';

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class MockStore {
  constructor(
    private readonly storage: MockStorage,
    private readonly fixtures: MatchRecord[],
  ) {}

  register(record: MatchRecord): { record: MatchRecord; created: boolean } {
    const existing = this.records('all').find((item) => item.id === record.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record))
        throw new StoreError('Match identifier conflict', 409);
      return { record: existing, created: false };
    }
    try {
      this.storage.setItem(CONFIRMED_PREFIX + record.id, JSON.stringify(record));
    } catch {
      throw new StoreError('Confirmed record storage unavailable', 503);
    }
    return { record: structuredClone(record), created: true };
  }

  history(
    request: HistoryRequest,
    fixtureMode: FixtureMode = 'standard',
  ): PagedResponse<MatchRecord> {
    const items = this.records(fixtureMode)
      .filter((record) => record.playerId === request.playerId)
      .sort(
        (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.id.localeCompare(b.id),
      );
    return this.page(items, request.page, request.pageSize);
  }

  ranking(
    request: RankingRequest,
    fixtureMode: FixtureMode = 'standard',
  ): PagedResponse<RankingEntry> {
    const items = this.records(fixtureMode)
      .filter((record) => record.configKey === request.configKey)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Date.parse(a.completedAt) - Date.parse(b.completedAt) ||
          a.id.localeCompare(b.id),
      )
      .map((record, index) => ({ ...record, rank: index + 1 }));
    return this.page(items, request.page, request.pageSize);
  }

  private records(fixtureMode: FixtureMode): MatchRecord[] {
    const records = new Map<string, MatchRecord>();
    if (fixtureMode !== 'none')
      for (const fixture of this.fixtures) {
        if (fixtureMode === 'all' || !fixture.id.startsWith('fixture-history-'))
          records.set(fixture.id, fixture);
      }
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(CONFIRMED_PREFIX)) continue;
        const raw = this.storage.getItem(key);
        try {
          const record = parseMatchRecord(JSON.parse(raw ?? 'null'));
          if (record && key === CONFIRMED_PREFIX + record.id) records.set(record.id, record);
        } catch {
          /* A corrupt individual record cannot poison the complete collection. */
        }
      }
    } catch {
      throw new StoreError('Could not read confirmed records', 503);
    }
    return [...records.values()].map((record) => structuredClone(record));
  }

  private page<T>(items: T[], page: number, pageSize: number): PagedResponse<T> {
    const from = (page - 1) * pageSize;
    return { items: items.slice(from, from + pageSize), page, pageSize, total: items.length };
  }
}
