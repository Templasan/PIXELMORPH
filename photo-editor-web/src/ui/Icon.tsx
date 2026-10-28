/** Line icons (same paths as the app's @core/ui Icon). */
const paths: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  play: 'M5 3l14 9-14 9V3z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  undo: 'M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13',
  redo: 'M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  image: 'M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
  film: 'M2 8h20M2 16h20M9 2v20M15 2v20M3 2h18a1 1 0 011 1v18a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z',
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  scissors: 'M6 3a3 3 0 110 6 3 3 0 010-6zM6 15a3 3 0 110 6 3 3 0 010-6zM20 4L8.12 15.88M15.88 15.88L20 20',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6',
  rotate: 'M23 4v6h-6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  sun: 'M12 7a5 5 0 100 10A5 5 0 0012 7zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  compare: 'M9 19l-7-7 7-7M15 5l7 7-7 7',
  crop: 'M6.13 1L6 16a2 2 0 002 2h15M1 6.13L16 6a2 2 0 012 2v15',
  maximize: 'M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M3 16v3a2 2 0 002 2h3',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  ripple: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 3a9 9 0 100 18A9 9 0 0012 3z',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8h.01M11 12h1v4h1',
  back: 'M15 18l-6-6 6-6',
  skipBack: 'M19 20L9 12l10-8v16zM5 19V5',
  skipFwd: 'M5 4l10 8-10 8V4zM19 5v14',
  stepBack: 'M11 17l-5-5 5-5M18 17l-5-5 5-5',
  stepFwd: 'M13 17l5-5-5-5M6 17l5-5-5-5',
  speed: 'M12 22a10 10 0 110-20 10 10 0 010 20zM12 12l4-4',
  volume: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1',
  freeze: 'M12 2v20M2 12h20M5 5l14 14M19 5L5 19',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[name] ?? paths.x}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
