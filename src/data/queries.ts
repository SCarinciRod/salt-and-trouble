import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchResult } from '../game/types';
import {
  addPending,
  getConfirmation,
  getPending,
  getPendingRevision,
  loadLastResult,
  rememberConfirmation,
  removePending,
  signalPendingChange,
  subscribePending,
} from '../storage/results';
import { network } from '../mocks/scenarios';
import { api } from './api';
import { PAGE_SIZE } from './contracts';
import { useDataServices } from './services';

export function retryQuery(failureCount: number, error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return failureCount < 1 && !(status && status >= 400 && status < 500);
}

export function useRanking(configKey: string, page: number) {
  const { ready } = useDataServices();
  return useQuery({
    queryKey: ['ranking', configKey, page, PAGE_SIZE],
    queryFn: ({ signal }) => api.ranking({ configKey, page, pageSize: PAGE_SIZE }, signal),
    enabled: ready,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryQuery,
    retryDelay: 250,
  });
}
export function useHistory(playerId: string, page: number) {
  const { ready } = useDataServices();
  return useQuery({
    queryKey: ['history', playerId, page, PAGE_SIZE],
    queryFn: ({ signal }) => api.history({ playerId, page, pageSize: PAGE_SIZE }, signal),
    enabled: ready,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryQuery,
    retryDelay: 250,
  });
}

export type RegistrationState = { status: 'pending' | 'submitting' | 'saved'; message?: string };

export function useMatchSubmission() {
  const { ready } = useDataServices();
  const client = useQueryClient();
  const revision = useSyncExternalStore(subscribePending, getPendingRevision, () => 0);
  const scenarioVersion = useSyncExternalStore(network.subscribe, network.getVersion, () => 0);
  const [outcomes, setOutcomes] = useState<Record<string, RegistrationState>>({});
  const attempted = useRef(new Set<string>());
  const inFlight = useRef(new Map<string, Promise<void>>());
  const previousScenario = useRef(-1);
  const { mutateAsync } = useMutation({
    mutationKey: ['register-match'],
    mutationFn: api.register,
    retry: 0,
  });

  const send = useCallback(
    (result: MatchResult): Promise<void> => {
      const running = inFlight.current.get(result.id);
      if (running) return running;
      if (!ready || getConfirmation(result.id)) return Promise.resolve();
      attempted.current.add(result.id);
      setOutcomes((current) => ({ ...current, [result.id]: { status: 'submitting' } }));
      const request = mutateAsync(result)
        .then(async (record) => {
          rememberConfirmation(record);
          removePending(record.id);
          setOutcomes((current) => ({ ...current, [record.id]: { status: 'saved' } }));
          // Invalidation alone may reuse an initial fetch that has no cached data yet.
          // Cancel that older snapshot before fetching the newly confirmed collection.
          const recordsQuery = (query: { queryKey: readonly unknown[] }) =>
            ['ranking', 'history'].includes(String(query.queryKey[0]));
          await client.cancelQueries({ predicate: recordsQuery });
          await client.invalidateQueries({ predicate: recordsQuery });
        })
        .catch(() => {
          setOutcomes((current) => ({
            ...current,
            [result.id]: {
              status: 'pending',
              message:
                'The harbor office did not confirm this report. You can retry and keep playing.',
            },
          }));
        })
        .finally(() => {
          inFlight.current.delete(result.id);
          signalPendingChange();
        });
      inFlight.current.set(result.id, request);
      return request;
    },
    [ready, mutateAsync, client],
  );

  useEffect(() => {
    if (!ready) return;
    if (previousScenario.current !== scenarioVersion) {
      attempted.current.clear();
      previousScenario.current = scenarioVersion;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const lastResult = loadLastResult();
      const pending = getPending();
      if (
        lastResult &&
        !getConfirmation(lastResult.id) &&
        !pending.some((record) => record.id === lastResult.id)
      ) {
        addPending(lastResult);
        pending.push(lastResult);
      }
      for (const result of pending)
        if (!attempted.current.has(result.id) && !getConfirmation(result.id)) void send(result);
    });
    return () => {
      active = false;
    };
  }, [ready, revision, scenarioVersion, send]);

  function stateFor(id: string): RegistrationState {
    return outcomes[id] ?? (getConfirmation(id) ? { status: 'saved' } : { status: 'pending' });
  }
  function retry(id?: string) {
    const pending = getPending().filter((record) => !id || record.id === id);
    if (id && pending.length === 0) {
      const last = loadLastResult();
      if (last?.id === id && !getConfirmation(id)) pending.push(last);
    }
    for (const result of pending) void send(result);
  }
  return {
    stateFor,
    retry,
    pendingCount: getPending().filter((record) => !getConfirmation(record.id)).length,
    serviceReady: ready,
  };
}
