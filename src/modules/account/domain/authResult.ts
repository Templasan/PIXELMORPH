export interface Account {
  id: string;
  email: string;
  name: string;
}

/** 'recovery': a password reset link was opened; the session only leads to the new password screen. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'recovery';

export type AuthFailureKind =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'weakPassword'
  | 'rateLimited'
  | 'network'
  | 'linkExpired'
  | 'googleUnavailable'
  | 'unknown';

/** Text for each failure; the key the app's t() translates. */
export const AUTH_FAILURE_TEXT: Record<AuthFailureKind, string> = {
  invalidCredentials: 'E-mail ou senha incorretos.',
  emailNotConfirmed: 'Confirme seu e-mail antes de entrar.',
  weakPassword: 'Senha fraca. Use pelo menos 8 caracteres.',
  rateLimited: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  network: 'Sem conexão com o servidor. Verifique sua internet.',
  linkExpired: 'Este link expirou ou já foi usado. Peça um novo.',
  googleUnavailable: 'Não foi possível entrar com o Google neste aparelho.',
  unknown: 'Algo deu errado. Tente de novo.',
};

export class AuthFailure extends Error {
  constructor(readonly kind: AuthFailureKind) {
    super(kind);
    this.name = 'AuthFailure';
  }
}

export function classifyAuthError(
  code: string | undefined,
  status: number | undefined
): AuthFailureKind {
  switch (code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'weak_password':
      return 'weakPassword';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rateLimited';
    case 'otp_expired':
    case 'flow_state_expired':
      return 'linkExpired';
  }
  if (status === 429) return 'rateLimited';
  // The client reports a request that never reached the server with no status or status 0.
  if (!status) return 'network';
  return 'unknown';
}

export interface AuthCallback {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  errorCode: string | null;
}

/**
 * What a link from an account e-mail brought back. Tokens arrive in the fragment
 * (pixelmorph://auth-callback#access_token=...&refresh_token=...&type=signup).
 * Returns null for any URL that is not this callback.
 */
export function parseAuthCallback(url: string): AuthCallback | null {
  if (!/^pixelmorph:\/\/auth-callback(?:[/?#]|$)/.test(url)) return null;
  const params: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const at = pair.indexOf('=');
      if (at > 0)
        params[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' '));
    }
  }
  return {
    type: params.type ?? null,
    accessToken: params.access_token ?? null,
    refreshToken: params.refresh_token ?? null,
    errorCode: params.error_code ?? params.error ?? null,
  };
}
