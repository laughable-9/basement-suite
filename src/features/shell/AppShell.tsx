import { useCallback, useEffect, useState } from "react";
import {
  useAppStore,
  type RailCategory,
  type WorkTab,
} from "../../app/store";
import { peekSheetDoc, subscribeSheet, type SheetDoc } from "../../lib/sheets/store";
import { listAllDirty, discardAllDirty } from "../../lib/sheets/dirty";
import { ConfirmDirtyModal } from "./ConfirmDirtyModal";
import { applyIsaacBranding } from "./isaacBranding";
import {
  BoxIcon,
  CloseIcon,
  DropIcon,
  FilmIcon,
  FolderGearIcon,
  FolderIcon,
  GearIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  PawIcon,
  PersonIcon,
  SearchIcon,
  SkullIcon,
  SparkIcon,
  WindowIcon,
} from "../../app/icons";
import { CATEGORY_LABELS } from "../../lib/catalog/types";
import { Home } from "../home/Home";
import { ModsPanel } from "../mods/ModsPanel";
import { WorkTabView } from "../work/WorkTabView";
import { SettingsPopover } from "./SettingsPopover";

/** Amber dot on tabs whose editing sheet has unsaved changes. */
function TabDirtyDot({ tab }: { tab: WorkTab }) {
  const [, setRev] = useState(0);
  const sheetPath = tab.editing?.sheetPath;

  useEffect(() => {
    if (!sheetPath) return;
    return subscribeSheet(sheetPath, () => setRev((r) => r + 1));
  }, [sheetPath]);

  if (!sheetPath || !peekSheetDoc(sheetPath)?.dirty) return null;
  return <span className="dirty-dot" title="Unsaved edits" />;
}

const RAIL: { id: RailCategory; icon: () => React.ReactNode; label: string }[] =
  [
    { id: "characters", icon: PersonIcon, label: CATEGORY_LABELS.characters },
    { id: "tears", icon: DropIcon, label: CATEGORY_LABELS.tears },
    { id: "familiars", icon: PawIcon, label: CATEGORY_LABELS.familiars },
    { id: "pickups", icon: HeartIcon, label: CATEGORY_LABELS.pickups },
    { id: "items", icon: BoxIcon, label: CATEGORY_LABELS.items },
    { id: "enemies", icon: SkullIcon, label: CATEGORY_LABELS.enemies },
    { id: "effects", icon: SparkIcon, label: CATEGORY_LABELS.effects },
    { id: "grid", icon: GridIcon, label: CATEGORY_LABELS.grid },
    { id: "backdrops", icon: ImageIcon, label: CATEGORY_LABELS.backdrops },
    { id: "ui", icon: WindowIcon, label: CATEGORY_LABELS.ui },
    { id: "cutscenes", icon: FilmIcon, label: CATEGORY_LABELS.cutscenes },
    { id: "files", icon: FolderIcon, label: "Files (raw tree)" },
  ];

/** Sheets the user is likely to lose if this tab is the last thing keeping
 *  them in scope (currently-open editor sheet + the tab's primary sheet). */
function dirtyForTab(tab: WorkTab): SheetDoc[] {
  const paths = new Set<string>();
  if (tab.sheetPath) paths.add(tab.sheetPath);
  if (tab.editing) paths.add(tab.editing.sheetPath);
  const out: SheetDoc[] = [];
  for (const p of paths) {
    const doc = peekSheetDoc(p);
    if (doc?.dirty) out.push(doc);
  }
  return out;
}

export function AppShell() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTabRaw = useAppStore((s) => s.closeTab);

  // Custom modal replaces native confirm() — matches our Photoshop styling
  // and gives a third "Save to mod" option (when there's an active mod).
  const [pendingClose, setPendingClose] = useState<WorkTab | null>(null);

  // Closing a tab with unsaved sheet edits asks first.
  const closeTab = useCallback(
    (tab: WorkTab) => {
      if (dirtyForTab(tab).length > 0) {
        setPendingClose(tab);
        return;
      }
      closeTabRaw(tab.id);
    },
    [closeTabRaw],
  );
  const setActiveMod = useAppStore((s) => s.setActiveMod);
  const [pendingMod, setPendingMod] = useState<string | null>(null);
  // Listen for mod-switch requests from ModsPanel via a custom event so
  // ModsPanel doesn't need its own modal copy. Simpler than threading
  // callbacks through the panel hierarchy.
  useEffect(() => {
    const onSwitchRequest = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string") return;
      if (listAllDirty().length === 0) {
        setActiveMod(detail);
      } else {
        setPendingMod(detail);
      }
    };
    window.addEventListener("bs:request-mod-switch", onSwitchRequest);
    return () =>
      window.removeEventListener("bs:request-mod-switch", onSwitchRequest);
  }, [setActiveMod]);

  const home = useAppStore((s) => s.home);
  const setHome = useAppStore((s) => s.setHome);
  const query = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const catalog = useAppStore((s) => s.catalog);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const activeMod = useAppStore((s) => s.activeMod);
  const [logo, setLogo] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Isaac thumbs-up (public/icon.png) as window icon + app-bar logo.
  useEffect(() => {
    applyIsaacBranding().then(setLogo);
  }, []);

  // Ctrl+Tab cycles tabs (incl. Home), Ctrl+W closes the active one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const ids = ["home", "mods", ...tabs.map((t) => t.id)];
        const i = ids.indexOf(activeTabId);
        const next = e.shiftKey
          ? ids[(i - 1 + ids.length) % ids.length]
          : ids[(i + 1) % ids.length];
        setActiveTab(next);
      } else if (e.ctrlKey && e.key.toLowerCase() === "w" && activeTab) {
        e.preventDefault();
        closeTab(activeTab);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, activeTab, setActiveTab, closeTab]);

  return (
    <div className="workbench">
      <header className="appbar">
        {logo ? (
          <img className="app-logo-img" src={logo} alt="" title="Basement Suite" />
        ) : (
          <span className="app-logo" title="Basement Suite">
            BS
          </span>
        )}
        <nav className="tabstrip">
          <button
            className={`doc-tab${activeTabId === "home" ? " active" : ""}`}
            onClick={() => setActiveTab("home")}
            title="Home — browse everything"
          >
            <HomeIcon />
          </button>
          <button
            className={`doc-tab${activeTabId === "mods" ? " active" : ""}`}
            onClick={() => setActiveTab("mods")}
            title="Mods — manage your installed mods"
          >
            <FolderGearIcon />
          </button>
          {tabs.map((t) => (
            <span
              key={t.id}
              className={`doc-tab doc-tab-entity${t.id === activeTabId ? " active" : ""}`}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(t);
              }}
            >
              <button className="doc-tab-label" onClick={() => setActiveTab(t.id)}>
                {t.title}
              </button>
              <TabDirtyDot tab={t} />
              <button
                className="doc-tab-close"
                title="Close (Ctrl+W)"
                onClick={() => closeTab(t)}
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </nav>
        <label className="global-search">
          <SearchIcon />
          <input
            placeholder="Search everything…"
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
          />
        </label>
        <button
          className="rail-btn"
          title="Settings"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <GearIcon />
        </button>
        {settingsOpen && (
          <SettingsPopover onClose={() => setSettingsOpen(false)} />
        )}
      </header>

      <div className="shell-body">
        {/* Browser chrome belongs to Home — entity tabs get the full width */}
        {activeTabId === "home" && (
          <aside className="category-rail">
            {RAIL.map((c) => (
              <button
                key={c.id}
                className={`rail-btn${home.category === c.id ? " active" : ""}`}
                title={c.label}
                onClick={() => setHome({ category: c.id, subcategory: null })}
              >
                <c.icon />
              </button>
            ))}
          </aside>
        )}

        <main className="shell-content">
          {/* All tabs stay mounted so editor/player state survives switches */}
          <div className="tab-host" hidden={activeTabId !== "home"}>
            <Home />
          </div>
          <div className="tab-host" hidden={activeTabId !== "mods"}>
            <ModsPanel />
          </div>
          {tabs.map((t) => (
            <div key={t.id} className="tab-host" hidden={t.id !== activeTabId}>
              <WorkTabView tab={t} active={t.id === activeTabId} />
            </div>
          ))}
        </main>
      </div>

      <footer className="statusbar">
        <span>
          {catalog
            ? `${catalog.entries.length} catalog entries`
            : "building catalog…"}
        </span>
        <span>{tabs.length} open</span>
        <span className="toolbar-spacer" />
        <label className="speed-control" title="Animation playback speed (player + thumbnails)">
          speed
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          />
          <span className="speed-value">{playbackSpeed.toFixed(1)}×</span>
        </label>
        <span title="Active mod — saves land here, previews overlay from here">
          mod: {activeMod ?? "—"}
        </span>
      </footer>
      {pendingClose && (
        <ConfirmDirtyModal
          title={`Close "${pendingClose.title}"?`}
          body={`This tab has unsaved sprite edits. Saving without an active mod isn't possible from here — open the editor and Ctrl+S first to pick a mod, or discard.`}
          dirty={dirtyForTab(pendingClose)}
          canSave={false}
          saveLabel="Save to mod"
          onSave={() => {}}
          onDiscard={() => {
            for (const d of dirtyForTab(pendingClose)) {
              // Discard = clear the dirty flag, dropping in-memory edits.
              // Re-decoded on next load.
              d.dirty = false;
            }
            const id = pendingClose.id;
            setPendingClose(null);
            closeTabRaw(id);
          }}
          onCancel={() => setPendingClose(null)}
        />
      )}
      {pendingMod && (
        <ConfirmDirtyModal
          title={`Switch to "${pendingMod}"?`}
          body={`Switching the active mod throws away in-memory sprite edits because the canvas cache reloads from disk. Save them to the current active mod first, or discard.`}
          dirty={listAllDirty()}
          canSave={false}
          saveLabel="Save to mod"
          onSave={() => {}}
          onDiscard={() => {
            discardAllDirty();
            const name = pendingMod;
            setPendingMod(null);
            setActiveMod(name);
          }}
          onCancel={() => setPendingMod(null)}
        />
      )}
    </div>
  );
}
