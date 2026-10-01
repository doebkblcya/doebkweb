import photosJson from "./photos.json";
import groupsJson from "./photo-groups.json";

export interface Photo {
  id: string;
  name: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
  date?: string;
  note?: string;
}

export interface PhotoGroup {
  id: string;
  name: string;
  photos: string[];
}

/** Static photo records. See maintenance/media/photos.md for processing and publication. */
export const photos: Photo[] = photosJson satisfies Photo[];
// Exhibition order and references are checked by validate-media.mjs before publishing.
export const photoGroups = groupsJson as PhotoGroup[];
