import sharp from 'sharp';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { repairPetAlpha } from './pet-alpha.mjs';

const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' } } });
if (!values.input || !values.output) throw Error('Usage: node analyze-pet-seams.mjs --input <one cat master directory> --output <local report.json>');
const width = 120, height = 160;
const labels = { idle: '待机', tilt: '歪头', lick: '舔爪', yawn: '打哈欠' };
const clips = {};
for (const [name, label] of Object.entries(labels)) {
  const directory = path.join(values.input, label);
  const timeline = JSON.parse(await readFile(path.join(directory, 'timeline.json'), 'utf8'));
  const frames = [];
  for (const frame of timeline) {
    const { data, info } = await sharp(path.join(directory, frame.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    repairPetAlpha(data, info.width, info.height);
    const rgba = await sharp(data, { raw: info }).resize(width, height).raw().toBuffer();
    const features = new Float32Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const a = rgba[i * 4 + 3] / 255;
      features[i * 4] = a;
      features[i * 4 + 1] = a * (rgba[i * 4] * 0.2126 + rgba[i * 4 + 1] * 0.7152 + rgba[i * 4 + 2] * 0.0722) / 255;
    }
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      features[i * 4 + 2] = (features[(i + 1) * 4 + 1] - features[(i - 1) * 4 + 1]) / 2;
      features[i * 4 + 3] = (features[(i + width) * 4 + 1] - features[(i - width) * 4 + 1]) / 2;
    }
    frames.push(features);
  }
  clips[name] = { frames, timeline };
}

function difference(a, b) {
  let total = 0, weights = 0;
  for (let i = 0; i < width * height; i++) {
    if (Math.max(a[i * 4], b[i * 4]) < 0.1) continue;
    const w = i < width * Math.round(height * 0.35) ? 8 : 1; // Head pose matters more than the stationary torso.
    total += w * (0.2 * Math.abs(a[i * 4] - b[i * 4]) + 0.65 * Math.abs(a[i * 4 + 1] - b[i * 4 + 1])
      + 0.075 * Math.abs(a[i * 4 + 2] - b[i * 4 + 2]) + 0.075 * Math.abs(a[i * 4 + 3] - b[i * 4 + 3]));
    weights += w;
  }
  return total / weights;
}
const idle = clips.idle;
const loops = [];
for (let first = 0; first <= 12; first++) for (let last = idle.frames.length - 13; last < idle.frames.length; last++) {
  loops.push({ first, last, score: difference(idle.frames[last], idle.frames[first]),
    trimmedMs: idle.timeline[first].time_ms + idle.timeline.at(-1).time_ms - idle.timeline[last].time_ms });
}
loops.sort((a, b) => (a.score + a.trimmedMs / 1000 * 0.001) - (b.score + b.trimmedMs / 1000 * 0.001));
const chosen = loops[0];
const frames = idle.frames.slice(chosen.first, chosen.last + 1);
const loopBlendFrames = 3;
const tail = frames.at(-1);
for (let index = 1; index <= loopBlendFrames; index++) {
  const amount = (1 - Math.cos(Math.PI * index / loopBlendFrames)) / 2;
  frames.push(Float32Array.from(tail, (value, i) => value * (1 - amount) + frames[0][i] * amount));
}
const actions = {};
for (const name of ['tilt', 'lick', 'yawn']) {
  const action = clips[name];
  const startScores = frames.map(frame => difference(frame, action.frames[0]));
  const endScores = frames.map(frame => difference(frame, action.frames.at(-1)));
  const returnFrame = endScores.indexOf(Math.min(...endScores));
  // Per idle frame, permit at most four frames of waiting; no full-loop delay.
  const startWaitFrames = startScores.map((_, current) => {
    let best = 0;
    for (let wait = 1; wait <= 4 && current + wait < frames.length; wait++) {
      if (startScores[current + wait] + wait * 0.0005 < startScores[current + best] + best * 0.0005) best = wait;
    }
    return best;
  });
  actions[name] = { startWaitFrames, returnIdleMs: Math.round(returnFrame * 1000 / 24) };
  console.log(JSON.stringify({ action: name, bestEntryFrame: startScores.indexOf(Math.min(...startScores)),
    returnFrame, firstFrameReturnScore: endScores[0], matchedReturnScore: endScores[returnFrame],
    entryScoreMin: Math.min(...startScores), entryScoreMax: Math.max(...startScores) }));
}
const originalLoopScore = difference(idle.frames.at(-1), idle.frames[0]);
const report = { comparison: { width, height, sourceFrames: Object.values(clips).reduce((sum, clip) => sum + clip.frames.length, 0),
  originalLoopScore, candidates: loops.slice(0, 6) },
  idleRange: { first: chosen.first, last: chosen.last, loopBlendFrames },
  seams: { fps: 24, blendMs: 125, actions } };
await mkdir(path.dirname(values.output), { recursive: true });
await writeFile(values.output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ originalLoopScore, selectedLoop: chosen, idleFrames: frames.length }));
