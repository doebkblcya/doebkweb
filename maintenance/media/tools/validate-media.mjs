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
function captureTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/.test(value) && date(value.slice(0, 10));
}
function mediaUrl(value, prefix) {
  try {
    const url = new URL(value);
    return url.origin === base && url.pathname.startsWith(`/${prefix}/`) && !url.search && !url.hash;
  } catch { return false; }
}
export function validate(albums, photos, groups = [], cats = []) {
  assert(Array.isArray(albums) && Array.isArray(photos) && Array.isArray(cats), 'Albums, photos and cats must be arrays.');
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
  const photoIds = new Set(), imageIds = new Set();
  for (const [index, photo] of [...photos, ...cats].entries()) {
    const label = index < photos.length ? `Photo ${index + 1}` : `Cat ${index - photos.length + 1}`;
    assert(photo && mediaUrl(photo.src, 'photos') && mediaUrl(photo.thumb, 'photos'), `${label}: invalid R2 URLs.`);
    unique(photo.src); unique(photo.thumb);
    assert(text(photo.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(photo.id) && !imageIds.has(photo.id), `${label}: missing or duplicate photo id.`);
    imageIds.add(photo.id);
    if (index < photos.length) photoIds.add(photo.id);
    assert(text(photo.name) && !/[\\/]/.test(photo.name), `${label}: original filename is required.`);
    assert(!('alt' in photo), `${label}: the description field has been removed.`);
    assert(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0, `${label}: invalid image dimensions.`);
    if (photo.date !== undefined) assert(captureTime(photo.date), `${label}: invalid capture time.`);
    if (photo.note !== undefined) assert(typeof photo.note === 'string', `${label}: note must be text.`);
  }
  assert(Array.isArray(groups), 'Photo groups must be an array.');
  const groupIds = new Set(), exhibited = new Set();
  for (const group of groups) {
    assert(group && text(group.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id) && !groupIds.has(group.id) && text(group.name), 'Invalid or duplicate photo group.');
    assert(!('note' in group), `Group ${group.id}: notes belong to individual photos.`);
    groupIds.add(group.id);
    assert(!('rows' in group), `Group ${group.id}: use photo order, not row layouts.`);
    assert(Array.isArray(group.photos) && group.photos.length > 0, `Group ${group.id}: photos are required.`);
    for (const id of group.photos) {
      assert(photoIds.has(id) && !exhibited.has(id), `Group ${group.id}: unknown or repeated photo ${id}.`);
      exhibited.add(id);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const albums = JSON.parse(await readFile(process.argv[2] || 'src/data/albums.json', 'utf8'));
  const photos = JSON.parse(await readFile(process.argv[3] || 'src/data/photos.json', 'utf8'));
  const groups = JSON.parse(await readFile(process.argv[4] || 'src/data/photo-groups.json', 'utf8'));
  const cats = JSON.parse(await readFile(process.argv[5] || 'src/data/cats.json', 'utf8'));
  validate(albums, photos, groups, cats);
  process.stdout.write(`Validated ${albums.length} albums, ${photos.length} photos, ${groups.length} exhibition groups and ${cats.length} about-page cats.\n`);
}
