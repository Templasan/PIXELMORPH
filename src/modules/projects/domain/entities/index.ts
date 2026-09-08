export type { MediaMetadata } from './MediaMetadata';
export { createMediaMetadata, validateMediaMetadata } from './MediaMetadata';

export type { MediaAsset } from './MediaAsset';
export { createMediaAsset, updateMediaAsset, validateMediaAsset } from './MediaAsset';

export type { Project } from './Project';
export {
  createProject,
  addAssetToProject,
  removeAssetFromProject,
  updateProjectAsset,
  updateProject,
  validateProject,
} from './Project';
