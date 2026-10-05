import { createProjectsModule } from '@modules/projects';

/**
 * Global composition root. Instantiates all modules and their adapters.
 * This is the single place where dependency injection happens.
 * Screens and components should only call use cases through these module instances.
 */
export const AppCompositionRoot = {
  projects: createProjectsModule(),
};

export type AppCompositionRootType = typeof AppCompositionRoot;
