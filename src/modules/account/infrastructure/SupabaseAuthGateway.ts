import { AppState, Linking } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { CONFIG } from '@core/infrastructure/config';
import { supabase } from '@core/infrastructure/supabase';
import { createStore } from '@core/state';
import {
  AuthFailure,
  classifyAuthError,
  parseAuthCallback,
  type Account,
} from '../domain/authResult';
import type { AuthGateway, AuthState } from '../ports/AuthGateway';

const CALLBACK_URL = 'pixelmorph://auth-callback';

function accountOf(session: Session): Account {
  const meta = session.user.user_metadata as { full_name?: string; name?: string };
  const email = session.user.email ?? '';
  return { id: session.user.id, email, name: meta.full_name || meta.name || email };
}

function failOn(error: { code?: string; status?: number } | null): void {
  if (error) throw new AuthFailure(classifyAuthError(error.code, error.status));
}

export class SupabaseAuthGateway implements AuthGateway {
  readonly state = createStore<AuthState>({ status: 'loading', account: null, linkFailure: null });
  private recovering = false;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    GoogleSignin.configure({ webClientId: CONFIG.googleWebClientId });
    supabase.auth.onAuthStateChange((_event, session) => {
      this.state.set((prev) => ({
        ...prev,
        status: !session ? 'signedOut' : this.recovering ? 'recovery' : 'signedIn',
        account: session ? accountOf(session) : null,
      }));
    });
    AppState.addEventListener('change', (next) => {
      if (next === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    Linking.addEventListener('url', ({ url }) => void this.openLink(url));
    void Linking.getInitialURL().then((url) => {
      if (url) void this.openLink(url);
    });
  }

  private async openLink(url: string): Promise<void> {
    const link = parseAuthCallback(url);
    if (!link) return;
    const fail = (code: string | undefined, status: number | undefined) =>
      this.state.set((prev) => ({ ...prev, linkFailure: classifyAuthError(code, status) }));
    if (link.errorCode || !link.accessToken || !link.refreshToken) {
      fail(link.errorCode ?? 'otp_expired', 400);
      return;
    }
    this.recovering = link.type === 'recovery';
    const { error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (error) {
      this.recovering = false;
      fail(error.code, error.status);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    failOn(error);
  }

  async signInWithGoogle(): Promise<boolean> {
    let idToken: string | null;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return false;
      idToken = result.data.idToken;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return false;
      throw new AuthFailure('googleUnavailable');
    }
    if (!idToken) throw new AuthFailure('googleUnavailable');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    failOn(error);
    return true;
  }

  async signUp(name: string, email: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: CALLBACK_URL },
    });
    failOn(error);
    return data.session === null;
  }

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: CALLBACK_URL },
    });
    failOn(error);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: CALLBACK_URL,
    });
    failOn(error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    failOn(error);
    this.recovering = false;
    this.state.set((prev) => ({ ...prev, status: 'signedIn' }));
  }

  async signOut(): Promise<void> {
    this.recovering = false;
    // Local scope: leaving must work offline, and other devices stay signed in.
    await supabase.auth.signOut({ scope: 'local' });
    await GoogleSignin.signOut().catch(() => {});
  }
}
