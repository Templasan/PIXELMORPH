/**
 * US-05 / RF-078: a phone stores a portrait video as sideways frames plus a rotation tag. The
 * player, the project size and the exporter all honour that tag, so the picture is already
 * upright; this only words what the file says, so the user can see it was corrected.
 */
export function describeFileOrientation(rotationDegrees: number | null): string {
  if (rotationDegrees === null) return '';
  const turn = (((Math.round(rotationDegrees / 90) * 90) % 360) + 360) % 360;
  if (turn === 0) return 'Orientação do arquivo: normal (nenhuma correção necessária)';
  return `Orientação do arquivo: gravado girado em ${turn}°, corrigido automaticamente`;
}
