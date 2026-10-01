import raw from "./albums.json";

export interface Album {
  id: string;
  name: string;
  artist: string;
  cover: string;
  thumb?: string;
  released?: string;
  genres?: string[];
  label?: string;
  review: string;
  appleMusicUrl?: string;
  sources?: { title: string; url: string }[];
}

/** Reviewed, saved data only. No API calls during build or in the browser. */
export const albums: Album[] = raw satisfies Album[];
