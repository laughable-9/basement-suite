// Minimal 16px stroke icons for the tool rail (Photoshop-style, our palette).

interface IconProps {
  size?: number;
}

function svg(path: React.ReactNode, { size = 19 }: IconProps = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export const PencilIcon = () =>
  svg(
    <>
      <path d="M3 13 L3.8 10.2 L11 3 L13 5 L5.8 12.2 Z" />
      <path d="M10 4 L12 6" />
    </>,
  );

export const EraserIcon = () =>
  svg(
    <>
      <path d="M5.5 12.5 L2.5 9.5 L8.5 3.5 L12.5 7.5 L7.5 12.5 Z" />
      <path d="M5 13 H13" />
    </>,
  );

export const DropperIcon = () =>
  svg(
    <>
      <path d="M9.5 4.5 L11.5 6.5 L5.5 12.5 L3 13 L3.5 10.5 Z" />
      <path d="M9 3 L10.5 1.5 C11.3 0.7 12.8 0.7 13.5 1.5 C14.3 2.2 14.3 3.7 13.5 4.5 L12 6" />
    </>,
  );

export const CursorIcon = () =>
  svg(<path d="M4 2 L12 9 L8.5 9.5 L10.5 13.5 L8.7 14.3 L6.8 10.3 L4 12.5 Z" />);

export const UndoIcon = () =>
  svg(
    <>
      <path d="M3 6 H10 C12 6 13.5 7.5 13.5 9.5 C13.5 11.5 12 13 10 13 H6" />
      <path d="M6 3 L3 6 L6 9" />
    </>,
  );

export const RedoIcon = () =>
  svg(
    <>
      <path d="M13 6 H6 C4 6 2.5 7.5 2.5 9.5 C2.5 11.5 4 13 6 13 H10" />
      <path d="M10 3 L13 6 L10 9" />
    </>,
  );

export const GridIcon = () =>
  svg(
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.5" />
      <path d="M2.5 8 H13.5 M8 2.5 V13.5" />
    </>,
  );

export const CloseIcon = () => svg(<path d="M4 4 L12 12 M12 4 L4 12" />);

export const MoveIcon = () =>
  svg(
    <>
      <path d="M8 1.5 V14.5 M1.5 8 H14.5" />
      <path d="M6.3 3.2 L8 1.5 L9.7 3.2" />
      <path d="M6.3 12.8 L8 14.5 L9.7 12.8" />
      <path d="M3.2 6.3 L1.5 8 L3.2 9.7" />
      <path d="M12.8 6.3 L14.5 8 L12.8 9.7" />
    </>,
  );

export const PlayIcon = () =>
  svg(<path d="M5 3 L12.5 8 L5 13 Z" fill="currentColor" />);

export const HomeIcon = () =>
  svg(<path d="M2.5 8 L8 2.5 L13.5 8 M4 7 V13.5 H12 V7" />);

export const SearchIcon = () =>
  svg(
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" />
    </>,
  );

/* ---- category rail icons ---- */

export const PersonIcon = () =>
  svg(
    <>
      <circle cx="8" cy="5" r="2.8" />
      <path d="M2.8 14 C3.4 10.8 5.4 9.4 8 9.4 C10.6 9.4 12.6 10.8 13.2 14" />
    </>,
  );

export const DropIcon = () =>
  svg(<path d="M8 1.8 C10.8 5.4 12.5 7.8 12.5 10 A4.5 4.5 0 0 1 3.5 10 C3.5 7.8 5.2 5.4 8 1.8 Z" />);

export const PawIcon = () =>
  svg(
    <>
      <ellipse cx="4" cy="6" rx="1.3" ry="1.7" />
      <ellipse cx="12" cy="6" rx="1.3" ry="1.7" />
      <ellipse cx="6.5" cy="3.8" rx="1.3" ry="1.7" />
      <ellipse cx="9.5" cy="3.8" rx="1.3" ry="1.7" />
      <path d="M8 8 C10.5 8 12 10 11.5 11.8 C11 13.5 9.5 13.8 8 13.8 C6.5 13.8 5 13.5 4.5 11.8 C4 10 5.5 8 8 8 Z" />
    </>,
  );

export const HeartIcon = () =>
  svg(<path d="M8 13.5 C3 10 2 7.5 2 5.6 C2 3.9 3.4 2.5 5 2.5 C6.3 2.5 7.4 3.3 8 4.4 C8.6 3.3 9.7 2.5 11 2.5 C12.6 2.5 14 3.9 14 5.6 C14 7.5 13 10 8 13.5 Z" />);

export const BoxIcon = () =>
  svg(
    <>
      <path d="M2.5 5 L8 2 L13.5 5 V11 L8 14 L2.5 11 Z" />
      <path d="M2.5 5 L8 8 L13.5 5 M8 8 V14" />
    </>,
  );

export const SkullIcon = () =>
  svg(
    <>
      <path d="M8 1.8 C11.3 1.8 13.5 4.2 13.5 7.2 C13.5 9 12.7 10.2 11.5 11 V13 H4.5 V11 C3.3 10.2 2.5 9 2.5 7.2 C2.5 4.2 4.7 1.8 8 1.8 Z" />
      <circle cx="5.8" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
      <path d="M6.5 13 V14.2 M9.5 13 V14.2" />
    </>,
  );

export const SparkIcon = () =>
  svg(<path d="M8 1.5 L9.4 6.6 L14.5 8 L9.4 9.4 L8 14.5 L6.6 9.4 L1.5 8 L6.6 6.6 Z" />);

export const ImageIcon = () =>
  svg(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 11 L6 7.5 L9 10 L11 8.5 L14 11" />
      <circle cx="10.5" cy="6" r="1" />
    </>,
  );

export const WindowIcon = () =>
  svg(
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M2 5.5 H14" />
      <circle cx="4" cy="4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="4" r="0.6" fill="currentColor" stroke="none" />
    </>,
  );

export const FilmIcon = () =>
  svg(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M4.8 3 V13 M11.2 3 V13 M2 6.3 H4.8 M2 9.7 H4.8 M11.2 6.3 H14 M11.2 9.7 H14" />
    </>,
  );

export const GearIcon = () =>
  svg(
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8 V3.6 M8 12.4 V14.2 M1.8 8 H3.6 M12.4 8 H14.2 M3.6 3.6 L4.9 4.9 M11.1 11.1 L12.4 12.4 M12.4 3.6 L11.1 4.9 M4.9 11.1 L3.6 12.4" />
      <circle cx="8" cy="8" r="4.6" />
    </>,
  );

export const FolderIcon = () =>
  svg(<path d="M2 4 C2 3.4 2.4 3 3 3 H6 L7.5 4.8 H13 C13.6 4.8 14 5.2 14 5.8 V12 C14 12.6 13.6 13 13 13 H3 C2.4 13 2 12.6 2 12 Z" />);

/** Folder with a small gear in the corner — used for the Mods tab. */
export const FolderGearIcon = () =>
  svg(
    <>
      <path d="M2 4 C2 3.4 2.4 3 3 3 H6 L7.5 4.8 H13 C13.6 4.8 14 5.2 14 5.8 V12 C14 12.6 13.6 13 13 13 H3 C2.4 13 2 12.6 2 12 Z" />
      <circle cx="11.3" cy="10.3" r="1.3" fill="var(--bg-raised)" />
      <path
        d="M11.3 8.4 V9.2 M11.3 11.4 V12.2 M9.4 10.3 H10.2 M12.4 10.3 H13.2 M9.95 8.95 L10.5 9.5 M12.1 11.1 L12.65 11.65 M12.65 8.95 L12.1 9.5 M10.5 11.1 L9.95 11.65"
        strokeWidth="0.9"
      />
    </>,
  );

export const PaletteIcon = () =>
  svg(
    <>
      <path d="M8 1.8 C4.4 1.8 1.5 4.4 1.5 7.7 C1.5 10.3 3.4 12.2 5.7 12.2 C6.6 12.2 7 11.7 7 11 C7 10.4 6.6 10 7.4 10 H10.4 C12.1 10 13.5 8.6 13.5 6.8 C13.5 4 11 1.8 8 1.8 Z" />
      <circle cx="4.6" cy="7.2" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="4.4" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="4.2" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="11.7" cy="6.6" r="0.85" fill="currentColor" stroke="none" />
    </>,
  );

export const LoopIcon = () =>
  svg(
    <>
      <path d="M3.2 9 A4.8 4.8 0 0 1 12.4 6.6" />
      <path d="M9.8 4.4 L12.4 6.6 L10.2 9.2" />
      <path d="M12.8 7 A4.8 4.8 0 0 1 3.6 9.4" />
      <path d="M6.2 11.6 L3.6 9.4 L5.8 6.8" />
    </>,
  );

export const FilmStripIcon = () =>
  svg(
    <>
      <rect x="2" y="4" width="12" height="8" rx="1" />
      <path d="M5 4 V12 M8 4 V12 M11 4 V12" />
    </>,
  );

export const OnionIcon = () =>
  svg(
    <>
      <rect x="1.5" y="4.5" width="8" height="8" rx="1" opacity="0.4" />
      <rect x="6.5" y="3.5" width="8" height="8" rx="1" />
    </>,
  );

export const MagnifierIcon = () =>
  svg(
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10 L14 14" />
      <path d="M5 7 H9 M7 5 V9" strokeWidth="1.1" />
    </>,
  );

export const CopyIcon = () =>
  svg(
    <>
      <rect x="5" y="3" width="8" height="9" rx="1" />
      <path d="M3 5 V12.5 C3 13.3 3.6 14 4.5 14 H10.5" />
    </>,
  );

export const TrashIcon = () =>
  svg(
    <>
      <path d="M3 4 H13" />
      <path d="M5.5 4 V3 C5.5 2.4 5.9 2 6.5 2 H9.5 C10.1 2 10.5 2.4 10.5 3 V4" />
      <path d="M4.5 4 L5.3 13 C5.4 13.6 5.9 14 6.5 14 H9.5 C10.1 14 10.6 13.6 10.7 13 L11.5 4" />
      <path d="M7 7 V11 M9 7 V11" />
    </>,
  );

/**
 * Steam logo — Simple Icons SVG path (CC0, public domain). The 24×24
 * viewBox is intentional: this isn't drawn from our stroke primitives,
 * it's the actual Valve mark, filled in currentColor so the parent's
 * blue tint flows through.
 *
 * Source: github.com/simple-icons/simple-icons/blob/develop/icons/steam.svg
 */
export const SteamIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
  </svg>
);

/** New / plus action. */
export const PlusIcon = () =>
  svg(<path d="M8 3 V13 M3 8 H13" strokeWidth="1.7" />);

export const PauseIcon = () =>
  svg(
    <>
      <path d="M5.5 3.5 V12.5" strokeWidth="2.4" />
      <path d="M10.5 3.5 V12.5" strokeWidth="2.4" />
    </>,
  );
