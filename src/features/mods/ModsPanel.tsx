// Mods tab content. v1-mid: list mod folders on the left, file tree of the
// selected mod in the middle, side-by-side / overlay diff on the right.
// First-run state is a hint card explaining the concept of an "active mod".

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { listMods, type ModSummary } from "../../lib/mods/listMods";
import type { ModFile } from "../../lib/mods/fileTree";
import { DiffViewer } from "./DiffViewer";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModsPanel() {
  const paths = useAppStore((s) => s.paths);
  const activeMod = useAppStore((s) => s.activeMod);
  // Switch requests go through AppShell so the dirty-prompt modal is one
  // shared component instead of two copies.
  const requestSwitch = (name: string) => {
    window.dispatchEvent(
      new CustomEvent("bs:request-mod-switch", { detail: name }),
    );
  };
  const [mods, setMods] = useState<ModSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<ModFile | null>(null);

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

  // Drop the open file when the mod changes — it doesn't belong to the new
  // mod's tree.
  useEffect(() => {
    setOpenFile(null);
  }, [selected]);

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
      {current ? (
        <>
          <aside className="mods-files">
            <header className="panel-header">
              Files <span className="panel-count">{current.files.length}</span>
            </header>
            <FileTree
              files={current.files}
              selected={openFile?.rel ?? null}
              onSelect={setOpenFile}
            />
          </aside>
          <section className="mods-detail">
            <ModDetail
              mod={current}
              isActive={activeMod === current.folderName}
              onSetActive={() => requestSwitch(current.folderName)}
              openFile={openFile}
              gfxRoot={paths.gfxRoot}
            />
          </section>
        </>
      ) : (
        <section className="mods-detail">
          <EmptyDetail />
        </section>
      )}
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

interface TreeGroup {
  dir: string;
  files: ModFile[];
}

/** Flat-list-with-folder-headers; cheap and reads fine for ≤200 files. */
function FileTree({
  files,
  selected,
  onSelect,
}: {
  files: ModFile[];
  selected: string | null;
  onSelect: (file: ModFile) => void;
}) {
  const groups: TreeGroup[] = useMemo(() => {
    const byDir = new Map<string, ModFile[]>();
    for (const f of files) {
      const i = f.rel.lastIndexOf("/");
      const dir = i === -1 ? "" : f.rel.slice(0, i);
      const arr = byDir.get(dir) ?? [];
      arr.push(f);
      byDir.set(dir, arr);
    }
    return [...byDir.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dir, items]) => ({
        dir,
        files: items.sort((a, b) => a.rel.localeCompare(b.rel)),
      }));
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="detail-empty">
        No files under <code>resources/gfx/</code> yet.
      </div>
    );
  }
  return (
    <div className="panel-body mods-file-tree">
      {groups.map((g) => (
        <div key={g.dir || "(root)"}>
          <div className="mods-file-dir">{g.dir || "(root)"}</div>
          {g.files.map((f) => {
            const name = f.rel.slice(g.dir.length).replace(/^\//, "");
            return (
              <button
                key={f.rel}
                className={`mods-file-row${
                  selected === f.rel ? " selected" : ""
                }`}
                onClick={() => onSelect(f)}
                title={f.rel}
              >
                <span className="mods-file-name">{name}</span>
                <span className="mods-file-bytes">{fmtBytes(f.bytes)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ModDetail({
  mod,
  isActive,
  onSetActive,
  openFile,
  gfxRoot,
}: {
  mod: ModSummary;
  isActive: boolean;
  onSetActive: () => void;
  openFile: ModFile | null;
  gfxRoot: string;
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
      {openFile ? (
        <DiffViewer file={openFile} gfxRoot={gfxRoot} />
      ) : (
        <div className="detail-empty">
          Pick a file on the left to compare it with vanilla.
        </div>
      )}
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
