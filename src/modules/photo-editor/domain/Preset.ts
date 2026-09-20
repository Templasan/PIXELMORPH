export interface Preset {
  id: string;
  name: string;
  adjustments: Record<string, number>;
  createdAt: Date;
}

export function createPreset(
  id: string,
  name: string,
  adjustments: Record<string, number>
): Preset {
  return {
    id,
    name,
    adjustments,
    createdAt: new Date(),
  };
}
