// U1 acceptance view: category populations + samples + parser warnings.
// Shown in the empty detail pane; replaced by the real Home grid in U2.

import { useState } from "react";
import { useAppStore } from "../../app/store";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CatalogEntry,
} from "../../lib/catalog/types";

export function CatalogDebug() {
  const catalog = useAppStore((s) => s.catalog);
  const [showWarnings, setShowWarnings] = useState(false);

  if (!catalog) {
    return <div className="detail-empty">Building catalog…</div>;
  }

  const byCategory = new Map<string, CatalogEntry[]>();
  for (const e of catalog.entries) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  return (
    <div className="detail">
      <h2>Catalog (U1 debug)</h2>
      <div className="detail-meta">
        {catalog.entries.length} entries · {catalog.warnings.length} skipped
        rows
      </div>
      <table className="anim-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
            <th>Subsections</th>
            <th>Samples</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            const subs = new Map<string, number>();
            for (const e of list) {
              if (e.subcategory)
                subs.set(e.subcategory, (subs.get(e.subcategory) ?? 0) + 1);
            }
            return (
              <tr key={cat}>
                <td>{CATEGORY_LABELS[cat]}</td>
                <td>{list.length}</td>
                <td>
                  {[...subs.entries()]
                    .map(([name, n]) => `${name} (${n})`)
                    .join(", ") || "—"}
                </td>
                <td>
                  {list
                    .slice(0, 3)
                    .map((e) => e.name)
                    .join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>
        <button
          className="edit-link"
          onClick={() => setShowWarnings((s) => !s)}
        >
          {showWarnings ? "hide" : "show"} warnings (
          {catalog.warnings.length})
        </button>
      </h3>
      {showWarnings && (
        <ul className="sheet-list">
          {catalog.warnings.slice(0, 40).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
          {catalog.warnings.length > 40 && (
            <li>… {catalog.warnings.length - 40} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
