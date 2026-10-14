import { DEFAULT_OPTIONS, makeGameConfig } from '../game/config';
import { parseMatchRecord, type MatchRecord } from '../data/contracts';

const captains = [
  'Admiral Probably',
  'Captain No Refunds',
  'Sir Sinks-a-Lot',
  'Commodore Oops',
  'Captain Unqualified',
  'The Floating Accountant',
  'Captain Mild Panic',
  'Admiral Overboard',
  'Captain Sea Minus',
  'Deckhand of Doom',
  'Captain Wrong Turn',
  'The Budget Buccaneer',
];

export function makeFixtures(playerId: string): MatchRecord[] {
  const config = makeGameConfig(DEFAULT_OPTIONS);
  const make = (id: string, identity: string, playerName: string, score: number, index: number) =>
    parseMatchRecord({
      id,
      playerId: identity,
      playerName,
      score,
      playedSeconds: config.sessionSeconds,
      reason: 'time',
      completedAt: new Date(Date.UTC(2026, 9, 12, 15, index)).toISOString(),
      config,
    })!;
  return [
    ...captains.map((name, index) =>
      make(`fixture-ranking-${index}`, `fixture-player-${index}`, name, 24 - index, index),
    ),
    ...Array.from({ length: 12 }, (_, index) =>
      make(`fixture-history-${index}`, playerId, 'Captain Bad Idea', index % 6, index + 20),
    ),
  ];
}
