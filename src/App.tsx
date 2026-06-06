import { useEffect, useState } from "react";
import { loadConfig, type ConfigState } from "./lib/fsx/config";
import { Tree } from "./features/browser/Tree";
import { DetailPane } from "./features/browser/DetailPane";
import { Editor } from "./features/editor/Editor";
import { useAppStore } from "./app/store";

export default function App() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);
  const editing = useAppStore((s) => s.editing);

  useEffect(() => {
    loadConfig().then(
      (c) => {
        if (c.status === "ok") {
          useAppStore
            .getState()
            .setPaths({ gfxRoot: c.gfxRoot, modsPath: c.config.modsPath });
        }
        setCfg(c);
      },
      (err) => setCfg({ status: "error", problems: [String(err)] }),
    );
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
