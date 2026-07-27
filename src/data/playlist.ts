import raw from "./music.json";

// ── Types ─────────────────────────────────────────────

export interface Track {
  title: string;
  file: string;
  lrc?: string;
}

export interface AlbumMeta {
  released?: string;
  genres?: string[];
  styles?: string[];
  label?: string;
  catNo?: string;
  country?: string;
  discogsUrl?: string;
  totalDuration?: number;
}

export interface Album {
  name: string;
  artist: string;
  review?: string;
  meta?: AlbumMeta;
  tracks: Track[];
}

// ── Config ────────────────────────────────────────────

const R2_BASE: string = raw.r2Base;

export const albums: Album[] = raw.albums.map((a: any) => ({
  ...a,
  review: a.review || undefined,
  meta: Object.keys(a.meta || {}).length ? a.meta : undefined,
  cover: `${R2_BASE}/${encodeURIComponent(a.name)}/cover.jpg`,
}));

/**
 * Flat list of all tracks, for the player.
 */
export const playlist: (Track & { album: string; url: string })[] = [];
for (const album of albums) {
  for (const track of album.tracks) {
    playlist.push({
      ...track,
      album: album.name,
      url: `${R2_BASE}/${encodeURIComponent(album.name)}/${encodeURIComponent(track.file)}`,
    });
  }
}

// ── Helpers ───────────────────────────────────────────

export function getTrackUrl(track: Track & { album?: string }): string {
  const album = (track as any).album || "";
  return `${R2_BASE}/${encodeURIComponent(album)}/${encodeURIComponent(track.file)}`;
}

/** Flat track data for VinylPlayer (only what the client needs). */
export function getFlatTracks(): { title: string; album: string; file: string }[] {
  const result: { title: string; album: string; file: string }[] = [];
  for (const album of albums) {
    for (const track of album.tracks) {
      result.push({ title: track.title, album: album.name, file: track.file });
    }
  }
  return result;
}
