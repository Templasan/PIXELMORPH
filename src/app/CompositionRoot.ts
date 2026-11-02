import { createAccountModule } from '@modules/account';
import { createProjectsModule } from '@modules/projects';
import { createProjectSync } from '@modules/projects/sync';

/**
 * Global composition root. Instantiates all modules and their adapters.
 * This is the single place where dependency injection happens.
 * Screens and components should only call use cases through these module instances.
 */
export const AppCompositionRoot = {
  account: createAccountModule(),
  projects: createProjectsModule(),
  sync: createProjectSync(),
};

export type AppCompositionRootType = typeof AppCompositionRoot;
