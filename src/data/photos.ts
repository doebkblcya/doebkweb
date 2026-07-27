export interface Photo {
  src: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
  date: string;
  note?: string;
}

const R2_PHOTOS = "https://cdn.doebkblcya.com/photos";

/**
 * Photo collection.
 * Photos stored on R2: photos/originals/ for full-res, photos/thumbs/ for WebP thumbnails.
 * Add entries here as photos are uploaded.
 */
export const photos: Photo[] = [
  { src: `${R2_PHOTOS}/originals/DSC05672.jpg`, thumb: `${R2_PHOTOS}/thumbs/DSC05672.webp`, alt: "DSC05672", width: 2000, height: 1333, date: "2026-07-25T19:44:41" },
  { src: `${R2_PHOTOS}/originals/DSC05674.jpg`, thumb: `${R2_PHOTOS}/thumbs/DSC05674.webp`, alt: "DSC05674", width: 2000, height: 1333, date: "2026-07-25T19:45:25" },
  { src: `${R2_PHOTOS}/originals/DSC05681.jpg`, thumb: `${R2_PHOTOS}/thumbs/DSC05681.webp`, alt: "DSC05681", width: 2000, height: 1333, date: "2026-07-25T19:45:54" },
];
