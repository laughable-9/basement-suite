// In-app Settings popover — open from the gear icon to edit the paths
// already saved by the first-run wizard (or correct them if a folder
// moves). Writes back through saveConfig so the next launch reads the
// new values. For the very first launch flow see SetupWizard.

import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  configLocation,
  loadConfig,
  saveConfig,
  type BsConfig,
} from "../../lib/fsx/config";
import { useAppStore } from "../../app/store";

const EMPTY_DRAFT: BsConfig = {
  isaacPath: "",
  modsPath: "",
  extractedResourcesPath: "",
};

export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const catalog = useAppStore((s) => s.catalog);
  const addToast = useAppStore((s) => s.addToast);
  const ref = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<BsConfig>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState("");

  useEffect(() => {
    configLocation().then(setConfigPath, () => setConfigPath(""));
    loadConfig().then((state) => {
      if (state.status === "ok") setDraft(state.config);
      else if (state.status === "error")
        setDraft((d) => ({ ...d, ...state.config }));
    });
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pick = async (key: keyof BsConfig, title: string) => {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: draft[key] || draft.isaacPath || undefined,
        title,
      });
      if (typeof picked !== "string") return;
      setDraft((d) => ({ ...d, [key]: picked.replace(/\\/g, "/") }));
    } catch {
      /* picker cancelled */
    }
  };

  const trySave = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await saveConfig(draft);
      addToast("Paths saved · reload to apply", "success");
      onClose();
    } catch (err) {
      setProblem(String(err));
    } finally {
      setSaving(false);
    }
  };

  const ready =
    draft.isaacPath && draft.modsPath && draft.extractedResourcesPath;

  return (
    <div ref={ref} className="settings-popover">
      <h3>Paths</h3>
      {problem && <p className="settings-problems-inline">{problem}</p>}

      <Field
        label="Isaac install folder"
        value={draft.isaacPath}
        onChange={(v) => setDraft((d) => ({ ...d, isaacPath: v }))}
        onPick={() => pick("isaacPath", "Select your Isaac install folder")}
      />
      <Field
        label="Mods folder"
        value={draft.modsPath}
        onChange={(v) => setDraft((d) => ({ ...d, modsPath: v }))}
        onPick={() => pick("modsPath", "Select your mods folder")}
      />
      <Field
        label="Extracted resources folder"
        value={draft.extractedResourcesPath}
        onChange={(v) =>
          setDraft((d) => ({ ...d, extractedResourcesPath: v }))
        }
        onPick={() =>
          pick("extractedResourcesPath", "Select the extracted resources folder")
        }
      />

      <div className="settings-actions">
        <button className="modal-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="modal-btn primary"
          disabled={!ready || saving}
          onClick={trySave}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <h3>Catalog</h3>
      <p className="settings-note">
        {catalog
          ? `${catalog.entries.length} entries · ${catalog.warnings.length} skipped rows`
          : "still building…"}
      </p>

      {configPath && (
        <p className="settings-note settings-config-path">
          Config: <code>{configPath}</code>
        </p>
      )}
      <p className="settings-about">
        Basement Suite · pixel editor + anm2 previewer for Isaac modding
      </p>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPick: () => void;
}

function Field({ label, value, onChange, onPick }: FieldProps) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <span className="settings-field-row">
        <input
          type="text"
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="modal-btn settings-pick-btn"
          onClick={onPick}
          title="Browse…"
        >
          Browse
        </button>
      </span>
    </label>
  );
}
