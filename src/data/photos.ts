import photosJson from "./photos.json";

export interface Photo {
  id: string;
  name: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
  date?: string;
  /** Actual focal length in millimetres, f-number, exposure in seconds, and ISO. */
  focalLength?: number;
  aperture?: number;
  exposureTime?: number;
  iso?: number;
  note?: string;
}

/** Static photo records. See maintenance/media/photos.md for processing and publication. */
export const photos: Photo[] = photosJson satisfies Photo[];
