import { useMemo } from 'react';
import { AppCompositionRoot } from '../CompositionRoot';

/**
 * Hook to access app modules with CompositionRoot.
 * Centralizes dependency injection for all screens.
 */
export function useAppModules() {
  return useMemo(() => AppCompositionRoot, []);
}
