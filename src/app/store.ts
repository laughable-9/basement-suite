import { create } from "zustand";
import type { Entry } from "../lib/fsx/fs";

export interface EditingTarget {
  /** Absolute path of the spritesheet being edited */
  sheetPath: string;
  /** anm2 providing the crop-grid overlay, if opened from one */
  anm2Path: string | null;
}

export interface PlayerJump {
  animName: string;
  tick: number;
  /** Monotonic, so repeating the same jump still triggers the effect */
  seq: number;
}

interface AppState {
  selected: Entry | null;
  select: (entry: Entry | null) => void;
  editing: EditingTarget | null;
  openEditor: (sheetPath: string, anm2Path: string | null) => void;
  closeEditor: () => void;
  playerJump: PlayerJump | null;
  requestPlayerJump: (animName: string, tick: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selected: null,
  select: (entry) => set({ selected: entry }),
  editing: null,
  openEditor: (sheetPath, anm2Path) =>
    set({ editing: { sheetPath, anm2Path } }),
  closeEditor: () => set({ editing: null }),
  playerJump: null,
  requestPlayerJump: (animName, tick) =>
    set((s) => ({
      playerJump: { animName, tick, seq: (s.playerJump?.seq ?? 0) + 1 },
    })),
}));
