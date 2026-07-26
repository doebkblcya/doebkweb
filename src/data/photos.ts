export interface Photo {
  src: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
}

const R2_PHOTOS = "https://cdn.doebkblcya.com/photos";

/**
 * Photo collection.
 * Photos stored on R2: photos/originals/ for full-res, photos/thumbs/ for WebP thumbnails.
 * Add entries here as photos are uploaded.
 */
export const photos: Photo[] = [
  // Example entry (uncomment when photo is uploaded):
  // { src: `${R2_PHOTOS}/originals/example.jpg`, thumb: `${R2_PHOTOS}/thumbs/example.webp`, alt: "Example photo", width: 4032, height: 3024 },
];
