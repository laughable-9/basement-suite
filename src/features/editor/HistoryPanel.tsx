// Photoshop-style History panel: chronological list of every recorded
// operation (oldest at top); click any entry to jump the document to that
// state. The "Open" row is the synthetic initial state — clicking it
// reverts the document to disk-loaded pixels.
//
// Re-renders whenever the sheet bumps (the same channel undo/redo and
// stroke commits already publish on), so no extra wiring needed.

import { useEffect, useRef, useState } from "react";
import { subscribeSheet, type SheetDoc } from "../../lib/sheets/store";
import { historyView, jumpHistory } from "./history";

interface Props {
  doc: SheetDoc;
}

export function HistoryPanel({ doc }: Props) {
  const [, setRev] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeSheet(doc.path, () => setRev((r) => r + 1));
  }, [doc.path]);

  const view = historyView(doc);

  // Keep the cursor row in view so a long history with the cursor near
  // the bottom doesn't hide the active state.
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>(".history-row.active");
    el?.scrollIntoView({ block: "nearest" });
  }, [view.cursor]);

  return (
    <aside className="history-panel">
      <header className="panel-header">
        History <span className="panel-count">{view.entries.length - 1}</span>
      </header>
      <div ref={bodyRef} className="panel-body">
        {view.entries.map((entry, i) => {
          const past = i < view.cursor;
          const future = i > view.cursor;
          return (
            <button
              key={i}
              className={`history-row${
                i === view.cursor ? " active" : ""
              }${future ? " future" : ""}${past ? " past" : ""}`}
              onClick={() => jumpHistory(doc, i)}
              title={
                i === 0
                  ? "Initial state (file as loaded)"
                  : `Jump to step ${i}: ${entry.label}`
              }
            >
              <span className="history-row-step">{i === 0 ? "·" : i}</span>
              <span className="history-row-label">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
