import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const exec = promisify(execFile);
const rawExtensions = new Set(['.raw', '.nef', '.nrw', '.arw', '.cr2', '.cr3', '.dng', '.raf', '.rw2', '.orf', '.pef', '.srw']);
export const isRaw = file => rawExtensions.has(path.extname(file).toLowerCase());
export const isJpeg = file => ['.jpg', '.jpeg'].includes(path.extname(file).toLowerCase());
export const isRasterPhoto = file => isJpeg(file) || path.extname(file).toLowerCase() === '.png';

export async function metadata(file) {
  const { stdout } = await exec('exiftool', ['-json', '-n', '-Orientation', '-DateTimeOriginal', '-OffsetTimeOriginal', '-FocalLength', '-FNumber', '-ExposureTime', '-ISO', file], { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout)[0];
}

export function captureDate(exif, fallback) {
  // Keep the camera's calendar day; never reinterpret it in the build machine's timezone.
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(exif.DateTimeOriginal || '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : fallback || null;
}

export function captureTime(exif) {
  const match = /^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/.exec(exif.DateTimeOriginal || '');
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}${match[4] ? `T${match[4]}:${match[5]}:${match[6]}` : ''}`;
}

// Store physical values, not display strings: millimetres, f-number and seconds.
export function captureSettings(exif) {
  return Object.fromEntries([
    ['focalLength', exif.FocalLength], ['aperture', exif.FNumber],
    ['exposureTime', exif.ExposureTime], ['iso', exif.ISO],
  ].filter(([field, value]) => typeof value === 'number' && Number.isFinite(value)
    && value > 0 && (field !== 'iso' || Number.isInteger(value))));
}

export async function largestPreview(candidates, minimumEdge = 1600) {
  const readable = [];
  for (const candidate of candidates) {
    try {
      const info = await sharp(candidate.bytes).metadata();
      if (info.format === 'jpeg' && info.width && info.height) readable.push({ ...candidate, info });
    } catch { /* A RAW tag may contain no JPEG. Try the next tag. */ }
  }
  readable.sort((a, b) => b.info.width * b.info.height - a.info.width * a.info.height);
  const best = readable[0];
  if (!best || Math.max(best.info.width, best.info.height) < minimumEdge) {
    throw new Error(`No embedded JPEG with a long edge of at least ${minimumEdge}px. Export a JPEG yourself; this workflow does not develop RAW.`);
  }
  return best;
}

export async function sourceImage(file, minimumEdge = 1600) {
  if (isRasterPhoto(file)) return { bytes: await readFile(file), exif: await metadata(file), orientation: undefined };
  if (!isRaw(file)) throw new Error(`Unsupported photo: ${file}`);
  const exif = await metadata(file);
  const candidates = [];
  for (const tag of ['JpgFromRaw', 'PreviewImage', 'OtherImage', 'ThumbnailImage']) {
    try {
      const { stdout } = await exec('exiftool', ['-b', `-${tag}`, file], { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
      if (stdout.length) candidates.push({ bytes: stdout, tag });
    } catch { /* Check other embedded JPEG tags before reporting failure. */ }
  }
  const best = await largestPreview(candidates, minimumEdge);
  return { bytes: best.bytes, exif, orientation: best.info.orientation ?? exif.Orientation, tag: best.tag };
}

export function orientedImage(bytes, orientation) {
  let image = sharp(bytes, { failOn: 'warning' });
  // Explicit RAW orientation is used only when the embedded JPEG has no orientation tag.
  // sharp applies flip/flop before rotation.
  switch (orientation) {
    case 2: return image.flop();
    case 3: return image.rotate(180);
    case 4: return image.flip();
    case 5: return image.flip().rotate(90);
    case 6: return image.rotate(90);
    case 7: return image.flop().rotate(90);
    case 8: return image.rotate(270);
    default: return orientation === 1 ? image : image.autoOrient();
  }
}

export async function derivative(source, destination, { edge, quality, format }) {
  const image = orientedImage(source.bytes, source.orientation).resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb');
  // sharp strips EXIF, GPS and other source metadata by default.
  const info = await (format === 'webp' ? image.webp({ quality }) : image.jpeg({ quality, mozjpeg: true })).toFile(destination);
  return { width: info.width, height: info.height, size: info.size };
}

export function slug(value, field) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`${field} must use lowercase ASCII letters, numbers and hyphens.`);
  return value;
}
