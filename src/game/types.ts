export type Action = 'forward' | 'left' | 'right' | 'front' | 'port' | 'starboard';
export type Actions = Partial<Record<Action, boolean>>;
export type EnemyKind = 'chaser' | 'shooter';
export type Weapon = 'front' | 'port' | 'starboard' | 'enemy';
export type MatchStatus = 'running' | 'paused' | 'finished';
export type EndReason = 'time' | 'death';
export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export interface Ship extends Point {
  id: string;
  angle: number;
  hp: number;
  maxHp: number;
}
export interface Enemy extends Ship {
  kind: EnemyKind;
  cooldown: number;
}
export interface Projectile extends Point {
  id: string;
  angle: number;
  owner: 'player' | 'enemy';
  weapon: Weapon;
  damage: number;
  speed: number;
  remaining: number;
  remainingRange: number;
}
export interface GameEffect extends Point {
  id: string;
  kind: 'shot' | 'impact' | 'explosion';
  remaining: number;
  duration: number;
}
export interface HudSnapshot {
  hp: number;
  maxHp: number;
  score: number;
  remaining: number;
  status: MatchStatus;
}
export interface MatchResult {
  id: string;
  playerId: string;
  playerName: string;
  completedAt: string;
  score: number;
  playedSeconds: number;
  reason: EndReason;
  config: import('./config').GameConfig;
}
