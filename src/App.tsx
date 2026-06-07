import { useEffect, useState } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { loadConfig, type ConfigState } from "./lib/fsx/config";
import { loadCatalog } from "./lib/catalog/load";
import { AppShell } from "./features/shell/AppShell";
import { ErrorBoundary } from "./app/ErrorBoundary";
import {
  useAppStore,
  type HomeLocation,
  type WorkTab,
} from "./app/store";

const SESSION_KEY = "bs:session2";

interface Session {
  tabs: WorkTab[];
  activeTabId: string;
  home: HomeLocation;
}

/** Restore last session's tabs/home, skipping tabs whose files vanished. */
async function restoreSession(): Promise<void> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Session;
    const tabs: WorkTab[] = [];
    for (const tab of s.tabs ?? []) {
      const path = tab.anm2Path ?? tab.sheetPath;
      if (path && (await exists(path))) tabs.push(tab);
    }
    useAppStore.setState({
      tabs,
      activeTabId:
        s.activeTabId === "home" || tabs.some((t) => t.id === s.activeTabId)
          ? s.activeTabId
          : "home",
      home: s.home ?? { category: "characters", subcategory: null },
    });
  } catch {
    // Corrupt/stale session data — start fresh.
  }
}

function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => dismiss(toasts[0].id), 4500);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);

  useEffect(() => {
    loadConfig().then(
      async (c) => {
        if (c.status === "ok") {
          useAppStore
            .getState()
            .setPaths({ gfxRoot: c.gfxRoot, modsPath: c.config.modsPath });
          await restoreSession();
          // Catalog builds in the background; UI shows progress meanwhile.
          loadCatalog(c.gfxRoot).then(
            (catalog) => useAppStore.getState().setCatalog(catalog),
            (e) =>
              useAppStore
                .getState()
                .addToast(`Catalog failed to load: ${e}`, "error"),
          );
        }
        setCfg(c);
      },
      (err) => setCfg({ status: "error", problems: [String(err)] }),
    );
  }, []);

  // Persist tabs/home across launches.
  useEffect(() => {
    return useAppStore.subscribe((s) => {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          tabs: s.tabs,
          activeTabId: s.activeTabId,
          home: s.home,
        } satisfies Session),
      );
    });
  }, []);

  // Surface unexpected failures as toasts instead of silent console noise.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      useAppStore.getState().addToast(String(e.reason), "error");
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  if (cfg === null) {
    return <div className="screen-center">Loading config…</div>;
  }

  if (cfg.status === "error") {
    return (
      <div className="screen-center">
        <div className="error-card">
          <h1>Can't start</h1>
          <ul>
            {cfg.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toasts />
      <AppShell />
    </ErrorBoundary>
  );
}
