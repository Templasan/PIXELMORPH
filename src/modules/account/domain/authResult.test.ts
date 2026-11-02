import { classifyAuthError, parseAuthCallback } from './authResult';

describe('parseAuthCallback', () => {
  it('reads the tokens and the link type from the fragment', () => {
    expect(
      parseAuthCallback(
        'pixelmorph://auth-callback#access_token=a.b&refresh_token=r1&type=recovery'
      )
    ).toEqual({ type: 'recovery', accessToken: 'a.b', refreshToken: 'r1', errorCode: null });
  });

  it('reads an expired link', () => {
    const parsed = parseAuthCallback(
      'pixelmorph://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
    );
    expect(parsed?.errorCode).toBe('otp_expired');
    expect(parsed?.accessToken).toBeNull();
  });

  it('ignores other links', () => {
    expect(parseAuthCallback('pixelmorph://other#access_token=x')).toBeNull();
    expect(parseAuthCallback('pixelmorph://auth-callback-evil#access_token=x')).toBeNull();
    expect(parseAuthCallback('https://example.com/auth-callback#access_token=x')).toBeNull();
  });
});

describe('classifyAuthError', () => {
  it('maps server codes and treats no status as no connection', () => {
    expect(classifyAuthError('invalid_credentials', 400)).toBe('invalidCredentials');
    expect(classifyAuthError('email_not_confirmed', 400)).toBe('emailNotConfirmed');
    expect(classifyAuthError(undefined, 429)).toBe('rateLimited');
    expect(classifyAuthError(undefined, 0)).toBe('network');
    expect(classifyAuthError(undefined, undefined)).toBe('network');
    expect(classifyAuthError('whatever', 500)).toBe('unknown');
  });
});
