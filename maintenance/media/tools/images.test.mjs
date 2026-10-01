import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { orientedImage, largestPreview, captureDate } from './images.mjs';
import { validate } from './validate-media.mjs';
const exec = promisify(execFile);

// The asymmetric 3x2 pattern catches swapped mirror/rotation operations.
for (const [orientation, expected] of [
  [1, [1, 2, 3, 4, 5, 6]], [2, [3, 2, 1, 6, 5, 4]],
  [3, [6, 5, 4, 3, 2, 1]], [4, [4, 5, 6, 1, 2, 3]],
  [5, [1, 4, 2, 5, 3, 6]], [6, [4, 1, 5, 2, 6, 3]],
  [7, [6, 3, 5, 2, 4, 1]], [8, [3, 6, 2, 5, 1, 4]],
]) {
  test(`EXIF orientation ${orientation}`, async () => {
    const pixels = Buffer.from([1, 2, 3, 4, 5, 6].flatMap(value => [value * 30, 0, 0]));
    const png = await sharp(pixels, { raw: { width: 3, height: 2, channels: 3 } }).png().toBuffer();
    const { data, info } = await orientedImage(png, orientation).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([...data].filter((_, index) => index % info.channels === 0), expected.map(value => value * 30));
    assert.equal(info.width, orientation > 4 ? 2 : 3);
  });
}

test('RAW preview selection rejects thumbnails and corrupt bytes, and picks the largest JPEG', async () => {
  const small = await sharp({ create: { width: 200, height: 100, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const large = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: 'blue' } }).jpeg().toBuffer();
  assert.equal((await largestPreview([{ tag: 'bad', bytes: Buffer.from('invalid') }, { tag: 'small', bytes: small }, { tag: 'large', bytes: large }])).tag, 'large');
  await assert.rejects(largestPreview([{ bytes: small }]), /No embedded JPEG/);
  assert.equal(captureDate({ DateTimeOriginal: '2026:09:29 23:59:59', OffsetTimeOriginal: '+09:00' }), '2026-09-29');
  assert.equal(captureDate({}), null);
});

test('invalid or duplicate public records are rejected', () => {
  const album = { id: 'test-album', name: 'Test', artist: 'Artist', cover: 'https://cdn.doebkblcya.com/albums/test/v1/cover.jpg', review: '' };
  const photo = { src: 'https://cdn.doebkblcya.com/photos/test/large.jpg', thumb: 'https://cdn.doebkblcya.com/photos/test/preview.webp', alt: 'A river', width: 800, height: 1200, date: '2026-09-29' };
  validate([album], [photo]);
  assert.throws(() => validate([album, album], []), /duplicate id/);
  assert.throws(() => validate([{ ...album, id: undefined }], []), /id/);
  assert.throws(() => validate([{ ...album, released: 2026 }], []), /release/);
  assert.throws(() => validate([], [photo, photo]), /Duplicate image/);
  assert.throws(() => validate([], [{ ...photo, date: '2026-02-30' }]), /capture date/);
  assert.throws(() => validate([], [{ ...photo, alt: '' }]), /alt text/);
  assert.throws(() => validate([{ ...album, tracks: [] }], []), /playback/);
  assert.throws(() => validate([{ ...album, cover: 'https://external.example/cover.jpg' }], []), /R2 cover/);
});

test('preparation preserves originals, corrects orientation, strips metadata and emits safe drafts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'doebk-images-'));
  try {
    const input = path.join(root, 'input'), output = path.join(root, 'output');
    await mkdir(input);
    const original = path.join(input, 'camera.jpg');
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: 'green' } }).jpeg().toFile(original);
    await exec('exiftool', ['-overwrite_original', '-Orientation#=6', '-DateTimeOriginal=2026:09:29 23:59:59', '-GPSLatitude=31', '-GPSLongitude=121', original]);
    const before = createHash('sha256').update(await readFile(original)).digest('hex');
    const png = path.join(input, 'second.png');
    await sharp({ create: { width: 300, height: 200, channels: 3, background: 'blue' } }).png().toFile(png);
    const originalPng = await readFile(png);
    const request = path.join(root, 'request.json');
    await writeFile(request, JSON.stringify({ batch: 'test-v1', input, output, annotations: { 'camera.jpg': { alt: 'Test image' }, 'second.png': { alt: 'PNG image', date: '2026-09-30' } } }));
    await exec(process.execPath, ['maintenance/media/tools/prepare-photos.mjs', request]);
    const draft = JSON.parse(await readFile(path.join(output, 'photos.draft.json'), 'utf8'));
    assert.equal(draft[0].width, 800); assert.equal(draft[0].height, 1200); assert.equal(draft[0].date, '2026-09-29');
    validate([], draft);
    assert.equal(draft.length, 2);
    assert.equal(draft[1].width, 300); assert.equal(draft[1].height, 200);
    assert.deepEqual(await readFile(png), originalPng);
    for (const file of ['001-large.jpg', '001-preview.webp']) {
      const info = await sharp(path.join(output, file)).metadata();
      assert.equal(info.orientation, undefined); assert.equal(info.exif, undefined);
      assert.equal(info.space, 'srgb'); assert.ok(info.height > info.width);
    }
    assert.equal(createHash('sha256').update(await readFile(original)).digest('hex'), before);
    await assert.rejects(exec(process.execPath, ['maintenance/media/tools/prepare-photos.mjs', request]), /EEXIST/);
    await writeFile(request, JSON.stringify({ batch: 'test-v2', input, output: path.join(input, 'nested') }));
    await assert.rejects(exec(process.execPath, ['maintenance/media/tools/prepare-photos.mjs', request]), /must be separate/);
    const coverRequest = path.join(root, 'cover-request.json');
    const coverOutput = path.join(root, 'cover');
    await writeFile(coverRequest, JSON.stringify({ id: 'test-cover', version: 'v1', input: original, output: coverOutput }));
    await exec(process.execPath, ['maintenance/media/tools/prepare-cover.mjs', coverRequest]);
    const cover = await sharp(path.join(coverOutput, 'cover.jpg')).metadata();
    assert.equal(cover.width, 667); assert.equal(cover.height, 1000); assert.equal(cover.exif, undefined);
    const coverPreview = await sharp(path.join(coverOutput, 'preview.webp')).metadata();
    assert.equal(coverPreview.width, 240); assert.equal(coverPreview.height, 360);
    const coverDraft = JSON.parse(await readFile(path.join(coverOutput, 'cover.draft.json'), 'utf8'));
    assert.match(coverDraft.thumb, /\/albums\/test-cover\/v1\/preview\.webp$/);
    assert.equal(JSON.parse(await readFile(path.join(coverOutput, 'uploads.json'), 'utf8')).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
