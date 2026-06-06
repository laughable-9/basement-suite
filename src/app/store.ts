import { create } from "zustand";
import type { Entry } from "../lib/fsx/fs";
import type { Catalog } from "../lib/catalog/types";

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

export interface Toast {
  id: number;
  text: string;
  kind: "success" | "error";
}

export interface Paths {
  gfxRoot: string;
  modsPath: string;
}

interface AppState {
  /** Set once after config validation in App */
  paths: Paths | null;
  setPaths: (paths: Paths) => void;
  /** Semantic catalog (UI_PLAN §2); null while loading */
  catalog: Catalog | null;
  setCatalog: (catalog: Catalog) => void;
  selected: Entry | null;
  select: (entry: Entry | null) => void;
  editing: EditingTarget | null;
  openEditor: (sheetPath: string, anm2Path: string | null) => void;
  closeEditor: () => void;
  playerJump: PlayerJump | null;
  requestPlayerJump: (animName: string, tick: number) => void;
  toasts: Toast[];
  addToast: (text: string, kind: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

export const useAppStore = create<AppState>((set) => ({
  paths: null,
  setPaths: (paths) => set({ paths }),
  catalog: null,
  setCatalog: (catalog) => set({ catalog }),
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
  toasts: [],
  addToast: (text, kind) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToastId++, text, kind }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
