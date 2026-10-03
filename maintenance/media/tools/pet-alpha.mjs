// Calibrated blue-screen cutouts can contain translucent blocks inside white fur.
// Restore only the solid interior; keep the original feathered outline and gaps.
export function repairPetAlpha(rgba, width, height) {
  const radius = Math.max(4, Math.round(width / 90));
  const distance = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (rgba[i * 4 + 3] <= 8) continue;
      distance[i] = Math.min(radius, x ? distance[i - 1] + 1 : 1,
        y ? distance[i - width] + 1 : 1);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!distance[i]) continue;
      distance[i] = Math.min(distance[i], x + 1 < width ? distance[i + 1] + 1 : 1,
        y + 1 < height ? distance[i + width] + 1 : 1);
    }
  }
  const edge = Math.max(1, Math.round(radius / 4));
  for (let i = 0; i < distance.length; i++) {
    if (distance[i] <= edge) continue;
    const t = (distance[i] - edge) / (radius - edge);
    const weight = t * t * (3 - 2 * t);
    const alphaIndex = i * 4 + 3;
    rgba[alphaIndex] = Math.round(rgba[alphaIndex] + (255 - rgba[alphaIndex]) * weight);
  }
  return rgba;
}

// Blend premultiplied colors so transparent outlines do not acquire dark halos.
export function blendPetFrames(from, to, amount) {
  if (from.length !== to.length) throw Error('Pet frame dimensions must match');
  const result = Buffer.alloc(from.length);
  for (let i = 0; i < from.length; i += 4) {
    const a = from[i + 3] / 255 * (1 - amount), b = to[i + 3] / 255 * amount;
    const alpha = a + b;
    for (let channel = 0; channel < 3; channel++) result[i + channel] = alpha ? Math.round((from[i + channel] * a + to[i + channel] * b) / alpha) : 0;
    result[i + 3] = Math.round(alpha * 255);
  }
  return result;
}
