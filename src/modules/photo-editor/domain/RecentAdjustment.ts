export interface RecentAdjustment {
  id: string;
  adjustments: Record<string, number>;
  timestamp: Date;
}

export function createRecentAdjustment(
  id: string,
  adjustments: Record<string, number>
): RecentAdjustment {
  return {
    id,
    adjustments,
    timestamp: new Date(),
  };
}
