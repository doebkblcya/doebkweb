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
export function validate(albums, photos, groups = [], pets = []) {
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
  const photoIds = new Set(), imageIds = new Set();
  for (const [index, photo] of photos.entries()) {
    const label = `Photo ${index + 1}`;
    assert(photo && mediaUrl(photo.src, 'photos') && mediaUrl(photo.thumb, 'photos'), `${label}: invalid R2 URLs.`);
    unique(photo.src); unique(photo.thumb);
    assert(text(photo.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(photo.id) && !imageIds.has(photo.id), `${label}: missing or duplicate photo id.`);
    imageIds.add(photo.id);
    photoIds.add(photo.id);
    assert(text(photo.name) && !/[\\/]/.test(photo.name), `${label}: original filename is required.`);
    assert(!('alt' in photo), `${label}: the description field has been removed.`);
    assert(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0, `${label}: invalid image dimensions.`);
    if (photo.date !== undefined) assert(captureTime(photo.date), `${label}: invalid capture time.`);
    for (const field of ['focalLength', 'aperture', 'exposureTime', 'iso']) {
      if (photo[field] !== undefined) assert(typeof photo[field] === 'number' && Number.isFinite(photo[field]) && photo[field] > 0 && (field !== 'iso' || Number.isInteger(photo[field])), `${label}: invalid ${field}.`);
    }
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
  assert(Array.isArray(pets), 'Pets must be an array.');
  const petIds = new Set();
  for (const pet of pets) {
    assert(pet && text(pet.id) && /^[a-z0-9-]+$/.test(pet.id) && !petIds.has(pet.id) && text(pet.name), 'Invalid or duplicate pet.');
    petIds.add(pet.id);
    assert(Number.isInteger(pet.width) && pet.width > 0 && Number.isInteger(pet.height) && pet.height > 0, `Pet ${pet.id}: invalid dimensions.`);
    if (pet.framing !== undefined) {
      const f = pet.framing;
      assert(f && [240, 360].includes(f.referenceWidth) && f.referenceHeight === f.referenceWidth * 4 / 3,
        `Pet ${pet.id}: invalid reference canvas.`);
      assert(Number.isFinite(f.footY) && f.footY > 0 && f.footY <= pet.height
        && Number.isFinite(f.anchorX) && f.anchorX >= 0 && f.anchorX <= pet.width, `Pet ${pet.id}: invalid paw or horizontal anchor.`);
      const c = f.crop;
      assert(c && [c.left, c.top, c.width, c.height].every(Number.isInteger)
        && c.left >= 0 && c.top >= 0 && c.width === pet.width && c.height === pet.height
        && c.left + c.width <= f.referenceWidth && c.top + c.height <= f.referenceHeight, `Pet ${pet.id}: invalid fixed crop.`);
    }
    if (pet.idleRange !== undefined) {
      const r = pet.idleRange;
      assert(r && [r.first, r.last, r.sourceFrames, r.loopBlendFrames].every(Number.isInteger)
        && r.first >= 0 && r.last > r.first && r.last < r.sourceFrames && r.loopBlendFrames >= 0 && r.loopBlendFrames <= 4
        && r.last - r.first + 1 + r.loopBlendFrames === Math.round(pet.clips?.idle?.durationMs * 24 / 1000), `Pet ${pet.id}: invalid retained idle frame range.`);
    }
    assert(mediaUrl(pet.poster, 'pets') && pet.poster.endsWith('.webp'), `Pet ${pet.id}: invalid poster.`); unique(pet.poster);
    for (const action of ['idle', 'tilt', 'lick', 'yawn']) {
      const clip = pet.clips?.[action];
      assert(clip && Number.isFinite(clip.durationMs) && clip.durationMs > 0, `Pet ${pet.id}: missing ${action} timing.`);
      assert(Number.isInteger(clip.width) && clip.width > 0 && Number.isInteger(clip.height) && clip.height > 0
        && clip.fps === 24 && Number.isInteger(clip.frames) && clip.frames > 0
        && Math.abs(clip.durationMs - clip.frames * 1000 / clip.fps) <= 1, `Pet ${pet.id}: invalid ${action} frame geometry or timing.`);
      const f = clip.framing, l = clip.layout;
      assert(f && f.referenceWidth === 360 && f.referenceHeight === 480
        && Number.isFinite(f.anchorX) && f.anchorX >= 0 && f.anchorX <= clip.width
        && Number.isFinite(f.footY) && f.footY > 0 && f.footY <= clip.height, `Pet ${pet.id}: invalid ${action} anchors.`);
      const c = f.crop;
      assert(c && [c.left, c.top, c.width, c.height].every(Number.isInteger)
        && c.left >= 0 && c.top >= 0 && c.width === clip.width && c.height === clip.height
        && c.left + c.width <= 360 && c.top + c.height <= 480, `Pet ${pet.id}: invalid ${action} crop.`);
      assert(l && l.width === clip.width && l.height === clip.height
        && Math.abs(l.left + f.anchorX - 180) < .01 && Math.abs(l.top + f.footY - 455) < .01
        && l.left >= 0 && l.top >= 0 && l.left + l.width <= 360 && l.top + l.height <= 480,
        `Pet ${pet.id}: ${action} must fit the common canvas and paw baseline.`);
      for (const [format, suffix] of [['webm', '.webm'], ['hevc', '.mov']]) {
        assert(mediaUrl(clip[format], 'pets') && clip[format].endsWith(suffix), `Pet ${pet.id}: invalid ${action} ${format}.`);
        unique(clip[format]);
      }
    }
    if (pet.seams !== undefined) {
      const seams = pet.seams;
      assert(seams && seams.fps === 24 && Number.isFinite(seams.blendMs) && seams.blendMs > 0 && seams.blendMs <= 200, `Pet ${pet.id}: invalid seam settings.`);
      const idleFrames = Math.round(pet.clips.idle.durationMs * seams.fps / 1000);
      for (const action of ['tilt', 'lick', 'yawn']) {
        const plan = seams.actions?.[action];
        assert(plan && Array.isArray(plan.startWaitFrames) && plan.startWaitFrames.length === idleFrames
          && plan.startWaitFrames.every(wait => Number.isInteger(wait) && wait >= 0 && wait <= 4), `Pet ${pet.id}: invalid ${action} entry plan.`);
        assert(Number.isFinite(plan.returnIdleMs) && plan.returnIdleMs >= 0 && plan.returnIdleMs < pet.clips.idle.durationMs - 50, `Pet ${pet.id}: invalid ${action} return frame.`);
      }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const albums = JSON.parse(await readFile(process.argv[2] || 'src/data/albums.json', 'utf8'));
  const photos = JSON.parse(await readFile(process.argv[3] || 'src/data/photos.json', 'utf8'));
  const groups = JSON.parse(await readFile(process.argv[4] || 'src/data/photo-groups.json', 'utf8'));
  const pets = JSON.parse(await readFile(process.argv[5] || 'src/data/pets.json', 'utf8'));
  validate(albums, photos, groups, pets);
  process.stdout.write(`Validated ${albums.length} albums, ${photos.length} photos, ${groups.length} exhibition groups and ${pets.length} about-page cats.\n`);
}
