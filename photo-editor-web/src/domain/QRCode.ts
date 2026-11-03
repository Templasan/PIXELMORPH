import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';

export interface QRCode {
  id: string;
  content: string; // URL or text
  x: number; // 0..1 (relative position)
  y: number; // 0..1
  size: number; // 0.05..0.5 (relative to canvas)
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'; // Low, Medium, Quartile, High
  createdAt: Date;
}

export function createQRCode(id: string, content: string): QRCode {
  return {
    id,
    content,
    x: 0.9, // Default: bottom-right
    y: 0.9,
    size: 0.15,
    errorCorrectionLevel: 'M',
    createdAt: new Date(),
  };
}

export function isValidQRContent(content: string): boolean {
  if (!content || content.length === 0) return false;
  if (content.length > 2953) return false; // Max alphanumeric capacity for QR code
  return true;
}

export function isValidURL(url: string): boolean {
  if (!isValidQRContent(url)) return false;
  // Simple pattern: starts with http:// or https://, has some content
  const urlPattern = /^https?:\/\/.+/;
  return urlPattern.test(url);
}

export function updateQRCode(qr: QRCode, updates: Partial<QRCode>): QRCode {
  return {
    ...qr,
    ...updates,
    x: Math.max(0, Math.min(1, updates.x ?? qr.x)),
    y: Math.max(0, Math.min(1, updates.y ?? qr.y)),
    size: Math.max(0.05, Math.min(0.5, updates.size ?? qr.size)),
  };
}

/** RF-066: the dark and light modules of a QR code for `content`, row by row. */
export function qrModules(content: string): boolean[][] {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; // accents, in every scanner
  const qr = qrcode(0, 'M');
  qr.addData(content, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)));
}

/** What a QR code in these RGBA pixels says; null when none can be read. */
export function readQr(rgba: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(rgba, width, height)?.data ?? null;
}
