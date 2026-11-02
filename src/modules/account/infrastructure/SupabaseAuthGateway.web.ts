import { createStore } from '@core/state';
import { PREVIEW_ACCOUNTS } from '@/web-preview/state';
import type { AuthGateway, AuthState } from '../ports/AuthGateway';

/** Web design preview only (docs/web-preview.md): forms change the state, nothing leaves the page. */
export class SupabaseAuthGateway implements AuthGateway {
  readonly state = createStore<AuthState>({
    status: 'signedIn',
    account: PREVIEW_ACCOUNTS.password,
    linkFailure: null,
  });

  private enter(account: AuthState['account']) {
    this.state.set((prev) => ({ ...prev, status: 'signedIn', account }));
  }

  start(): void {}

  async signIn(): Promise<void> {
    this.enter(PREVIEW_ACCOUNTS.password);
  }

  async signInWithGoogle(): Promise<boolean> {
    this.enter(PREVIEW_ACCOUNTS.google);
    return true;
  }

  /** True: shows the "Confirme seu e-mail" screen. */
  async signUp(): Promise<boolean> {
    return true;
  }

  async resendConfirmation(): Promise<void> {}

  async sendPasswordReset(): Promise<void> {}

  async updatePassword(): Promise<void> {
    this.state.set((prev) => ({
      ...prev,
      status: 'signedIn',
      account: prev.account && { ...prev.account, hasPassword: true },
    }));
  }

  async signOut(): Promise<void> {
    this.state.set((prev) => ({ ...prev, status: 'signedOut', account: null }));
  }
}
