// First-run onboarding wizard. Walks the user through the three required
// paths one at a time with explanation, so an installed-from-Releases user
// who has never seen the app has a chance to understand what to pick.
//
// Once any required field is filled the user can advance; "Back" reverts
// without losing what was typed. The final step previews everything and
// commits via saveConfig (same code path as the gear-icon Settings popover).

import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  configLocation,
  saveConfig,
  type BsConfig,
} from "../../lib/fsx/config";
import { useAppStore } from "../../app/store";

interface Props {
  initial?: Partial<BsConfig>;
  initialProblems?: string[];
  onSaved: () => void;
}

const STEPS = ["welcome", "isaac", "mods", "extracted", "review"] as const;
type Step = (typeof STEPS)[number];

function isaacDefault(key: "modsPath" | "extractedResourcesPath", isaac: string) {
  if (!isaac) return "";
  const base = isaac.replace(/[\\/]+$/, "");
  return key === "modsPath"
    ? `${base}/mods`
    : `${base}/extracted_resources/resources`;
}

export function SetupWizard({ initial, initialProblems, onSaved }: Props) {
  const addToast = useAppStore((s) => s.addToast);

  const seeded: BsConfig = useMemo(
    () => ({
      isaacPath: initial?.isaacPath ?? "",
      modsPath: initial?.modsPath ?? "",
      extractedResourcesPath: initial?.extractedResourcesPath ?? "",
    }),
    [initial],
  );

  const [step, setStep] = useState<Step>(initialProblems?.length ? "isaac" : "welcome");
  const [draft, setDraft] = useState<BsConfig>(seeded);
  const [problems, setProblems] = useState<string[]>(initialProblems ?? []);
  const [saving, setSaving] = useState(false);
  const [configPath, setConfigPath] = useState("");

  useEffect(() => {
    configLocation().then(setConfigPath, () => setConfigPath(""));
  }, []);

  const idx = STEPS.indexOf(step);
  const total = STEPS.length;

  const pick = async (
    key: keyof BsConfig,
    title: string,
    defaultStart?: string,
  ) => {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: defaultStart || draft[key] || draft.isaacPath || undefined,
        title,
      });
      if (typeof picked !== "string") return;
      const normalized = picked.replace(/\\/g, "/");
      setDraft((d) => {
        const next = { ...d, [key]: normalized };
        if (key === "isaacPath") {
          if (!d.modsPath) next.modsPath = isaacDefault("modsPath", normalized);
          if (!d.extractedResourcesPath)
            next.extractedResourcesPath = isaacDefault(
              "extractedResourcesPath",
              normalized,
            );
        }
        return next;
      });
    } catch {
      // picker cancelled — no-op
    }
  };

  const back = () => setStep(STEPS[Math.max(0, idx - 1)]);
  const next = () => setStep(STEPS[Math.min(total - 1, idx + 1)]);

  const trySave = async () => {
    setSaving(true);
    setProblems([]);
    try {
      await saveConfig(draft);
      addToast("Paths saved", "success");
      onSaved();
    } catch (err) {
      setProblems([`Failed to write config: ${err}`]);
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = (() => {
    if (step === "welcome") return true;
    if (step === "isaac") return draft.isaacPath.length > 0;
    if (step === "mods") return draft.modsPath.length > 0;
    if (step === "extracted") return draft.extractedResourcesPath.length > 0;
    return true;
  })();

  return (
    <div className="setup-backdrop">
      <div className="setup-card">
        <div className="setup-progress" aria-label={`Step ${idx + 1} of ${total}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`setup-progress-dot${
                i < idx ? " done" : i === idx ? " active" : ""
              }`}
            />
          ))}
        </div>

        {problems.length > 0 && (
          <ul className="setup-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        {step === "welcome" && (
          <>
            <h2 className="setup-title">Welcome to Basement Suite</h2>
            <p className="setup-lede">
              A pixel-art editor and live animation previewer for modding{" "}
              <em>The Binding of Isaac: Repentance</em>. Browse the game's
              sprites by name, paint into a layer, watch the animation
              re-render live, save straight into a mod folder.
            </p>
            <p className="setup-lede">
              Before we start we need to know where three folders live on
              your machine. This takes about a minute.
            </p>
            <ol className="setup-list">
              <li>Your Isaac install folder.</li>
              <li>Where you keep mods.</li>
              <li>Where the game's resource extractor put the raw art.</li>
            </ol>
            <p className="setup-note">
              Don't have the resource extractor output yet? The next steps
              will tell you how. Your game files are read-only at all times
              — Basement Suite only writes inside your mods folder.
            </p>
          </>
        )}

        {step === "isaac" && (
          <>
            <h2 className="setup-title">Where is Isaac installed?</h2>
            <p className="setup-lede">
              Pick the folder that contains <code>isaac-ng.exe</code>. The
              fastest way to find it: open Steam, right-click{" "}
              <em>The Binding of Isaac: Rebirth</em>, choose{" "}
              <b>Manage → Browse local files</b>. The folder it opens is the
              one we want.
            </p>
            <PathRow
              value={draft.isaacPath}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  isaacPath: v,
                  modsPath: d.modsPath || isaacDefault("modsPath", v),
                  extractedResourcesPath:
                    d.extractedResourcesPath ||
                    isaacDefault("extractedResourcesPath", v),
                }))
              }
              onPick={() => pick("isaacPath", "Select your Isaac install folder")}
              placeholder="C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth"
            />
          </>
        )}

        {step === "mods" && (
          <>
            <h2 className="setup-title">Where do mods live?</h2>
            <p className="setup-lede">
              Isaac loads mods from a folder named <code>mods</code> inside
              your install. Basement Suite only ever writes here — your
              vanilla game files stay untouched.
            </p>
            {draft.modsPath && (
              <p className="setup-note">
                Auto-filled from your Isaac folder. Change it only if you've
                moved your mods somewhere else.
              </p>
            )}
            <PathRow
              value={draft.modsPath}
              onChange={(v) => setDraft((d) => ({ ...d, modsPath: v }))}
              onPick={() =>
                pick("modsPath", "Select your mods folder", draft.isaacPath)
              }
              placeholder="<Isaac folder>/mods"
            />
          </>
        )}

        {step === "extracted" && (
          <>
            <h2 className="setup-title">Where is the extracted game art?</h2>
            <p className="setup-lede">
              Repentance keeps its art packed inside <code>.a</code> archives
              that no normal program can read. The game ships with an
              extractor that unpacks everything into a folder Basement Suite
              can browse.
            </p>
            <div className="setup-callout">
              <b>If you haven't run the extractor yet:</b>
              <ol>
                <li>Open the Isaac folder (Steam → Manage → Browse local files).</li>
                <li>
                  Go into <code>tools/ResourceExtractor/</code>.
                </li>
                <li>
                  <b>Right-click <code>ResourceExtractor.exe</code> → Run as
                  administrator</b> and click <i>Extract resources</i>.
                </li>
                <li>
                  When it finishes you'll have a new folder:{" "}
                  <code>&lt;Isaac folder&gt;/extracted_resources/resources/</code>.
                  Pick that one below.
                </li>
              </ol>
            </div>
            {draft.extractedResourcesPath && (
              <p className="setup-note">
                Auto-filled from your Isaac folder — change it if you ran the
                extractor somewhere else.
              </p>
            )}
            <PathRow
              value={draft.extractedResourcesPath}
              onChange={(v) =>
                setDraft((d) => ({ ...d, extractedResourcesPath: v }))
              }
              onPick={() =>
                pick(
                  "extractedResourcesPath",
                  "Select the extracted resources folder",
                  draft.isaacPath,
                )
              }
              placeholder="<Isaac folder>/extracted_resources/resources"
            />
          </>
        )}

        {step === "review" && (
          <>
            <h2 className="setup-title">Looks good?</h2>
            <p className="setup-lede">
              These are the three paths Basement Suite will use. You can
              change them later from the gear icon at the top-right.
            </p>
            <dl className="setup-review">
              <dt>Isaac install</dt>
              <dd title={draft.isaacPath}>{draft.isaacPath}</dd>
              <dt>Mods</dt>
              <dd title={draft.modsPath}>{draft.modsPath}</dd>
              <dt>Extracted resources</dt>
              <dd title={draft.extractedResourcesPath}>
                {draft.extractedResourcesPath}
              </dd>
            </dl>
            {configPath && (
              <p className="setup-note setup-config-path">
                Will be saved to <code>{configPath}</code>
              </p>
            )}
          </>
        )}

        <div className="setup-actions">
          {idx > 0 && (
            <button
              className="modal-btn"
              onClick={back}
              disabled={saving}
              type="button"
            >
              Back
            </button>
          )}
          <span className="setup-actions-spacer" />
          {step !== "review" && (
            <button
              className="modal-btn primary"
              onClick={next}
              disabled={!canAdvance}
              type="button"
            >
              {step === "welcome" ? "Get started" : "Next"}
            </button>
          )}
          {step === "review" && (
            <button
              className="modal-btn primary"
              onClick={trySave}
              disabled={saving}
              type="button"
            >
              {saving ? "Saving…" : "Save and continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface PathRowProps {
  value: string;
  onChange: (v: string) => void;
  onPick: () => void;
  placeholder?: string;
}

function PathRow({ value, onChange, onPick, placeholder }: PathRowProps) {
  return (
    <div className="setup-path-row">
      <input
        type="text"
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="modal-btn primary setup-browse-btn"
        onClick={onPick}
      >
        Browse…
      </button>
    </div>
  );
}
