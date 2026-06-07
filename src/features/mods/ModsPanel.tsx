// Mods tab content. v1-mid: list mod folders on the left, file tree of the
// selected mod in the middle, side-by-side / overlay diff on the right.
// First-run state is a hint card explaining the concept of an "active mod".

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { listMods, type ModSummary } from "../../lib/mods/listMods";
import type { ModFile } from "../../lib/mods/fileTree";
import { deleteModFolder } from "../../lib/mods/deleteMod";
import { createMod } from "../../lib/mods/createMod";
import { isWorkshopMod } from "../../lib/mods/metadata";
import { CopyIcon, PlusIcon, SteamIcon, TrashIcon } from "../../app/icons";
import { isValidModName } from "../export/modExport";
import { BBCode } from "./BBCode";
import { DiffViewer } from "./DiffViewer";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModsPanel() {
  const paths = useAppStore((s) => s.paths);
  const activeMod = useAppStore((s) => s.activeMod);
  const setActiveMod = useAppStore((s) => s.setActiveMod);
  const addToast = useAppStore((s) => s.addToast);
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
  const [pendingDelete, setPendingDelete] = useState<ModSummary | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const refresh = () => {
    if (!paths) return;
    setLoading(true);
    listMods(paths.modsPath).then((list) => {
      setMods(list);
      setLoading(false);
    });
  };

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
          <button
            className="rail-btn mods-new-btn"
            title="Create a new local mod"
            onClick={() => setNewOpen(true)}
          >
            <PlusIcon />
          </button>
        </header>
        <div className="panel-body">
          {loading && <div className="detail-empty">Scanning mods…</div>}
          {!loading && mods.length === 0 && <FirstRunHint />}
          {!loading &&
            mods.map((m) => {
              const isActive = activeMod === m.folderName;
              const workshop = isWorkshopMod(m.metadata);
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
                    {workshop && (
                      <span
                        className="mod-workshop-icon"
                        title={`Steam Workshop mod (id ${m.metadata.id})`}
                      >
                        <SteamIcon />
                      </span>
                    )}
                    <span className="mod-row-name-text">{m.displayName}</span>
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
              // Re-clicking the open file closes the diff viewer (and
              // re-expands the description). Standard "click-to-toggle"
              // for selection of this style.
              onSelect={(f) =>
                setOpenFile((cur) => (cur?.rel === f.rel ? null : f))
              }
            />
          </aside>
          <section className="mods-detail">
            <ModDetail
              mod={current}
              isActive={activeMod === current.folderName}
              onSetActive={() => requestSwitch(current.folderName)}
              onDelete={() => setPendingDelete(current)}
              onCopyPath={() => {
                navigator.clipboard
                  .writeText(current.path)
                  .then(
                    () =>
                      addToast(`Copied path: ${current.path}`, "success"),
                    () => addToast("Couldn't copy path", "error"),
                  );
              }}
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
      {newOpen && paths && (
        <NewModModal
          modsPath={paths.modsPath}
          existing={mods.map((m) => m.folderName.toLowerCase())}
          onClose={() => setNewOpen(false)}
          onCreated={(folderName) => {
            setNewOpen(false);
            addToast(`Created mod "${folderName}"`, "success");
            refresh();
            setSelected(folderName);
          }}
        />
      )}
      {pendingDelete && paths && (
        <DeleteConfirmModal
          mod={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const folder = pendingDelete;
            setPendingDelete(null);
            // If deleting the active mod, clear it first so the overlay
            // doesn't stat a folder we're about to remove.
            if (activeMod === folder.folderName) setActiveMod(null);
            try {
              await deleteModFolder(folder.path, paths.modsPath);
              setSelected((s) => (s === folder.folderName ? null : s));
              addToast(`Deleted "${folder.displayName}"`, "success");
              refresh();
            } catch (e) {
              addToast(`Delete failed: ${e}`, "error");
            }
          }}
        />
      )}
    </div>
  );
}

function NewModModal({
  modsPath,
  existing,
  onClose,
  onCreated,
}: {
  modsPath: string;
  existing: string[];
  onClose: () => void;
  onCreated: (folderName: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const valid = isValidModName(name);
  const duplicate =
    valid && existing.includes(trimmed.toLowerCase());

  async function submit() {
    if (!valid || duplicate || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createMod(modsPath, trimmed, description);
      onCreated(trimmed);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New mod</h2>
        <label className="modal-field">
          Folder name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && !duplicate) submit();
            }}
            placeholder="my sprite mod"
          />
        </label>
        {!valid && name.length > 0 && (
          <p className="detail-error">
            Folder names can't contain {"< > : \" / \\ | ? *"} or
            leading/trailing spaces.
          </p>
        )}
        {duplicate && (
          <p className="detail-error">
            A mod folder named "{trimmed}" already exists.
          </p>
        )}
        <label className="modal-field">
          Description (optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Recolors for ghost.png"
          />
        </label>
        <p className="modal-note">
          Creates <code>{modsPath}/{trimmed || "<name>"}</code> with a
          starter <code>metadata.xml</code>. Save sprites into it from the
          editor's Ctrl+S dialog or mark it active to start overlaying.
        </p>
        {error && <p className="detail-error">{error}</p>}
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-btn primary"
            disabled={!valid || duplicate || busy}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  mod,
  onConfirm,
  onCancel,
}: {
  mod: ModSummary;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Delete "{mod.displayName}"?</h2>
        <p className="modal-note">
          This hard-deletes the mod folder from disk. There is no undo.
        </p>
        <p className="modal-preview" title={mod.path}>
          → {mod.path}
        </p>
        <p className="settings-note">
          {mod.files.length} sprite{mod.files.length === 1 ? "" : "s"} will
          be lost.
        </p>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-btn primary modal-btn-danger"
            onClick={onConfirm}
          >
            Delete forever
          </button>
        </div>
      </div>
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
  onDelete,
  onCopyPath,
  openFile,
  gfxRoot,
}: {
  mod: ModSummary;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
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
          <button
            className="rail-btn mod-detail-action"
            onClick={onCopyPath}
            title="Copy the mod folder path to the clipboard"
          >
            <CopyIcon />
          </button>
          <button
            className="rail-btn mod-detail-action mod-detail-delete"
            onClick={onDelete}
            title="Delete this mod folder permanently"
          >
            <TrashIcon />
          </button>
        </div>
        <div className="mod-detail-meta">
          {mod.folderName}
          {mod.metadata.version ? ` · v${mod.metadata.version}` : ""}
        </div>
      </header>
      {mod.metadata.description && (
        <div
          className={`mod-detail-desc${openFile ? " compact" : " expanded"}`}
        >
          <BBCode text={mod.metadata.description} />
        </div>
      )}
      {openFile ? (
        <DiffViewer file={openFile} gfxRoot={gfxRoot} />
      ) : !mod.metadata.description ? (
        <div className="detail-empty">
          Pick a file on the left to compare it with vanilla.
        </div>
      ) : null}
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
