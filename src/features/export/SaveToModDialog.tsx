import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import type { SheetDoc } from "../../lib/sheets/store";
import {
  buildExportPaths,
  exportToMod,
  isValidModName,
  relUnderGfx,
} from "./modExport";

const LAST_MOD_KEY = "bs:lastModName";

interface Props {
  doc: SheetDoc;
  onClose: () => void;
  onSaved: (pngPath: string) => void;
}

export function SaveToModDialog({ doc, onClose, onSaved }: Props) {
  const paths = useAppStore((s) => s.paths);
  const [modName, setModName] = useState(
    () => localStorage.getItem(LAST_MOD_KEY) ?? "my sprite mod",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rel = paths ? relUnderGfx(doc.path, paths.gfxRoot) : null;
  const valid = isValidModName(modName);
  const preview = useMemo(() => {
    if (!paths || rel === null || !valid) return null;
    return buildExportPaths(paths.modsPath, modName, rel).pngPath;
  }, [paths, rel, modName, valid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!paths || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportToMod(
        doc,
        paths.gfxRoot,
        paths.modsPath,
        modName.trim(),
      );
      localStorage.setItem(LAST_MOD_KEY, modName.trim());
      onSaved(result.pngPath);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Save to mod</h2>
        {rel === null ? (
          <p className="detail-error">
            This sheet is outside the game's gfx folder — nothing to mirror.
          </p>
        ) : (
          <>
            <label className="modal-field">
              Mod folder name
              <input
                autoFocus
                value={modName}
                onChange={(e) => setModName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid) save();
                }}
              />
            </label>
            {!valid && modName.length > 0 && (
              <p className="detail-error">
                Folder names can't contain {"< > : \" / \\ | ? *"} or
                leading/trailing spaces.
              </p>
            )}
            {preview && (
              <p className="modal-preview" title={preview}>
                → {preview}
              </p>
            )}
            <p className="modal-note">
              Writes the edited PNG (and metadata.xml on first save). Your game
              files are never touched — restart the run in-game to see it.
            </p>
            {error && <p className="detail-error">{error}</p>}
            <div className="modal-actions">
              <button className="player-btn modal-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="player-btn modal-btn primary"
                disabled={!valid || busy}
                onClick={save}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
