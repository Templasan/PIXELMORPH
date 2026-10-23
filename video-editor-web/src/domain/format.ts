import type { ProjectFormat } from '../ports/host';

export const PROJECT_FORMATS: readonly { id: ProjectFormat; label: string }[] = [
  { id: '16:9', label: '16:9 (YouTube)' },
  { id: '9:16', label: '9:16 (Reels, TikTok)' },
  { id: '1:1', label: '1:1 (Quadrado)' },
  { id: '4:3', label: '4:3' },
];

const RATIO: Record<ProjectFormat, [number, number]> = {
  '16:9': [16, 9],
  '9:16': [9, 16],
  '1:1': [1, 1],
  '4:3': [4, 3],
};

const even = (n: number) => 2 * Math.round(n / 2);

/** Frame size of `format` with `shortEdge` px on its short side (even sides, as H.264 wants). */
export function frameSize(format: ProjectFormat, shortEdge: number): { width: number; height: number } {
  const [w, h] = RATIO[format];
  return w >= h
    ? { width: even((shortEdge * w) / h), height: shortEdge }
    : { width: shortEdge, height: even((shortEdge * h) / w) };
}
