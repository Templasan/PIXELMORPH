import { isValidQRContent, isValidURL, type QRCode } from '../../domain/QRCode';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function createValidateQRCodeUseCase() {
  return {
    execute(qr: QRCode): ValidationResult {
      if (!isValidQRContent(qr.content)) {
        return {
          valid: false,
          error: 'QR content must be 1-2953 characters',
        };
      }

      // Check if content looks like a URL
      const looksLikeURL = qr.content.startsWith('http://') || qr.content.startsWith('https://');
      if (looksLikeURL && !isValidURL(qr.content)) {
        return {
          valid: false,
          error: 'Invalid URL format',
        };
      }

      return { valid: true };
    },
  };
}
