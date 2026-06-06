import { useEffect, useState } from "react";
import { pngUrl } from "../../lib/fsx/fs";
import { useAppStore } from "../../app/store";
import { Player } from "../player/Player";
import { CatalogDebug } from "../catalog/CatalogDebug";

export function DetailPane() {
  const selected = useAppStore((s) => s.selected);

  if (!selected) {
    return <CatalogDebug />;
  }
  return (
    <div className="detail">
      <h2>{selected.name}</h2>
      {selected.kind === "png" ? (
        <PngDetail key={selected.path} path={selected.path} name={selected.name} />
      ) : (
        <Player key={selected.path} path={selected.path} />
      )}
    </div>
  );
}

function PngDetail({ path, name }: { path: string; name: string }) {
  const openEditor = useAppStore((s) => s.openEditor);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pngUrl(path).then(setUrl, (e) => setError(String(e)));
  }, [path]);

  if (error) return <div className="detail-error">{error}</div>;
  return (
    <>
      <div className="detail-meta">
        {dims}{" "}
        <button className="edit-link" onClick={() => openEditor(path, null)}>
          edit
        </button>
      </div>
      <div className="checkerboard">
        {url && (
          <img
            className="pixelated"
            src={url}
            alt={name}
            onLoad={(e) =>
              setDims(
                `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
              )
            }
          />
        )}
      </div>
    </>
  );
}
