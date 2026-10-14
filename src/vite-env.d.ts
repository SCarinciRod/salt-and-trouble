import type { Simulation } from './game/simulation/world';

declare global {
  interface Window {
    __gameTest?: {
      advance: (seconds: number) => void;
      snapshot: () => ReturnType<Simulation['snapshot']>;
    };
    __gameProfile?: {
      snapshot: () => {
        seed: number;
        config: import('./game/config').GameConfig;
        renderer: {
          vendor: string;
          device: string;
          version: string;
          canvasWidth: number;
          canvasHeight: number;
          resolution: number;
        };
        elapsed: number;
        status: import('./game/types').MatchStatus;
        reason: import('./game/types').EndReason | null;
        hp: number;
        score: number;
        entities: { ships: number; projectiles: number; effects: number };
        frameIntervals: number[];
        samples: {
          elapsed: number;
          ships: number;
          projectiles: number;
          effects: number;
          displayObjects: number;
        }[];
      };
    };
  }
}

export {};
