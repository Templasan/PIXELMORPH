import { SupabaseAuthGateway } from './infrastructure/SupabaseAuthGateway';
import type { AuthGateway } from './ports/AuthGateway';

export { AUTH_FAILURE_TEXT, AuthFailure } from './domain/authResult';
export type { Account, AuthFailureKind, AuthStatus } from './domain/authResult';
export type { AuthGateway, AuthState } from './ports/AuthGateway';

export function createAccountModule(): { auth: AuthGateway } {
  return { auth: new SupabaseAuthGateway() };
}
