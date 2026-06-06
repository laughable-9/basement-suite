import { create } from "zustand";
import type { Catalog, CatalogEntry, CategoryId } from "../lib/catalog/types";

export interface Paths {
  gfxRoot: string;
  modsPath: string;
}

export interface EditingTarget {
  /** Absolute path of the spritesheet being edited */
  sheetPath: string;
  /** anm2 providing the crop-grid overlay, if opened from one */
  anm2Path: string | null;
}

export interface PlayerJump {
  /** Which tab's player should jump (multiple players stay mounted) */
  tabId: string;
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

/** An opened document tab. Paths are absolute. */
export interface WorkTab {
  /** Unique: catalog entry key, or "file:<abs path>" for raw-tree opens */
  id: string;
  title: string;
  anm2Path: string | null;
  sheetPath: string | null;
  /** Character costume overlay anm2 (hair/wings), absolute */
  costumeAnm2Path?: string | null;
  /** Editor open inside this tab, if any (per-tab editing state, U4) */
  editing?: EditingTarget | null;
}

/** "files" is the raw-tree escape hatch, not a catalog category */
export type RailCategory = CategoryId | "files";

export interface HomeLocation {
  category: RailCategory;
  subcategory: string | null;
}

interface AppState {
  /** Set once after config validation in App */
  paths: Paths | null;
  setPaths: (paths: Paths) => void;
  /** Semantic catalog (UI_PLAN §2); null while loading */
  catalog: Catalog | null;
  setCatalog: (catalog: Catalog) => void;

  /* ---- tabs ---- */
  tabs: WorkTab[];
  /** "home" or a WorkTab id */
  activeTabId: string;
  openTab: (tab: WorkTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;

  /* ---- home browser ---- */
  home: HomeLocation;
  setHome: (home: HomeLocation) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** Open/close the editor inside a tab (null target closes it) */
  setTabEditing: (tabId: string, editing: EditingTarget | null) => void;
  playerJump: PlayerJump | null;
  requestPlayerJump: (tabId: string, animName: string, tick: number) => void;

  toasts: Toast[];
  addToast: (text: string, kind: Toast["kind"]) => void;
  dismissToast: (id: number) => void;

  /** Global animation playback speed multiplier (player + hover thumbnails) */
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
}

let nextToastId = 1;

const SPEED_KEY = "bs:playbackSpeed";

function initialSpeed(): number {
  const stored = Number(localStorage.getItem(SPEED_KEY));
  return Number.isFinite(stored) && stored >= 0.1 && stored <= 2 ? stored : 0.5;
}

export const useAppStore = create<AppState>((set) => ({
  paths: null,
  setPaths: (paths) => set({ paths }),
  catalog: null,
  setCatalog: (catalog) => set({ catalog }),

  tabs: [],
  activeTabId: "home",
  openTab: (tab) =>
    set((s) => ({
      tabs: s.tabs.some((t) => t.id === tab.id) ? s.tabs : [...s.tabs, tab],
      activeTabId: tab.id,
    })),
  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let active = s.activeTabId;
      if (active === id) {
        active = tabs[Math.min(idx, tabs.length - 1)]?.id ?? "home";
      }
      return { tabs, activeTabId: active };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),

  home: { category: "characters", subcategory: null },
  setHome: (home) => set({ home, activeTabId: "home", searchQuery: "" }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery, activeTabId: "home" }),

  setTabEditing: (tabId, editing) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, editing } : t)),
    })),
  playerJump: null,
  requestPlayerJump: (tabId, animName, tick) =>
    set((s) => ({
      playerJump: { tabId, animName, tick, seq: (s.playerJump?.seq ?? 0) + 1 },
    })),

  toasts: [],
  addToast: (text, kind) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToastId++, text, kind }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  playbackSpeed: initialSpeed(),
  setPlaybackSpeed: (speed) => {
    localStorage.setItem(SPEED_KEY, String(speed));
    set({ playbackSpeed: speed });
  },
}));

/** Build a WorkTab from a catalog entry (absolutizing gfx-relative paths). */
export function tabFromEntry(entry: CatalogEntry, gfxRoot: string): WorkTab {
  return {
    id: entry.key,
    title: entry.name,
    anm2Path: entry.anm2Path ? `${gfxRoot}/${entry.anm2Path}` : null,
    sheetPath: entry.sheetPath ? `${gfxRoot}/${entry.sheetPath}` : null,
    costumeAnm2Path: entry.costumeAnm2Path
      ? `${gfxRoot}/${entry.costumeAnm2Path}`
      : null,
  };
}
