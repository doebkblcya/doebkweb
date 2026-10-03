import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { repairPetAlpha, blendPetFrames } from './pet-alpha.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' }, version: { type: 'string' },
  width: { type: 'string', default: '360' },
  cat: { type: 'string' }, analysis: { type: 'string' },
  'idle-only': { type: 'boolean', default: false },
  'crop-idle': { type: 'boolean', default: false },
} });
if (!values.input || !values.output || !/^[a-z0-9-]+$/.test(values.version ?? '')) {
  throw new Error('Usage: FFMPEG_BINARY=... node prepare-pets.mjs --input <calibrated masters> --output <local directory> --version <unique version> [--width 360]');
}
const width = Number(values.width), height = width * 4 / 3;
if (![240, 360].includes(width)) throw new Error('Width must be 240 or 360');
const ffmpeg = process.env.FFMPEG_BINARY || 'ffmpeg';
const hevcEncoder = process.env.PET_HEVC_ENCODER;
if (!hevcEncoder) throw new Error('Compile export-pet-hevc.swift on macOS and set PET_HEVC_ENCODER to its executable');
const input = path.resolve(values.input), output = path.resolve(values.output);
const cats = [['xiaolang', '小狼'], ['xiaoxiaolang', '小小狼'], ['xiaoshu', '小薯']];
if (values.cat && !cats.some(([id]) => id === values.cat)) throw Error('Unknown cat');
if (values.analysis && !values.cat) throw Error('A seam report requires --cat');
if (values['crop-idle'] && !values['idle-only']) throw Error('Crop mode requires --idle-only; dimensions describe idle and poster');
const analysis = values.analysis ? JSON.parse(await readFile(values.analysis, 'utf8')) : undefined;
const calibration = values['crop-idle'] ? JSON.parse(await readFile(path.join(input, 'calibration.json'), 'utf8')) : undefined;
const actions = [['idle', '待机'], ['tilt', '歪头'], ['lick', '舔爪'], ['yawn', '打哈欠']];
const uploads = [], pets = [];
const base = `pets/${values.version}`;
const ff = args => run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', ...args], { maxBuffer: 2 ** 20 });
for (const [id, name] of cats) {
  if (values.cat && id !== values.cat) continue;
  const pet = { id, name, width, height, poster: '', clips: {} };
  if (analysis) pet.seams = analysis.seams;
  for (const [action, label] of actions) {
    if (values['idle-only'] && action !== 'idle') continue;
    const source = path.join(input, name, label);
    let timeline = JSON.parse(await readFile(path.join(source, 'timeline.json'), 'utf8'));
    const sourceFrames = timeline.length;
    if (analysis && action === 'idle') {
      const { first, last } = analysis.idleRange;
      if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last >= timeline.length || last <= first) throw Error('Invalid idle seam range');
      timeline = timeline.slice(first, last + 1);
      pet.idleRange = { ...analysis.idleRange, sourceFrames };
    }
    const dir = path.join(output, id);
    await mkdir(dir, { recursive: true });
    const framesDir = path.join(dir, `${action}-frames`);
    await mkdir(framesDir);
    const concat = ['ffconcat version 1.0'];
    let firstFrame, lastFrame, frameInfo;
    const bounds = { left: Infinity, top: Infinity, right: 0, bottom: 0 };
    const feet = [];
    for (const [index, frame] of timeline.entries()) {
      const { data, info } = await sharp(path.join(source, frame.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      repairPetAlpha(data, info.width, info.height);
      if (values['crop-idle']) {
        if (info.width !== 720 || info.height !== 960) throw Error('Crop mode expects the 720×960 calibrated masters');
        const target = calibration.targets[name];
        const halfChest = target.reference.chest_width * target.shared_safety_scale * .4;
        const lo = Math.max(0, Math.floor(target.center_x - halfChest));
        const hi = Math.min(info.width, Math.ceil(target.center_x + halfChest));
        let foot = 0;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const alpha = data[(y * info.width + x) * 4 + 3];
          if (!alpha) continue;
          bounds.left = Math.min(bounds.left, x); bounds.top = Math.min(bounds.top, y);
          bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1);
          if (index < 5 && x >= lo && x < hi && alpha > 128) foot = Math.max(foot, y + 1);
        }
        if (index < 5) { if (!foot) throw Error('Could not measure front-paw baseline'); feet.push(foot); }
      }
      if (index === 0) firstFrame = Buffer.from(data);
      if (index === timeline.length - 1) { lastFrame = Buffer.from(data); frameInfo = info; }
      const filename = `${String(index).padStart(5, '0')}.png`;
      await sharp(data, { raw: info }).png({ compressionLevel: 1 }).toFile(path.join(framesDir, filename));
      if (!Number.isFinite(frame.duration_ms) || frame.duration_ms <= 0) throw new Error('Invalid frame duration');
      concat.push(`file '${filename}'`, 'option framerate 24', `duration ${(frame.duration_ms / 1000).toFixed(9)}`);
    }
    const extra = analysis && action === 'idle' ? analysis.idleRange.loopBlendFrames : 0;
    if (!Number.isInteger(extra) || extra < 0 || extra > 4) throw Error('Invalid loop blend length');
    for (let index = 1; index <= extra; index++) {
      const filename = `${String(timeline.length + index - 1).padStart(5, '0')}.png`;
      const amount = (1 - Math.cos(Math.PI * index / extra)) / 2;
      await sharp(blendPetFrames(lastFrame, firstFrame, amount), { raw: frameInfo }).png({ compressionLevel: 1 }).toFile(path.join(framesDir, filename));
      concat.push(`file '${filename}'`, 'option framerate 24', `duration ${(1 / 24).toFixed(9)}`);
    }
    // Concat demuxer needs a final file entry to honor the last frame's duration.
    concat.push(`file '${String(timeline.length + extra - 1).padStart(5, '0')}.png'`, 'option framerate 24');
    const durationMs = timeline.reduce((sum, frame) => sum + frame.duration_ms, 0) + extra * 1000 / 24;
    const concatFile = path.join(framesDir, 'frames.ffconcat');
    await writeFile(concatFile, concat.join('\n') + '\n');
    const args = ['-safe', '0', '-f', 'concat', '-i', concatFile, '-an', '-t', (durationMs / 1000).toFixed(9)];
    let crop;
    if (values['crop-idle']) {
      // One rectangle for the entire retained loop; preserve every nonzero alpha pixel.
      // Four source pixels leave two pixels at 360px, including feathered fur.
      const left = Math.max(0, Math.floor((bounds.left - 4) / 4) * 4);
      const top = Math.max(0, Math.floor((bounds.top - 4) / 4) * 4);
      const right = Math.min(720, Math.ceil((bounds.right + 4) / 4) * 4);
      const bottom = Math.min(960, Math.ceil((bounds.bottom + 4) / 4) * 4);
      // Encoder dimensions must be even. 240px uses a divisor of three.
      const unit = width === 240 ? 6 : 4;
      const x = Math.floor(left / unit) * unit, y = Math.floor(top / unit) * unit;
      const endX = Math.min(720, Math.ceil(right / unit) * unit), endY = Math.min(960, Math.ceil(bottom / unit) * unit);
      const scale = width / 720;
      crop = { left: x * scale, top: y * scale, width: (endX - x) * scale, height: (endY - y) * scale };
      pet.width = crop.width; pet.height = crop.height;
      feet.sort((a, b) => a - b);
      pet.framing = { referenceWidth: width, referenceHeight: height,
        anchorX: width / 2 - crop.left, footY: feet[Math.floor(feet.length / 2)] * scale - crop.top,
        crop: { ...crop } };
      console.log(`${name} retained ${timeline.length + extra} frames; crop ${pet.width}×${pet.height}; paw baseline ${pet.framing.footY}`);
    }
    const filter = `scale=${width}:${height}:flags=lanczos${crop ? `,crop=${crop.width}:${crop.height}:${crop.left}:${crop.top}` : ''},fps=24`;
    const webm = path.join(dir, `${action}.webm`), hevc = path.join(dir, `${action}.mov`);
    await ff([...args, '-vf', filter,
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '34',
      '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', webm]);
    const intermediate = path.join(dir, `${action}-prores.mov`);
    await ff([...args, '-vf', filter,
      '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', intermediate]);
    await run(hevcEncoder, [intermediate, hevc]);
    await rm(intermediate);
    const clip = { durationMs: Math.round(durationMs) };
    for (const [format, file, contentType] of [['webm', webm, 'video/webm'], ['hevc', hevc, 'video/quicktime']]) {
      const key = `${base}/${id}/${path.basename(file)}`;
      const size = (await stat(file)).size;
      uploads.push({ key, file, contentType, size });
      clip[format] = `https://cdn.doebkblcya.com/${key}`;
      console.log(`${name} ${label} ${format}: ${size} bytes`);
    }
    pet.clips[action] = clip;
    if (action === 'idle') {
      const file = path.join(dir, 'poster.webp');
      let poster = sharp(path.join(framesDir, '00000.png')).resize(width, height);
      if (crop) poster = poster.extract(crop);
      await poster.webp({ quality: 88 }).toFile(file);
      const key = `${base}/${id}/poster.webp`;
      uploads.push({ key, file, contentType: 'image/webp', size: (await stat(file)).size });
      pet.poster = `https://cdn.doebkblcya.com/${key}`;
    }
    await rm(framesDir, { recursive: true });
  }
  pets.push(pet);
}
await writeFile(path.join(output, 'uploads.json'), JSON.stringify(uploads, null, 2) + '\n');
await writeFile(path.join(output, 'pets-draft.json'), JSON.stringify(pets, null, 2) + '\n');
