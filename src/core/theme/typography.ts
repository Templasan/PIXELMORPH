import { Platform } from 'react-native';

/** Roboto sizes from the spec: 20 / 16 / 14 / 13 / 12 / 10. */
export const fontSize = {
  xl: 20,
  lg: 16,
  md: 14,
  sm: 13,
  xs: 12,
  xxs: 10,
} as const;

/** Every numeric value (dimensions, time, dB, %, hex) uses a monospace face. */
export const monoFontFamily = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  default: 'monospace',
});
