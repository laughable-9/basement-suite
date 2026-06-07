import { useEffect, useRef, useState } from "react";
import { listDir, pngUrl, type Entry } from "../../lib/fsx/fs";
import { useAppStore } from "../../app/store";

export function Tree({ root }: { root: string }) {
  return <DirChildren path={root} depth={0} />;
}

function DirChildren({ path, depth }: { path: string; depth: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDir(path).then(
      (e) => !cancelled && setEntries(e),
      (err) => !cancelled && setError(String(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) return <div className="tree-error">{error}</div>;
  if (entries === null) return <div className="tree-loading">…</div>;

  return (
    <ul className="tree-list">
      {entries
        .filter((e) => e.kind !== "other")
        .map((e) => (
          <li key={e.path}>
            {e.kind === "dir" ? (
              <DirNode entry={e} depth={depth} />
            ) : (
              <FileNode entry={e} depth={depth} />
            )}
          </li>
        ))}
    </ul>
  );
}

function DirNode({ entry, depth }: { entry: Entry; depth: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="tree-row"
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => setOpen(!open)}
      >
        <span className="tree-icon">{open ? "▾" : "▸"}</span>
        <span className="tree-icon">🗀</span>
        {entry.name}
      </button>
      {open && <DirChildren path={entry.path} depth={depth + 1} />}
    </>
  );
}

function FileNode({ entry, depth }: { entry: Entry; depth: number }) {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const openTab = useAppStore((s) => s.openTab);
  const tabId = `file:${entry.path.toLowerCase()}`;

  return (
    <button
      className={`tree-row${activeTabId === tabId ? " selected" : ""}`}
      style={{ paddingLeft: depth * 16 + 8 }}
      onClick={() =>
        openTab({
          id: tabId,
          title: entry.name,
          anm2Path: entry.kind === "anm2" ? entry.path : null,
          sheetPath: entry.kind === "png" ? entry.path : null,
        })
      }
    >
      {entry.kind === "png" ? (
        <Thumb path={entry.path} />
      ) : (
        <span className="anm2-badge">anm2</span>
      )}
      {entry.name}
    </button>
  );
}

/** Tiny spritesheet thumbnail; loads its blob URL only once scrolled into view. */
function Thumb({ path }: { path: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(([hit]) => {
      if (hit.isIntersecting) {
        observer.disconnect();
        pngUrl(path).then((u) => !cancelled && setUrl(u), () => {});
      }
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [path]);

  return (
    <span ref={ref} className="thumb">
      {url && <img src={url} alt="" />}
    </span>
  );
}
