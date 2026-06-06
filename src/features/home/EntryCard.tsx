import { useEffect, useRef, useState } from "react";
import { tabFromEntry, useAppStore } from "../../app/store";
import type { CatalogEntry } from "../../lib/catalog/types";
import { thumbUrl } from "./thumbs";

export function EntryCard({ entry }: { entry: CatalogEntry }) {
  const paths = useAppStore((s) => s.paths);
  const openTab = useAppStore((s) => s.openTab);
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Load the thumbnail only once scrolled into view.
  useEffect(() => {
    const el = ref.current;
    if (!el || !paths) return;
    let cancelled = false;
    const observer = new IntersectionObserver(([hit]) => {
      if (hit.isIntersecting) {
        observer.disconnect();
        thumbUrl(tabFromEntry(entry, paths.gfxRoot)).then(
          (u) => !cancelled && setUrl(u),
        );
      }
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [entry, paths]);

  return (
    <button
      ref={ref}
      className="entry-card"
      title={entry.anm2Path ?? entry.sheetPath ?? entry.name}
      onClick={() => paths && openTab(tabFromEntry(entry, paths.gfxRoot))}
    >
      <span className="entry-thumb checkerboard">
        {url ? (
          <img src={url} alt="" loading="lazy" />
        ) : (
          <span className="entry-thumb-blank" />
        )}
      </span>
      <span className="entry-name">{entry.name}</span>
    </button>
  );
}
