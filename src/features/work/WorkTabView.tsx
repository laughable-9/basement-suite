import { useEffect, useState } from "react";
import { useAppStore, type WorkTab } from "../../app/store";
import { pngUrl } from "../../lib/fsx/fs";
import { Player } from "../player/Player";

export function WorkTabView({ tab }: { tab: WorkTab }) {
  const openEditor = useAppStore((s) => s.openEditor);

  if (tab.anm2Path) {
    return (
      <div className="detail">
        <h2>{tab.title}</h2>
        {tab.sheetPath && (
          <div className="detail-meta">
            character skin:{" "}
            <button
              className="edit-link"
              onClick={() => openEditor(tab.sheetPath!, tab.anm2Path)}
            >
              edit {tab.sheetPath.split(/[\\/]/).pop()}
            </button>
          </div>
        )}
        <Player path={tab.anm2Path} skinPath={tab.sheetPath ?? undefined} />
      </div>
    );
  }
  if (tab.sheetPath) {
    return <PngTab path={tab.sheetPath} title={tab.title} />;
  }
  return <div className="detail-empty">Nothing to show</div>;
}

function PngTab({ path, title }: { path: string; title: string }) {
  const openEditor = useAppStore((s) => s.openEditor);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pngUrl(path).then(setUrl, (e) => setError(String(e)));
  }, [path]);

  if (error) return <div className="detail-error">{error}</div>;
  return (
    <div className="detail">
      <h2>{title}</h2>
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
            alt={title}
            onLoad={(e) =>
              setDims(
                `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
              )
            }
          />
        )}
      </div>
    </div>
  );
}
