import type { Store } from '@core/state';
import type { Account, AuthFailureKind, AuthStatus } from '../domain/authResult';

export interface AuthState {
  status: AuthStatus;
  account: Account | null;
  /** A problem with a link from an account e-mail, waiting to be shown. */
  linkFailure: AuthFailureKind | null;
}

/**
 * Login is optional: the app works signed out, and a feature that needs an account checks
 * state.status. Failures reject with AuthFailure.
 */
export interface AuthGateway {
  readonly state: Store<AuthState>;
  /** Restores the saved session and starts listening for e-mail links. */
  start(): void;
  signIn(email: string, password: string): Promise<void>;
  /** Resolves false when the user closed Google's account picker. */
  signInWithGoogle(): Promise<boolean>;
  /** Resolves true when the account still needs its e-mail confirmed. */
  signUp(name: string, email: string, password: string): Promise<boolean>;
  resendConfirmation(email: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}
