import { create } from "zustand";
import type { Entry } from "../lib/fsx/fs";

interface AppState {
  selected: Entry | null;
  select: (entry: Entry | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selected: null,
  select: (entry) => set({ selected: entry }),
}));
