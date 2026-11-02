const ENV = {
  DEV: 'development',
  STAGING: 'staging',
  PROD: 'production',
};

const API_BASE_URLS = {
  [ENV.DEV]: process.env.API_BASE_URL || 'http://localhost:3000',
  [ENV.STAGING]: process.env.API_BASE_URL || 'https://staging-api.pixelmorph.dev',
  [ENV.PROD]: process.env.API_BASE_URL || 'https://api.pixelmorph.dev',
};

const ENVIRONMENT = (process.env.ENVIRONMENT || ENV.DEV) as keyof typeof API_BASE_URLS;

export const CONFIG = {
  environment: ENVIRONMENT,
  apiBaseUrl: API_BASE_URLS[ENVIRONMENT],
  isDevelopment: ENVIRONMENT === ENV.DEV,
  isStaging: ENVIRONMENT === ENV.STAGING,
  isProduction: ENVIRONMENT === ENV.PROD,
  /** RNF-017: HTTPS endpoint that receives anonymous error reports. Empty = nothing is sent. */
  errorReportUrl: process.env.EXPO_PUBLIC_ERROR_REPORT_URL || '',
  /** Public by design: the publishable key and the OAuth client id only identify the app. */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vqpzwjwhsrsjbsqnnofi.supabase.co',
  supabaseKey:
    process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_uYtPcCI3jVtGlBv94ShdmQ_6DDwRTTN',
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '920774188192-b2jcrjkudsgqb0ds31v1fs8vcfl6f6ng.apps.googleusercontent.com',
  logLevel: (process.env.LOG_LEVEL || 'debug') as 'debug' | 'info' | 'warn' | 'error',
};
