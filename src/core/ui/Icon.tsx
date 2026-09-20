import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

/** Outline icon paths (24x24 viewBox), ported 1:1 from the Figma Make prototype's icons.tsx. */
const paths: Record<string, string> = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  sort: 'M3 7h18M6 12h12M9 17h6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M18 15l-6-6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  camera:
    'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff:
    'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  play: 'M5 3l14 9-14 9V3z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  skipBack: 'M19 20L9 12l10-8v16zM5 4v16',
  skipForward: 'M5 4l10 8-10 8V4zM19 4v16',
  rewindFrame: 'M11 6l-7 6 7 6M18 6l-7 6 7 6',
  forwardFrame: 'M13 6l7 6-7 6M6 6l7 6-7 6',
  undo: 'M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13',
  redo: 'M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  image:
    'M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
  film: 'M2 8h20M2 16h20M9 2v20M15 2v20M3 2h18a1 1 0 011 1v18a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  messageCircle: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z',
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  settings: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 9v3l2 2',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8h.01M11 12h1v4h1',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  users:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  bookOpen: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  crop: 'M6.13 1L6 16a2 2 0 002 2h15M1 6.13L16 6a2 2 0 012 2v15',
  wand: 'M15 4l5 5-13 13H2v-5L15 4zM12.5 6.5l5 5',
  scissors:
    'M6 3a3 3 0 110 6 3 3 0 010-6zM6 15a3 3 0 110 6 3 3 0 010-6zM20 4L8.12 15.88M15.88 15.88L20 20',
  flash: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  sun: 'M12 7a5 5 0 100 10A5 5 0 0012 7zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  compare: 'M9 19l-7-7 7-7M15 5l7 7-7 7',
  maximize: 'M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M3 16v3a2 2 0 002 2h3',
  triangle: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  rotate: 'M23 4v6h-6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  ripple: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 3a9 9 0 100 18A9 9 0 0012 3z',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  flipHorizontal: 'M7 4L3 8l4 4M17 4l4 4-4 4M3 8h18M12 3v18',
  mask: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM9 9l6 6M15 9l-6 6',
  retouch: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  effects: 'M12 2l1.8 5.4H19l-4.6 3.3 1.8 5.4L12 13l-4.2 3.1 1.8-5.4L5 7.4h5.2L12 2z',
  robot:
    'M12 2a4 4 0 014 4v1h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4zM9 13a1 1 0 102 0 1 1 0 00-2 0zM13 13a1 1 0 102 0 1 1 0 00-2 0z',
  preset: 'M12 3v18M4 7l8-4 8 4M4 17l8 4 8-4M4 12h16',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  printer:
    'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z',
  collage: 'M2 3h8v8H2zM14 3h8v8h-8zM2 13h8v8H2zM14 13h8v8h-8z',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = colors.icone }: IconProps) {
  const d = paths[name] ?? paths.x;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
