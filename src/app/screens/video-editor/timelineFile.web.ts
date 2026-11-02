// Web design preview only (docs/web-preview.md): the iframe's editor keeps its own timeline, so a
// preview time-lapse project is always treated as abandoned.
export const timelineHasClips = async (_projectId: string): Promise<boolean> => false;
