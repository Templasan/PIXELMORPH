/**
 * RF-021: what tells a player an mp4 is a 360 video: Google's Spherical Video V1 box, in the video
 * track. Only the moov box grows, and it is the last thing in the file, so no offset moves.
 */
const UUID = [0xff, 0xcc, 0x82, 0x63, 0xf8, 0x55, 0x4a, 0x93, 0x88, 0x14, 0x58, 0x7a, 0x02, 0x52, 0x1f, 0xdd];
const XML =
  '<?xml version="1.0"?><rdf:SphericalVideo xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">' +
  '<GSpherical:Spherical>true</GSpherical:Spherical><GSpherical:Stitched>true</GSpherical:Stitched>' +
  '<GSpherical:StitchingSoftware>PixelMorph</GSpherical:StitchingSoftware>' +
  '<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType></rdf:SphericalVideo>';

const typeAt = (b: Uint8Array, at: number) => String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Each child box of the box at `start`..`end`, as [offset, size]. */
function boxes(b: Uint8Array, start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  for (let at = start; at + 8 <= end; ) {
    const size = view(b).getUint32(at);
    if (size < 8 || at + size > end) break;
    out.push([at, size]);
    at += size;
  }
  return out;
}

function isVideoTrack(b: Uint8Array, at: number, size: number): boolean {
  const mdia = boxes(b, at + 8, at + size).find(([o]) => typeAt(b, o) === 'mdia');
  if (!mdia) return false;
  const hdlr = boxes(b, mdia[0] + 8, mdia[0] + mdia[1]).find(([o]) => typeAt(b, o) === 'hdlr');
  // Size, type, version and flags, predefined, then the handler's own type.
  return !!hdlr && String.fromCharCode(...b.subarray(hdlr[0] + 16, hdlr[0] + 20)) === 'vide';
}

/** The moov box with the 360 box added to its video track. Returned as it was if it has none. */
export function withSphericalMetadata(moov: Uint8Array): Uint8Array {
  const trak = boxes(moov, 8, moov.length).find(([o, s]) => typeAt(moov, o) === 'trak' && isVideoTrack(moov, o, s));
  if (!trak) return moov;
  const xml = new TextEncoder().encode(XML);
  const size = 8 + UUID.length + xml.length;
  const end = trak[0] + trak[1];
  const out = new Uint8Array(moov.length + size);
  out.set(moov.subarray(0, end));
  const v = view(out);
  v.setUint32(end, size);
  out.set([0x75, 0x75, 0x69, 0x64], end + 4); // 'uuid'
  out.set(UUID, end + 8);
  out.set(xml, end + 8 + UUID.length);
  out.set(moov.subarray(end), end + size);
  v.setUint32(0, moov.length + size);
  v.setUint32(trak[0], trak[1] + size);
  return out;
}
