import axios from 'axios';
import type { MatchResult } from '../game/types';
import {
  isObject,
  parseMatchRecord,
  parsePage,
  type HistoryRequest,
  type RankingRequest,
  type PagedResponse,
  type PageRequest,
} from './contracts';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 1200,
  headers: { Accept: 'application/json' },
});

function validatePage<T extends { id: string }>(
  page: PagedResponse<T>,
  request: PageRequest,
  belongs: (item: T, index: number) => boolean,
) {
  const expected = Math.max(
    0,
    Math.min(page.pageSize, page.total - (page.page - 1) * page.pageSize),
  );
  if (
    page.page !== request.page ||
    page.pageSize !== request.pageSize ||
    page.items.length !== expected ||
    new Set(page.items.map((item) => item.id)).size !== page.items.length ||
    !page.items.every(belongs)
  )
    throw new Error('Invalid page for requested filters');
  return page;
}

export const api = {
  async ranking(params: RankingRequest, signal?: AbortSignal) {
    const { data } = await httpClient.get<unknown>('/ranking', { params, signal });
    const page = parsePage(data, (item) => {
      const record = parseMatchRecord(item);
      if (
        !record ||
        !isObject(item) ||
        typeof item.rank !== 'number' ||
        !Number.isInteger(item.rank) ||
        item.rank < 1
      )
        return null;
      return { ...record, rank: item.rank };
    });
    return validatePage(
      page,
      params,
      (item, index) =>
        item.configKey === params.configKey &&
        item.rank === (params.page - 1) * params.pageSize + index + 1,
    );
  },
  async history(params: HistoryRequest, signal?: AbortSignal) {
    const { data } = await httpClient.get<unknown>('/matches', { params, signal });
    return validatePage(
      parsePage(data, parseMatchRecord),
      params,
      (item) => item.playerId === params.playerId,
    );
  },
  async register(result: MatchResult) {
    const { data } = await httpClient.post<unknown>('/matches', result);
    const record = parseMatchRecord(data);
    if (!record || JSON.stringify(record) !== JSON.stringify(parseMatchRecord(result)))
      throw new Error('Invalid registration confirmation');
    return record;
  },
};
