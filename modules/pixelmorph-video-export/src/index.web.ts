// Web design preview only (docs/web-preview.md): the native exporter does not exist in a browser.
const unavailable = () => Promise.reject(new Error('Disponível só no aparelho.'));

export const exportVideo = unavailable;
export const cancelVideoExport = (): void => {};
export const extractFrame = unavailable;
export const probeVideoRotation = async (): Promise<number | null> => null;
export const probeVideo = unavailable;
export const probeCodecs = async (): Promise<string[]> => ['H.264 (exemplo)', 'AAC (exemplo)'];
export const heicSupported = (): boolean => false;
export const encodeHeic = unavailable;
