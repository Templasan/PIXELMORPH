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
  logLevel: (process.env.LOG_LEVEL || 'debug') as 'debug' | 'info' | 'warn' | 'error',
};
