import { useEffect, useState } from "react";
import { loadConfig, type ConfigState } from "./lib/fsx/config";
import { Tree } from "./features/browser/Tree";
import { DetailPane } from "./features/browser/DetailPane";

export default function App() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);

  useEffect(() => {
    loadConfig().then(setCfg, (err) =>
      setCfg({ status: "error", problems: [String(err)] }),
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
      <main className="panes">
        <aside className="pane pane-tree">
          <Tree root={cfg.gfxRoot} />
        </aside>
        <section className="pane pane-detail">
          <DetailPane />
        </section>
      </main>
    </div>
  );
}
