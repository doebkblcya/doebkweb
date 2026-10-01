import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const base = 'https://cdn.doebkblcya.com';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function mediaUrl(value, prefix) {
  try {
    const url = new URL(value);
    return url.origin === base && url.pathname.startsWith(`/${prefix}/`) && !url.search && !url.hash;
  } catch { return false; }
}
export function validate(albums, photos) {
  assert(Array.isArray(albums) && Array.isArray(photos), 'Albums and photos must be arrays.');
  const ids = new Set(), urls = new Set();
  const unique = url => { assert(!urls.has(url), `Duplicate image URL: ${url}`); urls.add(url); };
  for (const [index, album] of albums.entries()) {
    const label = `Album ${index + 1}`;
    assert(album && typeof album.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album.id) && !ids.has(album.id), `${label}: missing or duplicate id.`); ids.add(album.id);
    assert(text(album.name) && text(album.artist) && typeof album.review === 'string', `${label}: name, artist and review are required.`);
    assert(mediaUrl(album.cover, 'albums'), `${label}: invalid R2 cover URL.`); unique(album.cover);
    if (album.thumb !== undefined) { assert(mediaUrl(album.thumb, 'albums'), `${label}: invalid R2 preview URL.`); unique(album.thumb); }
    assert(!('tracks' in album), `${label}: playback tracks are no longer supported.`);
    if (album.released !== undefined) assert(typeof album.released === 'string' && (date(album.released) || /^\d{4}$/.test(album.released)), `${label}: release must be YYYY-MM-DD or YYYY.`);
    if (album.genres !== undefined) assert(Array.isArray(album.genres) && album.genres.every(text), `${label}: invalid genres.`);
    if (album.label !== undefined) assert(text(album.label), `${label}: invalid label.`);
    if (album.appleMusicUrl !== undefined) {
      let url; try { url = new URL(album.appleMusicUrl); } catch { /* invalid */ }
      assert(url?.protocol === 'https:' && url.hostname === 'music.apple.com' && url.pathname.includes('/album/'), `${label}: invalid Apple Music album URL.`);
    }
    if (album.sources !== undefined) {
      assert(Array.isArray(album.sources), `${label}: sources must be an array.`);
      for (const source of album.sources) {
        assert(source && text(source.title), `${label}: invalid source title.`);
        let url; try { url = new URL(source.url); } catch { /* invalid */ }
        assert(url?.protocol === 'https:', `${label}: source URL must use HTTPS.`);
      }
    }
  }
  for (const [index, photo] of photos.entries()) {
    const label = `Photo ${index + 1}`;
    assert(photo && mediaUrl(photo.src, 'photos') && mediaUrl(photo.thumb, 'photos'), `${label}: invalid R2 URLs.`);
    unique(photo.src); unique(photo.thumb);
    assert(text(photo.alt), `${label}: meaningful alt text is required.`);
    assert(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0, `${label}: invalid image dimensions.`);
    assert(date(photo.date), `${label}: capture date must be YYYY-MM-DD.`);
    if (photo.note !== undefined) assert(typeof photo.note === 'string', `${label}: note must be text.`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const albums = JSON.parse(await readFile(process.argv[2] || 'src/data/albums.json', 'utf8'));
  const photos = JSON.parse(await readFile(process.argv[3] || 'src/data/photos.json', 'utf8'));
  validate(albums, photos);
  process.stdout.write(`Validated ${albums.length} albums and ${photos.length} photos.\n`);
}
