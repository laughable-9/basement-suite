import { useMemo } from "react";
import { useAppStore } from "../../app/store";
import { searchCatalog } from "../../lib/catalog/build";
import {
  CATEGORY_LABELS,
  type CatalogEntry,
  type CategoryId,
} from "../../lib/catalog/types";
import { Tree } from "../browser/Tree";
import { VirtualGrid } from "./VirtualGrid";

export function Home() {
  const catalog = useAppStore((s) => s.catalog);
  const home = useAppStore((s) => s.home);
  const setHome = useAppStore((s) => s.setHome);
  const query = useAppStore((s) => s.searchQuery);
  const paths = useAppStore((s) => s.paths);
  const searching = query.trim().length > 0;
  const isFiles = home.category === "files" && !searching;

  const inCategory = useMemo(
    () =>
      (catalog?.entries ?? []).filter((e) => e.category === home.category),
    [catalog, home.category],
  );

  const subcategories = useMemo(() => {
    const subs = new Map<string, number>();
    for (const e of inCategory) {
      if (e.subcategory)
        subs.set(e.subcategory, (subs.get(e.subcategory) ?? 0) + 1);
    }
    return [...subs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inCategory]);

  const shown: CatalogEntry[] = useMemo(() => {
    if (searching) return searchCatalog(catalog?.entries ?? [], query, 300);
    const list = home.subcategory
      ? inCategory.filter((e) => e.subcategory === home.subcategory)
      : inCategory;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, searching, query, inCategory, home.subcategory]);

  if (!catalog) {
    return <div className="detail-empty">Building catalog…</div>;
  }

  return (
    <div className="home">
      <div className="home-header">
        {searching ? (
          <span className="breadcrumb">
            Search: <b>{query}</b>
            <span className="breadcrumb-count">
              {" "}· {shown.length} result{shown.length === 1 ? "" : "s"}
            </span>
          </span>
        ) : isFiles ? (
          <span className="breadcrumb">
            <b>Files</b>
            <span className="breadcrumb-count"> · raw gfx tree</span>
          </span>
        ) : (
          <>
            <span className="breadcrumb">
              <b>{CATEGORY_LABELS[home.category as CategoryId]}</b>
              {home.subcategory && <> ▸ {home.subcategory}</>}
              <span className="breadcrumb-count"> · {shown.length}</span>
            </span>
            {subcategories.length > 0 && (
              <span className="sub-chips">
                <button
                  className={`chip${home.subcategory === null ? " active" : ""}`}
                  onClick={() =>
                    setHome({ category: home.category, subcategory: null })
                  }
                >
                  All
                </button>
                {subcategories.map(([name, count]) => (
                  <button
                    key={name}
                    className={`chip${home.subcategory === name ? " active" : ""}`}
                    onClick={() =>
                      setHome({ category: home.category, subcategory: name })
                    }
                  >
                    {name} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </span>
            )}
          </>
        )}
      </div>
      {isFiles ? (
        <div className="files-tree">{paths && <Tree root={paths.gfxRoot} />}</div>
      ) : shown.length === 0 ? (
        <div className="detail-empty">
          {searching ? "No matches" : "Nothing in this category"}
        </div>
      ) : (
        <VirtualGrid entries={shown} />
      )}
    </div>
  );
}
