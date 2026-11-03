import { qrModules } from '../domain/QRCode';

/** Modules of white around the code: scanners need this margin. */
const QUIET_MODULES = 4;
/** Long enough to stay sharp on most exports; a smaller layer scales it down. */
const SOURCE_PX = 1024;

/** A QR code as a PNG data URL, which saves with the layer like any other of its fields. */
export function qrDataUrl(content: string): string {
  const modules = qrModules(content);
  const side = modules.length + QUIET_MODULES * 2;
  const k = Math.ceil(SOURCE_PX / side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side * k;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect((x + QUIET_MODULES) * k, (y + QUIET_MODULES) * k, k, k);
    })
  );
  const url = canvas.toDataURL('image/png');
  canvas.width = canvas.height = 0;
  return url;
}
