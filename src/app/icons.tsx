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

export const OnionIcon = () =>
  svg(
    <>
      <rect x="1.5" y="4.5" width="8" height="8" rx="1" opacity="0.4" />
      <rect x="6.5" y="3.5" width="8" height="8" rx="1" />
    </>,
  );

export const PauseIcon = () =>
  svg(
    <>
      <path d="M5.5 3.5 V12.5" strokeWidth="2.4" />
      <path d="M10.5 3.5 V12.5" strokeWidth="2.4" />
    </>,
  );
