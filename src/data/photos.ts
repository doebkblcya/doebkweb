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

/** Static photo records. See maintenance/media/photos.md for processing and publication. */
export const photos: Photo[] = photosJson satisfies Photo[];
