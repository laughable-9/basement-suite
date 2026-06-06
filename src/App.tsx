import { useEffect, useState } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { loadConfig, type ConfigState } from "./lib/fsx/config";
import { Tree } from "./features/browser/Tree";
import { DetailPane } from "./features/browser/DetailPane";
import { Editor } from "./features/editor/Editor";
import { useAppStore, type EditingTarget } from "./app/store";
import type { Entry } from "./lib/fsx/fs";

const SESSION_KEY = "bs:session";

interface Session {
  selected: Entry | null;
  editing: EditingTarget | null;
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

/** Restore last session's selection/editor, skipping anything now missing. */
async function restoreSession(): Promise<void> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Session;
    const store = useAppStore.getState();
    if (s.selected && (await exists(s.selected.path))) {
      store.select(s.selected);
    }
    if (
      s.editing &&
      (await exists(s.editing.sheetPath)) &&
      (!s.editing.anm2Path || (await exists(s.editing.anm2Path)))
    ) {
      store.openEditor(s.editing.sheetPath, s.editing.anm2Path);
    }
  } catch {
    // Corrupt/stale session data — start fresh.
  }
}

export default function App() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);
  const editing = useAppStore((s) => s.editing);

  useEffect(() => {
    loadConfig().then(
      async (c) => {
        if (c.status === "ok") {
          useAppStore
            .getState()
            .setPaths({ gfxRoot: c.gfxRoot, modsPath: c.config.modsPath });
          await restoreSession();
        }
        setCfg(c);
      },
      (err) => setCfg({ status: "error", problems: [String(err)] }),
    );
  }, []);

  // Persist selection/editor across launches.
  useEffect(() => {
    return useAppStore.subscribe((s) => {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          selected: s.selected,
          editing: s.editing,
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
    <div className="workbench">
      <header className="topbar">
        <strong>Basement Suite</strong>
        <span className="topbar-path" title={cfg.gfxRoot}>
          {cfg.gfxRoot}
        </span>
      </header>
      <Toasts />
      <main className={`panes${editing ? " with-editor" : ""}`}>
        <aside className="pane pane-tree">
          <Tree root={cfg.gfxRoot} />
        </aside>
        {editing && (
          <section className="pane pane-editor">
            <Editor
              key={`${editing.sheetPath}|${editing.anm2Path}`}
              target={editing}
            />
          </section>
        )}
        <section className="pane pane-detail">
          <DetailPane />
        </section>
      </main>
    </div>
  );
}
