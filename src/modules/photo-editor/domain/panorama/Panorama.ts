export interface PanoramaImage {
  image: any; // SkImage
  offsetX: number; // pixel displacement from previous image
}

export interface PanoramaCompositionOptions {
  overlapWidth: number; // pixels of overlap for blending
  outputHeight: number;
}
