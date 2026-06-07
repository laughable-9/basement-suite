// "You have unsaved edits" gate. Used by close-tab and switch-active-mod.
// Three actions: Save (where supported), Discard, Cancel. Matches the
// existing SaveToModDialog visual language.

import { useEffect } from "react";
import type { SheetDoc } from "../../lib/sheets/store";

interface Props {
  /** Free-form title — e.g. "Close Azazel?" or "Switch to Recolor Maggy?" */
  title: string;
  /** What the user is about to do, in human terms */
  body: string;
  dirty: SheetDoc[];
  /** Disabled if Save is impossible from this context (no active mod, etc.) */
  canSave: boolean;
  saveLabel?: string;
  discardLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function ConfirmDirtyModal({
  title,
  body,
  dirty,
  canSave,
  saveLabel = "Save to mod",
  discardLabel = "Discard",
  onSave,
  onDiscard,
  onCancel,
}: Props) {
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
        <h2>{title}</h2>
        <p className="modal-note">{body}</p>
        <ul className="dirty-list">
          {dirty.slice(0, 8).map((d) => (
            <li key={d.path} title={d.path}>
              {d.path.split(/[\\/]/).pop()}
            </li>
          ))}
          {dirty.length > 8 && (
            <li className="dirty-more">+ {dirty.length - 8} more</li>
          )}
        </ul>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-btn"
            onClick={onDiscard}
            title="Throw away unsaved changes"
          >
            {discardLabel}
          </button>
          <button
            className="modal-btn primary"
            disabled={!canSave}
            onClick={onSave}
            title={
              canSave
                ? "Write every dirty sheet to the active mod first"
                : "No active mod — discard or cancel"
            }
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
