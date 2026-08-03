import photosJson from "./photos.json";

export interface Photo {
  src: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
  date: string;
  note?: string;
}

/**
 * Photo collection (data lives in photos.json).
 * Photos stored on R2: photos/originals/ for full-res, photos/thumbs/ for WebP thumbnails.
 * Use `pnpm media photos <raw目录>` to process + upload + append entries.
 */
export const photos: Photo[] = photosJson satisfies Photo[];
