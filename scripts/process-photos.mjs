#!/usr/bin/env node

/**
 * process-photos — RAW → 大图 JPEG + 缩略图 WebP
 *
 * 用法:
 *   pnpm process-photos <RAW目录> [输出目录]
 *
 * 前置依赖:
 *   sudo pacman -S perl-image-exiftool
 *
 * 输入: 相机 RAW 文件（6192×4128 或 4128×6192）
 * 输出:
 *   <输出目录>/originals/  — JPEG, 长边 2000px, 质量 85
 *   <输出目录>/thumbs/     — WebP, 长边 480px,  质量 80
 */

import { readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";

// ── 配置 ──────────────────────────────────────────────────

const FULL_WIDTH = 2000;
const FULL_QUALITY = 85;
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 80;

// 支持的 RAW 后缀
const RAW_EXTS = new Set([
  ".cr2", ".cr3", ".nef", ".arw", ".dng", ".orf",
  ".rw2", ".raf", ".pef", ".srw", ".3fr", ".erf",
  ".mef", ".mos", ".nrw", ".ptx", ".r3d", ".raw",
]);

// ── 参数 ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const inputDir = args[0];
const outputDir = args[1] || join(inputDir, "..", "processed");

if (!inputDir) {
  console.error("用法: pnpm process-photos <RAW目录> [输出目录]");
  process.exit(1);
}
if (!existsSync(inputDir)) {
  console.error(`目录不存在: ${inputDir}`);
  process.exit(1);
}

// 检查 exiftool 是否可用
try {
  execSync("command -v exiftool", { stdio: "pipe" });
} catch {
  console.error("未找到 exiftool。请先安装: sudo pacman -S perl-image-exiftool");
  process.exit(1);
}

// ── 收集文件 ──────────────────────────────────────────────

const files = await readdir(inputDir);
const rawFiles = files.filter((f) => RAW_EXTS.has(extname(f).toLowerCase()));

if (rawFiles.length === 0) {
  console.log("未找到 RAW 文件。支持的格式:");
  console.log(`  ${[...RAW_EXTS].join(" ")}`);
  process.exit(0);
}

// ── 输出目录 ──────────────────────────────────────────────

const originalsDir = join(outputDir, "originals");
const thumbsDir = join(outputDir, "thumbs");
await mkdir(originalsDir, { recursive: true });
await mkdir(thumbsDir, { recursive: true });

// ── 处理 ──────────────────────────────────────────────────

console.log(`\n处理 ${rawFiles.length} 个 RAW 文件\n`);

let ok = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < rawFiles.length; i++) {
  const file = rawFiles[i];
  const inputPath = join(inputDir, file);
  const name = basename(file, extname(file));
  const fullOut = join(originalsDir, `${name}.jpg`);
  const thumbOut = join(thumbsDir, `${name}.webp`);
  const pct = `[${i + 1}/${rawFiles.length}]`;

  // 如果两个产物都已存在则跳过
  if (existsSync(fullOut) && existsSync(thumbOut)) {
    console.log(`${pct} ${file} → 已存在，跳过`);
    skipped++;
    continue;
  }

  process.stdout.write(`${pct} ${file} → extract JPEG ... `);

  let jpgBuf = null;
  try {
    // ── 1. 从 RAW 提取相机内嵌的全分辨率 JPEG ────
    //    尝试多个标签，取最大的（通常是 JpgFromRaw > PreviewImage > ThumbnailImage）
    const tags = ["JpgFromRaw", "PreviewImage", "ThumbnailImage"];
    for (const tag of tags) {
      try {
        const buf = execSync(`exiftool -b -${tag} "${inputPath}"`, { maxBuffer: 50 * 1024 * 1024 });
        if (buf && buf.length > (jpgBuf ? jpgBuf.length : 1000)) {
          jpgBuf = buf;
        }
      } catch {
        // 忽略
      }
    }
    if (!jpgBuf || jpgBuf.length < 1000) {
      throw new Error("RAW 文件中未找到内嵌 JPEG，请确认文件完整");
    }

    // ── 2. JPEG → 大图 + 缩略图 ──────────────────
    process.stdout.write("resize ... ");

    if (!existsSync(fullOut)) {
      await sharp(jpgBuf)
        .resize({
          width: FULL_WIDTH,
          height: FULL_WIDTH,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: FULL_QUALITY, mozjpeg: true })
        .toFile(fullOut);

      // ── 3. 复制 RAW 的 EXIF 到大图 ──────────────
      execSync(
        `exiftool -tagsfromfile "${inputPath}" -all:all -overwrite_original "${fullOut}"`,
        { stdio: "pipe" }
      );
    }

    if (!existsSync(thumbOut)) {
      await sharp(jpgBuf)
        .resize({
          width: THUMB_WIDTH,
          height: THUMB_WIDTH,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbOut);
    }

    console.log("✓");
    ok++;
  } catch (err) {
    console.log(`✗\n    错误: ${err.message}`);
    failed++;
  }
}

// ── 汇总 ──────────────────────────────────────────────────

const jpgs = rawFiles.map((f) => basename(f, extname(f)) + ".jpg");
const webps = rawFiles.map((f) => basename(f, extname(f)) + ".webp");

console.log(`\n─── 完成 ───`);
console.log(`  处理:   ${ok} 张`);
if (skipped > 0) console.log(`  跳过:   ${skipped} 张（已存在）`);
if (failed > 0) console.log(`  失败:   ${failed} 张`);

console.log(`\n输出:`);
console.log(`  大图:   ${originalsDir}/`);
console.log(`  缩略图: ${thumbsDir}/`);

if (ok > 0) {
  console.log(`\n下一步:`);
  console.log(`  1. 编辑 src/data/photos.ts，参考以下模板:`);
  console.log(`\n     import { definePhoto } from "./photos";`);
  for (const j of jpgs) {
    console.log(`     definePhoto("${j}"),`);
  }
  console.log(`\n  2. 上传 R2:`);
  console.log(`     cd ${outputDir}`);
  console.log(`     for f in originals/*.jpg; do`);
  console.log(`       wrangler r2 object put "doebkweb/photos/\$f" --file="\$f" --remote`);
  console.log(`     done`);
  console.log(`     for f in thumbs/*.webp; do`);
  console.log(`       wrangler r2 object put "doebkweb/photos/\$f" --file="\$f" --remote`);
  console.log(`     done`);
}
