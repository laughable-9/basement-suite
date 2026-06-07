// Mods tab content. v1-mid: list mod folders on the left, file tree of the
// selected mod in the middle, side-by-side / overlay diff on the right.
// First-run state is a hint card explaining the concept of an "active mod".

import { useEffect, useState } from "react";
import { useAppStore } from "../../app/store";
import { listMods, type ModSummary } from "../../lib/mods/listMods";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModsPanel() {
  const paths = useAppStore((s) => s.paths);
  const activeMod = useAppStore((s) => s.activeMod);
  const setActiveMod = useAppStore((s) => s.setActiveMod);
  const [mods, setMods] = useState<ModSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!paths) return;
    let cancelled = false;
    setLoading(true);
    listMods(paths.modsPath).then((list) => {
      if (cancelled) return;
      setMods(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [paths]);

  if (!paths) return null;
  const current = mods.find((m) => m.folderName === selected) ?? null;

  return (
    <div className="mods-panel">
      <aside className="mods-list">
        <header className="panel-header">
          Mods <span className="panel-count">{mods.length}</span>
        </header>
        <div className="panel-body">
          {loading && <div className="detail-empty">Scanning mods…</div>}
          {!loading && mods.length === 0 && <FirstRunHint />}
          {!loading &&
            mods.map((m) => {
              const isActive = activeMod === m.folderName;
              return (
                <button
                  key={m.folderName}
                  className={`mod-row${
                    selected === m.folderName ? " selected" : ""
                  }${isActive ? " is-active" : ""}`}
                  onClick={() => setSelected(m.folderName)}
                  title={m.path}
                >
                  <span className="mod-row-name">
                    {m.displayName}
                    {isActive && <span className="mod-active-badge">active</span>}
                  </span>
                  <span className="mod-row-meta">
                    {m.files.length} file{m.files.length === 1 ? "" : "s"}
                    {m.metadata.version ? ` · v${m.metadata.version}` : ""}
                    {` · ${fmtBytes(m.totalBytes)}`}
                  </span>
                </button>
              );
            })}
        </div>
      </aside>
      <section className="mods-detail">
        {current ? (
          <ModDetail
            mod={current}
            isActive={activeMod === current.folderName}
            onSetActive={() => setActiveMod(current.folderName)}
          />
        ) : (
          <EmptyDetail />
        )}
      </section>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="detail-empty">
      Pick a mod on the left to see its files.
    </div>
  );
}

function ModDetail({
  mod,
  isActive,
  onSetActive,
}: {
  mod: ModSummary;
  isActive: boolean;
  onSetActive: () => void;
}) {
  return (
    <div className="mod-detail">
      <header className="mod-detail-header">
        <div className="mod-detail-title">
          <h2>{mod.displayName}</h2>
          <button
            className="save-btn"
            disabled={isActive}
            onClick={onSetActive}
            title={
              isActive
                ? "This is already the active mod"
                : "Make this the active mod (saves go here, previews overlay from here)"
            }
          >
            {isActive ? "Active" : "Set as active"}
          </button>
        </div>
        <div className="mod-detail-meta">
          {mod.folderName}
          {mod.metadata.version ? ` · v${mod.metadata.version}` : ""}
        </div>
        {mod.metadata.description && (
          <p className="mod-detail-desc">{mod.metadata.description}</p>
        )}
      </header>
      <div className="detail-empty">
        File tree + diff coming next (M6.5–M6.7).
      </div>
    </div>
  );
}

/** Shown on the Mods tab when there are no mods yet — explains the concept. */
function FirstRunHint() {
  return (
    <div className="mods-firstrun">
      <h3>No mods yet</h3>
      <p>
        Mods live under <code>modsPath</code>. Each is a folder containing{" "}
        <code>metadata.xml</code> and a{" "}
        <code>resources/gfx/</code> tree that mirrors the game's layout.
      </p>
      <p>
        Save a sprite edit (Ctrl+S in the editor) and pick a mod folder
        name — Basement Suite will create the folder, write your PNG into
        the mirrored path, and start treating it as the active mod.
      </p>
      <p className="settings-note">
        Only one mod is "active" in the app at a time. The active mod is
        where your saves land and what the preview overlays. You can switch
        whenever there's more than one.
      </p>
    </div>
  );
}
