import { useEffect, useState } from "react";
import { useAppStore, type WorkTab } from "../../app/store";
import { pngUrl } from "../../lib/fsx/fs";
import { Editor } from "../editor/Editor";
import { Player } from "../player/Player";

export function WorkTabView({ tab, active }: { tab: WorkTab; active: boolean }) {
  const setTabEditing = useAppStore((s) => s.setTabEditing);

  return (
    <div className="worktab">
      {tab.editing && (
        <section className="pane pane-editor">
          <Editor
            key={`${tab.editing.sheetPath}|${tab.editing.anm2Path}`}
            target={tab.editing}
            tabId={tab.id}
            active={active}
            onClose={() => setTabEditing(tab.id, null)}
          />
        </section>
      )}
      <section className="worktab-main">
        <TabContent tab={tab} active={active} />
      </section>
    </div>
  );
}

function TabContent({ tab, active }: { tab: WorkTab; active: boolean }) {
  const setTabEditing = useAppStore((s) => s.setTabEditing);

  if (tab.anm2Path) {
    return (
      <div className="detail">
        <h2>{tab.title}</h2>
        {tab.sheetPath && (
          <div className="detail-meta">
            character skin:{" "}
            <button
              className="edit-link"
              onClick={() =>
                setTabEditing(tab.id, {
                  sheetPath: tab.sheetPath!,
                  anm2Path: tab.anm2Path,
                  sheetId: 0, // skins substitute spritesheet 0
                })
              }
            >
              edit {tab.sheetPath.split(/[\\/]/).pop()}
            </button>
          </div>
        )}
        <Player
          path={tab.anm2Path}
          skinPath={tab.sheetPath ?? undefined}
          costumePath={tab.costumeAnm2Path ?? undefined}
          tabId={tab.id}
          active={active}
        />
      </div>
    );
  }
  if (tab.sheetPath) {
    return <PngTab tab={tab} />;
  }
  return <div className="detail-empty">Nothing to show</div>;
}

function PngTab({ tab }: { tab: WorkTab }) {
  const setTabEditing = useAppStore((s) => s.setTabEditing);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState("");
  const [error, setError] = useState<string | null>(null);
  const path = tab.sheetPath!;

  useEffect(() => {
    pngUrl(path).then(setUrl, (e) => setError(String(e)));
  }, [path]);

  if (error) return <div className="detail-error">{error}</div>;
  return (
    <div className="detail">
      <h2>{tab.title}</h2>
      <div className="detail-meta">
        {dims}{" "}
        <button
          className="edit-link"
          onClick={() =>
            setTabEditing(tab.id, { sheetPath: path, anm2Path: null })
          }
        >
          edit
        </button>
      </div>
      <div className="checkerboard">
        {url && (
          <img
            className="pixelated"
            src={url}
            alt={tab.title}
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
