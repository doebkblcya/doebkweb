import raw from "./music.json";

// ── Types ─────────────────────────────────────────────

export interface Track {
  /** 曲序。数据层按此排序（缺省 Infinity 排最后，保持数组序） */
  trackNo?: number;
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
  /** 封面 CDN 路径 `<r2Base>/<专辑名>/cover.jpg`，由下方 map 构造 */
  cover: string;
}

// ── Config ────────────────────────────────────────────

const R2_BASE: string = raw.r2Base;

export const albums: Album[] = raw.albums.map((a: any) => ({
  ...a,
  // 曲序：trackNo 升序（缺省保持数组序排最后）。数组顺序不再承担语义
  tracks: (a.tracks as Track[]).slice().sort((x, y) => (x.trackNo ?? Number.MAX_SAFE_INTEGER) - (y.trackNo ?? Number.MAX_SAFE_INTEGER)),
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
