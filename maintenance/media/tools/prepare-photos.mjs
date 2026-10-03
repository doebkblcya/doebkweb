// AI-invoked image preparation only. No uploads and no changes to published records.
import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sourceImage, derivative, captureTime, captureSettings, slug, isRaw, isRasterPhoto } from './images.mjs';

const configPath = process.argv[2];
if (!configPath) throw new Error('Pass the path to a photo request JSON. See maintenance/media/photos.md.');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const batch = slug(config.batch, 'batch');
const input = path.resolve(config.input || 'materials/inbox/photos');
const output = path.resolve(config.output || `materials/processed/${batch}`);
if (output === input || output.startsWith(`${input}${path.sep}`) || input.startsWith(`${output}${path.sep}`)) throw new Error('Input and output directories must be separate.');
const files = (await readdir(input, { withFileTypes: true })).filter(entry => !entry.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
if (!files.length) throw new Error('The input batch is empty.');
for (const entry of files) if (!entry.isFile() || !(isRaw(entry.name) || isRasterPhoto(entry.name))) throw new Error(`Input must contain only this batch of RAW/JPEG/PNG photos: ${entry.name}`);
// A fresh output directory prevents a failed rerun from mixing old and new manifests.
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const records = [], uploads = [];
for (const [index, entry] of files.entries()) {
  const file = path.join(input, entry.name);
  const source = await sourceImage(file, config.minimumRawEdge ?? 1600);
  const annotations = config.annotations?.[entry.name] || {};
  const date = annotations.date || captureTime(source.exif);
  const settings = captureSettings(source.exif);
  if (date && !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/.test(date)) throw new Error(`Invalid capture time for ${entry.name}.`);
  const stem = String(index + 1).padStart(3, '0');
  const largeFormat = config.preserveTransparency ? 'webp' : 'jpeg';
  const largeExtension = largeFormat === 'webp' ? 'webp' : 'jpg';
  const large = path.join(output, `${stem}-large.${largeExtension}`), thumb = path.join(output, `${stem}-preview.webp`);
  const dimensions = await derivative(source, large, { edge: config.largeEdge ?? 2400, quality: config.largeQuality ?? 88, format: largeFormat });
  const preview = await derivative(source, thumb, { edge: config.previewEdge ?? 960, quality: config.previewQuality ?? 80, format: 'webp' });
  const key = `photos/${batch}`;
  const base = 'https://cdn.doebkblcya.com';
  records.push({ id: `${batch}-${stem}`, name: annotations.name || entry.name, src: `${base}/${key}/${stem}-large.${largeExtension}`, thumb: `${base}/${key}/${stem}-preview.webp`, width: dimensions.width, height: dimensions.height, ...(date ? { date } : {}), ...settings, ...(annotations.note ? { note: annotations.note } : {}) });
  uploads.push({ source: entry.name, key: `${key}/${stem}-large.${largeExtension}`, file: large, contentType: `image/${largeFormat}`, size: dimensions.size }, { source: entry.name, key: `${key}/${stem}-preview.webp`, file: thumb, contentType: 'image/webp', size: preview.size });
  process.stdout.write(`Prepared ${entry.name}${source.tag ? ` (${source.tag})` : ''}\n`);
}
await writeFile(path.join(output, 'photos.draft.json'), JSON.stringify(records, null, 2) + '\n');
await writeFile(path.join(output, 'uploads.json'), JSON.stringify(uploads, null, 2) + '\n');
process.stdout.write(`Review filenames, capture times, exposure settings and prepared files before uploading: ${output}\n`);
