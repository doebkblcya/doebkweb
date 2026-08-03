#!/usr/bin/env node

/**
 * media — 媒体资源管理 CLI
 *
 * 用法:
 *   pnpm media photos <RAW目录> [--no-upload]   RAW → 大图/缩略图 → 上传 → photos.json 条目
 *   pnpm media album <专辑目录> [--no-upload]    读 ID3 → 封面提取压缩 → 上传 → music.json 草稿(新专辑)
 *   pnpm media ncm <文件|目录> [--out <目录>]    ncm → mp3 解密（Node 原生，MIT 注明来源）
 *   pnpm media review                           交互式札记编辑（音乐/摄影）
 *   pnpm media review --music <专辑> [文本]      参数式（空文本 = 清空）
 *   pnpm media review --photo <src|序号> [文本]
 *
 * 环境变量:
 *   CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY  必填（S3 上传凭证）
 *   CLOUDFLARE_ACCOUNT_ID  可选（缺省用项目账号）
 *
 * 约定:
 *   - 所有上传带 immutable 缓存头（内容变 → URL 变）
 *   - 上传走 S3 API（sigv4 签名直连，不走系统代理）；>5MB 文件 multipart 分片并发，
 *     突破单连接 BDP 限制（v4 API 无 multipart 且单连接被 CF 排队）；失败重试 ×2
 *   - 上传后自动 HEAD 验证（200 + cache-control + HIT + content-length）
 */

import { readdir, readFile, writeFile, mkdir, stat, rename, unlink, open } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { join, extname, basename, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createDecipheriv, createHash, createHmac } from "node:crypto";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { parseFile } from "music-metadata";

// ── 配置 ──────────────────────────────────────────────────

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "1207beba12dc5a9e110255877b4d48d9";
const BUCKET = "doebkweb";
const CDN = "https://cdn.doebkblcya.com";
const CACHE = "public, max-age=31536000, immutable";
// perl(exiftool) 在系统未生成对应 locale 时会刷屏警告(LC_CTYPE 为空 + LANG 不存在)
// ——强制 C locale,不影响 exiftool 功能
const EXIFTOOL_ENV = { ...process.env, LC_ALL: "C" };
const CONCURRENCY = 6;

// ── S3 上传(v4 API 不支持 multipart,大文件分片走 S3 签名 API 并发上传) ──
// 凭证:Cloudflare 控制台 R2 → Manage R2 API Tokens → Create API token(对象读+写)
const S3_HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const S3_ENDPOINT = `https://${S3_HOST}`;
const S3_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const PART_SIZE = 5 * 1024 * 1024; // multipart 最小分片 5MB(最后一片可小)

const MUSIC_JSON = new URL("../src/data/music.json", import.meta.url);
const PHOTOS_JSON = new URL("../src/data/photos.json", import.meta.url);
const RAW_EXTS = new Set([".cr2", ".cr3", ".nef", ".arw", ".dng", ".orf", ".rw2", ".raf", ".pef", ".srw", ".3fr", ".erf", ".mef", ".mos", ".nrw", ".ptx", ".r3d", ".raw"]);

const MIME = {
  ".mp3": "audio/mpeg",
  ".lrc": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
};

// ── 工具 ──────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const encKey = (key) => key.split("/").map(encodeURIComponent).join("/");
const log = (...a) => console.log(...a);
const warn = (...a) => console.error("⚠", ...a);

// 上传走 S3 API(sigv4),需要 R2 S3 凭证
function requireS3() {
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.error(
      "错误: 缺少 R2 S3 凭证。请在 Cloudflare 控制台 R2 → Manage R2 API Tokens → Create API token(对象读+写),\n" +
      "并设置环境变量 CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY"
    );
    process.exit(1);
  }
}

async function runConcurrent(items, worker, n = CONCURRENCY) {
  const results = new Array(items.length);
  let i = 0;
  async function next() {
    if (i >= items.length) return;
    const idx = i++;
    results[idx] = await worker(items[idx]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => next()));
  return results;
}

async function confirm(prompt, { quiet = false } = {}) {
  if (quiet) return true;
  const { rl, ask } = createPrompter();
  const ans = (await ask(`${prompt} [y/N] `)).trim();
  rl.close();
  return /^y(es)?$/i.test(ans);
}

// ── 交互工具（line 事件缓冲，兼容管道输入；EOF 时挂起的问题返回空串）──
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pending = [];
  let waiting = null;
  rl.on("line", (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else pending.push(l); });
  rl.on("close", () => { if (waiting) { const w = waiting; waiting = null; w(""); } });
  const ask = (q) => new Promise((res) => {
    process.stdout.write(q);
    if (pending.length) res(pending.shift());
    else waiting = res;
  });
  return { rl, ask };
}

// 选择器：返回 0-based index / "b"（返回上一级）/ "q"（退出）；非法输入循环重问
async function pick(ask, question, count, { allowBack = false } = {}) {
  while (true) {
    const ans = (await ask(question)).trim().toLowerCase();
    if (ans === "q") return "q";
    if (allowBack && ans === "b") return "b";
    const n = parseInt(ans, 10);
    if (Number.isInteger(n) && n >= 1 && n <= count) return n - 1;
    log(`  无效输入，请输入 1-${count}${allowBack ? "、b（返回）" : ""}、q（退出）`);
  }
}

// ── 上传 + 验证 ───────────────────────────────────────────
// 上传走 S3 API(sigv4 签名):v4 API 无 multipart,大文件分片并发才能突破
// 单连接 BDP 限制(~1MB/s);单连接被 CF 排队时并发分片是唯一加速途径

// AWS URI 编码:unreserved 之外全部 %XX(encodeURIComponent 不编码 !'()* 等,S3 要求编码)
function awsUriEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function s3Sign(method, path, query, payloadHash, extraHeaders = {}) {
  // AWS SigV4 签名(R2 region 固定 "auto")
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${awsUriEncode(k)}=${awsUriEncode(query[k])}`)
    .join("&");
  // header 名一律小写(AWS 规范:canonical/signed headers 用小写,Content-Type 原样大写会算错签名)
  const allHeaders = { host: S3_HOST, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, ...extraHeaders };
  const norm = {};
  for (const k of Object.keys(allHeaders)) norm[k.toLowerCase()] = allHeaders[k];
  const signedHeaders = Object.keys(norm).sort().join(";");
  const canonicalHeaders = Object.keys(norm)
    .sort()
    .map((k) => `${k}:${norm[k]}`)
    .join("\n") + "\n";
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const kDate = createHmac("sha256", `AWS4${S3_SECRET_KEY}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update("auto").digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${S3_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
    signedHeaders,
  };
}

// S3 路径:/bucket/key(每段 AWS URI 编码;中文/引号/括号等特殊字符必须编码)
function s3Path(key) {
  return `/${BUCKET}/${key.split("/").map(awsUriEncode).join("/")}`;
}

async function s3Fetch(method, key, query, bodyBuf, extraHeaders = {}) {
  const path = s3Path(key);
  const payloadHash = createHash("sha256").update(bodyBuf || "").digest("hex");
  const sig = s3Sign(method, path, query, payloadHash, extraHeaders);
  const url = `${S3_ENDPOINT}${path}${Object.keys(query).length ? "?" + new URLSearchParams(query) : ""}`;
  return fetch(url, {
    method,
    headers: {
      ...extraHeaders,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": sig.amzDate,
      Authorization: sig.authorization,
    },
    body: bodyBuf || undefined,
  });
}

async function s3UploadOne(key, filePath, mime) {
  // ≤5MB 单 PUT(读入内存 hash 签名)
  const body = await readFile(filePath);
  return s3Fetch("PUT", key, {}, body, { "Content-Type": mime, "Cache-Control": CACHE });
}

async function s3UploadMultipart(key, filePath, size, mime) {
  // Initiate → UploadPart(并发) → Complete;分片 5MB,最后一片剩余
  const initRes = await s3Fetch("POST", key, { uploads: "" }, null, { "Content-Type": mime, "Cache-Control": CACHE });
  if (!initRes.ok) return initRes;
  const initXml = await initRes.text();
  const uploadId = (initXml.match(/<UploadId>([^<]+)<\/UploadId>/) || [])[1];
  if (!uploadId) return { ok: false, status: initRes.status, error: `Initiate 无 uploadId: ${initXml.slice(0, 120)}` };

  const parts = [];
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(PART_SIZE);
    let partNumber = 0;
    while (true) {
      const { bytesRead } = await fh.read(buf, 0, PART_SIZE, partNumber * PART_SIZE);
      if (bytesRead === 0) break;
      partNumber++;
      const chunk = buf.subarray(0, bytesRead);
      const res = await s3Fetch("PUT", key, { partNumber: String(partNumber), uploadId }, chunk);
      if (!res.ok) return { ok: false, status: res.status, error: `UploadPart ${partNumber}: ${(await res.text()).slice(0, 120)}` };
      const etag = (res.headers.get("etag") || "").replace(/"/g, "");
      if (!etag) return { ok: false, status: res.status, error: `UploadPart ${partNumber} 无 etag` };
      parts.push({ partNumber, etag });
    }
  } finally {
    await fh.close();
  }
  // Complete:XML 列出各分片
  const xml = `<CompleteMultipartUpload>${parts
    .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>&quot;${p.etag}&quot;</ETag></Part>`)
    .join("")}</CompleteMultipartUpload>`;
  return s3Fetch("POST", key, { uploadId }, Buffer.from(xml), { "Content-Type": "application/xml" });
}

async function uploadOne(key, filePath, size) {
  const mime = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = size > PART_SIZE
        ? await s3UploadMultipart(key, filePath, size, mime)
        : await s3UploadOne(key, filePath, mime);
      if (res.ok) return { key, ok: true };
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 3) { await sleep(attempt * 1000); continue; }
      }
      return { key, ok: false, status: res.status, error: (await res.text()).slice(0, 200) };
    } catch (e) {
      if (attempt === 3) return { key, ok: false, error: e.message };
      await sleep(attempt * 1000);
    }
  }
}

async function verifyHead(key, expectedSize, expectHits = true) {
  try {
    const url = `${CDN}/${encKey(key)}`;
    // HEAD: 断言 200 + cache-control（R2 自定义域 HEAD 恒 DYNAMIC，不做 HIT 判断）。
    // 注意:undici fetch 默认 Accept-Encoding 使 text/plain 被 CF 压缩(chunked) → HEAD 无 content-length,
    // 长度改从 GET Range 206 的 Content-Range 解析(总大小不受压缩影响)
    const head = await fetch(url, { method: "HEAD" });
    const cc = head.headers.get("cache-control") || "";
    // GET Range ×2: 首次回源，二次应 HIT（.lrc 为 text/plain，不在 Cloudflare 默认缓存扩展名列表，跳过 HIT 断言）
    const g1 = await fetch(url, { headers: { Range: "bytes=0-0" } });
    await sleep(250);
    const g2 = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const hits = expectHits ? g2.headers.get("cf-cache-status") === "HIT" : true;
    // 206 响应的 Content-Range 形如 bytes 0-0/1015,末尾为对象总大小
    const cr = (g1.headers.get("content-range") || "").match(/\/\s*(\d+)$/);
    const len = cr ? cr[1] : null;
    const ok = head.status === 200 && cc.includes("immutable") && String(len) === String(expectedSize) && hits;
    return { key, ok, status: head.status, len, hits, cc: cc ? "✓" : "✗" };
  } catch (e) {
    return { key, ok: false, error: e.message };
  }
}

export async function uploadAndVerify(files) {
  // files: [{ key, path, size }]
  requireS3();
  const t0 = Date.now();
  const totalBytes = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024; // MB
  log(`\n上传 ${files.length} 个文件（并发 ${CONCURRENCY}，S3 直连，>5MB 分片并发）...`);
  const results = await runConcurrent(files, ({ key, path, size }) => uploadOne(key, path, size));
  const failed = results.filter((r) => !r.ok);
  for (const r of failed) warn(`上传失败: ${r.key} ${r.error || r.status}`);
  // 吞吐只按上传阶段计时——验证是网络往返等待(无数据传输),计入分母会把数字稀释
  const uploadMs = Date.now() - t0;

  log(`验证 ${results.filter((r) => r.ok).length} 个已上传对象（HEAD ×2）...`);
  const checks = await runConcurrent(
    results.filter((r) => r.ok).map((r) => ({ key: r.key, size: files.find((f) => f.key === r.key).size })),
    ({ key, size }) => verifyHead(key, size, !/\.lrc$/i.test(key))
  );
  const bad = checks.filter((r) => !r.ok);
  for (const r of checks) {
    if (r.ok) log(`  ✓ ${r.key} (${r.len} bytes, cache ${r.cc}, HIT ${r.hits ? "✓" : "✗"})`);
  }
  for (const r of bad) warn(`验证失败: ${r.key} ${r.error || `status=${r.status} len=${r.len} cc=${r.cc} hit=${r.hits}`}`);

  const verifyMs = Date.now() - t0 - uploadMs;
  const fmt = (ms) => (ms / 1000).toFixed(1);
  if (failed.length || bad.length) {
    warn(`\n${failed.length} 上传失败 + ${bad.length} 验证失败（上传 ${fmt(uploadMs)}s，验证 ${fmt(verifyMs)}s，总耗时 ${fmt(uploadMs + verifyMs)}s）`);
    process.exitCode = 1;
  } else {
    log(`\n全部完成 ✓（上传 ${fmt(uploadMs)}s 吞吐 ${(totalBytes / (uploadMs / 1000)).toFixed(1)} MB/s，验证 ${fmt(verifyMs)}s，总耗时 ${fmt(uploadMs + verifyMs)}s）`);
  }
}

// ── photos: RAW/JPG → 大图/缩略图 → 上传 → photos.json ──────
// RAW → exiftool 提取内嵌 JPEG;JPG → 直接压缩;统一输出 originals/thumbs

const FULL_WIDTH = 2000;
const FULL_QUALITY = 85;
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 80;
const PHOTO_EXTS = new Set([...RAW_EXTS, ".jpg", ".jpeg"]);

// EXIF Orientation → 顺时针旋转角度（sharp .rotate 参数）。
// 相机竖拍:6 = Rotate 90 CW, 8 = Rotate 270 CW;3 = 180°。
// 2/4/5/7 是镜像翻转,仅旋转无法表达,忽略(索尼竖拍只出 6/8)
function exifToAngle(o) {
  if (o === 3) return 180;
  if (o === 6) return 90;
  if (o === 8) return 270;
  return 0;
}

async function cmdPhotos(args) {
  const noUpload = args.includes("--no-upload");
  let inputDir = args.find((a) => !a.startsWith("--"));
  let interactive = false;
  if (!inputDir) {
    // 交互模式：扫描 _r2-upload/photos/ 下含 RAW/JPG 的目录
    interactive = true;
    const base = "_r2-upload/photos";
    const sub = [];
    try {
      for (const d of await readdir(base)) {
        const p = join(base, d);
        try {
          if ((await stat(p)).isDirectory() && (await readdir(p)).some((f) => PHOTO_EXTS.has(extname(f).toLowerCase()))) sub.push(d);
        } catch { /* 忽略 */ }
      }
    } catch { /* 目录不存在 */ }
    if (!sub.length) { warn(`未找到含 RAW/JPG 的目录（扫描 ${base}/）`); return; }
    const { rl, ask } = createPrompter();
    log("选择照片目录:");
    sub.forEach((d, i) => log(`  [${i + 1}] ${base}/${d}`));
    const sel = await pick(ask, `选择 [1-${sub.length}, q 退出]: `, sub.length);
    rl.close();
    if (sel === "q") return;
    inputDir = join(base, sub[sel]);
    log(`\n处理目录: ${inputDir}\n`);
  }
  if (!existsSync(inputDir)) {
    console.error(`目录不存在: ${inputDir}`);
    process.exit(1);
  }
  try {
    execFileSync("exiftool", ["-ver"], { stdio: "pipe", env: EXIFTOOL_ENV });
  } catch {
    console.error("未找到 exiftool。请先安装: sudo pacman -S perl-image-exiftool");
    process.exit(1);
  }

  const rawFiles = (await readdir(inputDir)).filter((f) => PHOTO_EXTS.has(extname(f).toLowerCase()));
  if (rawFiles.length === 0) {
    log("未找到 RAW/JPG 文件，退出");
    return;
  }

  const workDir = join(inputDir, "..", "processed");
  const originalsDir = join(workDir, "originals");
  const thumbsDir = join(workDir, "thumbs");
  await mkdir(originalsDir, { recursive: true });
  await mkdir(thumbsDir, { recursive: true });

  log(`\n处理 ${rawFiles.length} 个照片文件（${rawFiles.filter((f) => RAW_EXTS.has(extname(f).toLowerCase())).length} RAW + ${rawFiles.filter((f) => !RAW_EXTS.has(extname(f).toLowerCase())).length} JPG）→ ${workDir}`);
  const newPhotos = [];
  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i];
    const inputPath = join(inputDir, file);
    const name = basename(file, extname(file));
    const fullOut = join(originalsDir, `${name}.jpg`);
    const thumbOut = join(thumbsDir, `${name}.webp`);
    const pct = `[${i + 1}/${rawFiles.length}]`;
    const isRaw = RAW_EXTS.has(extname(file).toLowerCase());

    if (existsSync(fullOut) && existsSync(thumbOut)) {
      log(`${pct} ${file} → 已存在，跳过`);
    } else {
      process.stdout.write(`${pct} ${file} → ${isRaw ? "extract JPEG" : "压缩 JPG"} ... `);
      let jpgBuf = null;
      try {
        if (isRaw) {
          // RAW:exiftool 提取内嵌 JPEG(最大的一张)
          for (const tag of ["JpgFromRaw", "PreviewImage", "ThumbnailImage"]) {
            try {
              const buf = execFileSync("exiftool", ["-b", `-${tag}`, inputPath], { maxBuffer: 50 * 1024 * 1024, env: EXIFTOOL_ENV });
              if (buf && buf.length > (jpgBuf ? jpgBuf.length : 1000)) jpgBuf = buf;
            } catch { /* 忽略 */ }
          }
          if (!jpgBuf || jpgBuf.length < 1000) throw new Error("RAW 中未找到内嵌 JPEG");
        } else {
          // JPG:源文件直接作为输入(sharp 压缩)
          jpgBuf = await readFile(inputPath);
        }

        process.stdout.write("resize ... ");
        if (!existsSync(fullOut)) {
          await sharp(jpgBuf)
            .resize({ width: FULL_WIDTH, height: FULL_WIDTH, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: FULL_QUALITY, mozjpeg: true })
            .toFile(fullOut);
          execFileSync("exiftool", ["-tagsfromfile", inputPath, "-all:all", "-overwrite_original", fullOut], { stdio: "pipe", env: EXIFTOOL_ENV });
        }
        if (!existsSync(thumbOut)) {
          // 显式按 RAW 的 EXIF orientation 旋转:内嵌 JPEG 无该标签,.rotate() 无参无效;
          // webp 不保留 orientation,不旋转竖图会横着显示(大图靠 exiftool 复制的标签正常,勿动)
          let angle = 0;
          try {
            const o = execFileSync("exiftool", ["-s3", "-Orientation#", inputPath], { encoding: "utf8", env: EXIFTOOL_ENV }).trim();
            if (o) angle = exifToAngle(parseInt(o, 10));
          } catch { /* 无标签保持 0 */ }
          await sharp(jpgBuf)
            .rotate(angle)
            .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "inside", withoutEnlargement: true })
            .webp({ quality: THUMB_QUALITY })
            .toFile(thumbOut);
        }
        log("✓");
      } catch (err) {
        log(`✗ ${err.message}`);
        continue;
      }
    }

    // photos.json 条目（按 src URL 判重）
    const photos = JSON.parse(await readFile(PHOTOS_JSON, "utf8"));
    const existing = photos.some((p) => p.src.endsWith(`/originals/${name}.jpg`));
    if (!existing) {
      const meta = await sharp(fullOut).metadata();
      // 竖拍(orientation 5-8)时 meta 是像素尺寸(横),显示尺寸需交换宽高——thumb 已按标签旋转,JSON 应与显示一致
      const rot = meta.orientation || 1;
      const isRotated = rot >= 5 && rot <= 8;
      let date = new Date().toISOString().slice(0, 19);
      try {
        const iso = execFileSync("exiftool", ["-s3", "-DateTimeOriginal", fullOut], { encoding: "utf8", env: EXIFTOOL_ENV }).trim();
        if (iso) {
          const d = new Date(iso.replace(":", "-").replace(":", "-").replace(/\s/, "T"));
          if (!Number.isNaN(d.getTime())) date = d.toISOString().slice(0, 19);
        }
      } catch { /* 保持缺省 */ }
      newPhotos.push({
        src: `${CDN}/photos/originals/${name}.jpg`,
        thumb: `${CDN}/photos/thumbs/${name}.webp`,
        alt: name,
        width: isRotated ? meta.height : meta.width,
        height: isRotated ? meta.width : meta.height,
        date,
        // note 字段恒存在(无札记为空串)——review 直接更新,字段结构保持一致
        note: "",
      });
    }
  }

  // 写回 photos.json
  if (newPhotos.length) {
    log(`\n新增 ${newPhotos.length} 条 photos.json 条目:`);
    for (const p of newPhotos) log(`  + ${p.alt} (${p.width}×${p.height}, ${p.date})`);
    if (await confirm("\n写回 src/data/photos.json?")) {
      const photos = JSON.parse(await readFile(PHOTOS_JSON, "utf8"));
      photos.push(...newPhotos);
      await writeFile(PHOTOS_JSON, JSON.stringify(photos, null, 2) + "\n");
      log("已写回 ✓（note 字段可用 media review 补充）");
    }
  }

  // 上传
  if (noUpload) {
    log("\n--no-upload：跳过上传");
    return;
  }
  const files = [];
  for (const f of await readdir(originalsDir)) files.push({ key: `photos/originals/${f}`, path: join(originalsDir, f), size: (await stat(join(originalsDir, f))).size });
  for (const f of await readdir(thumbsDir)) files.push({ key: `photos/thumbs/${f}`, path: join(thumbsDir, f), size: (await stat(join(thumbsDir, f))).size });
  if (interactive && !(await confirm(`上传 ${files.length} 个文件到 R2？`))) {
    log("已取消上传");
    return;
  }
  await uploadAndVerify(files);
}

// ── album: 读 ID3 → 封面 → 上传 → music.json 草稿 ────────

const COVER_MAX = 1000;
const COVER_QUALITY = 80;

async function cmdAlbum(args) {
  const noUpload = args.includes("--no-upload");
  let dir = args.find((a) => !a.startsWith("--"));
  let interactive = false;
  if (!dir) {
    // 交互模式：扫描 _r2-upload/music/ 下含 mp3/ncm 的专辑目录
    interactive = true;
    const base = "_r2-upload/music";
    const sub = [];
    try {
      for (const d of await readdir(base)) {
        const p = join(base, d);
        try {
          if ((await stat(p)).isDirectory() && (await readdir(p)).some((f) => /\.(mp3|ncm)$/i.test(f))) sub.push(d);
        } catch { /* 忽略 */ }
      }
    } catch { /* 目录不存在 */ }
    sub.sort((a, b) => a.localeCompare(b, "zh"));
    if (!sub.length) { warn(`未找到含 mp3/ncm 的专辑目录（扫描 ${base}/）`); return; }
    const { rl, ask } = createPrompter();
    log("选择专辑目录:");
    sub.forEach((d, i) => log(`  [${i + 1}] ${d}`));
    const sel = await pick(ask, `选择 [1-${sub.length}, q 退出]: `, sub.length);
    rl.close();
    if (sel === "q") return;
    dir = join(base, sub[sel]);
    log(`\n处理专辑: ${dir}\n`);
  }
  if (!existsSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }

  const albumName = basename(resolve(dir));
  let files = await readdir(dir);
  let mp3s = files.filter((f) => extname(f).toLowerCase() === ".mp3").sort();
  let lrcs = new Set(files.filter((f) => extname(f).toLowerCase() === ".lrc"));
  // 专辑约定:要么全 mp3 要么全 ncm(不混杂)。纯 ncm → 询问就地转换
  const ncms = files.filter((f) => extname(f).toLowerCase() === ".ncm");
  if (ncms.length > 0) {
    if (!(await confirm(`检测到 ${ncms.length} 个 ncm 文件，是否转换为 mp3`))) {
      warn("已取消（可先运行 pnpm media ncm 转换）");
      return;
    }
    log(`转换 ${ncms.length} 个 ncm → mp3 ...`);
    await cmdNcm([dir, "--out", dir, "--remove"]);
    // 转换后重新扫描
    files = await readdir(dir);
    mp3s = files.filter((f) => extname(f).toLowerCase() === ".mp3").sort();
    lrcs = new Set(files.filter((f) => extname(f).toLowerCase() === ".lrc"));
  }
  if (mp3s.length === 0) {
    warn("目录中没有 mp3");
    return;
  }

  log(`\n专辑: ${albumName} — ${mp3s.length} 首 mp3`);

  // 读 ID3
  const tracks = [];
  let artist = "";
  let coverBuf = null;
  for (const f of mp3s) {
    const meta = await parseFile(join(dir, f), { duration: false });
    const tag = meta.common;
    const title = tag.title || basename(f, ".mp3").replace(/^.*? - /, "");
    artist = artist || tag.artist || "";
    const trackNo = tag.track ? tag.track.no : null;
    const lrcName = [...lrcs].find(
      (l) => l.replace(/\.lrc$/i, "") === title || l.includes(title) || title.includes(l.replace(/\.lrc$/i, ""))
    );
    if (lrcName) lrcs.delete(lrcName);
    if (!coverBuf && tag.picture?.length) coverBuf = tag.picture[0].data;
    tracks.push({ file: f, title, artist: tag.artist || "", trackNo, lrc: lrcName || null });
  }
  const unmatchedLrc = [...lrcs];
  for (const l of unmatchedLrc) warn(`未匹配的 lrc: ${l}`);

  tracks.sort((a, b) => (a.trackNo ?? 999) - (b.trackNo ?? 999) || a.file.localeCompare(b.file, "zh"));
  log("\n曲目（按 trackNo 排序，来源: ID3 TRCK / 文件序兜底）:");
  tracks.forEach((t, i) => log(`  ${String(t.trackNo ?? i + 1).padStart(2)} ${t.title}${t.lrc ? "  [lrc]" : ""}`));

  // 封面：目录已有 > ID3 内嵌（统一压缩 cover.jpg，1000px q80 mozjpeg）
  let coverPath = null;
  const legacyCover = ["cover.jpg", "cover.JPG", "cover.png", "Cover.jpg"].map((n) => join(dir, n)).find(existsSync);
  if (legacyCover) {
    // 输入可能与 cover.jpg 同名（ncm 落盘）——先写临时文件再替换
    const tmp = join(dir, "cover.tmp.jpg");
    const info = await sharp(legacyCover)
      .resize({ width: COVER_MAX, height: COVER_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: COVER_QUALITY, mozjpeg: true })
      .toFile(tmp);
    await rename(tmp, join(dir, "cover.jpg"));
    coverPath = join(dir, "cover.jpg");
    log(`\n封面: 目录内已有 ${basename(legacyCover)} → 压缩 cover.jpg (${info.size} bytes)`);
  } else if (coverBuf) {
    const info = await sharp(coverBuf)
      .resize({ width: COVER_MAX, height: COVER_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: COVER_QUALITY, mozjpeg: true })
      .toFile(join(dir, "cover.jpg"));
    coverPath = join(dir, "cover.jpg");
    log(`\n封面: 从 ID3 提取压缩 → cover.jpg (${info.size} bytes)`);
  } else {
    warn("未找到封面（目录无 cover 文件且 ID3 无内嵌），请手动放置 cover.jpg 后重试");
    if (!await confirm("继续上传（无封面）？")) return;
  }

  // music.json 草稿（仅新专辑）
  const music = JSON.parse(await readFile(MUSIC_JSON, "utf8"));
  const existing = music.albums.some((a) => a.name === albumName);
  if (!existing) {
    const entry = {
      name: albumName,
      artist,
      review: "",
      meta: {},
      tracks: tracks.map((t, i) => ({
        trackNo: t.trackNo ?? i + 1,
        title: t.title,
        file: t.file,
        ...(t.lrc ? { lrc: t.lrc } : {}),
      })),
    };
    log(`\nmusic.json 草稿（新专辑）:`);
    log(JSON.stringify(entry, null, 2));
    if (await confirm("\n写回 src/data/music.json?")) {
      music.albums.push(entry);
      await writeFile(MUSIC_JSON, JSON.stringify(music, null, 2) + "\n");
      log("已写回 ✓（review 字段可用 media review 补充）");
    }
  } else {
    log(`\n${albumName} 已在 music.json 中，跳过写回`);
  }

  // 上传
  if (noUpload) {
    log("\n--no-upload：跳过上传");
    return;
  }
  const uploads = [];
  const addFile = async (f) => {
    const p = join(dir, f);
    uploads.push({ key: `music/${albumName}/${f}`, path: p, size: (await stat(p)).size });
  };
  if (coverPath) await addFile(basename(coverPath));
  for (const f of files) {
    if (extname(f).toLowerCase() === ".mp3" || extname(f).toLowerCase() === ".lrc") await addFile(f);
  }
  if (interactive && !(await confirm(`上传 ${uploads.length} 个文件到 R2？`))) {
    log("已取消上传");
    return;
  }
  await uploadAndVerify(uploads);
}

// ── ncm: 解密（Node 原生，基于 taurusxin/ncmdump, MIT）────

const CORE_KEY = Buffer.from("hzHRAmso5kInbaxW", "ascii");
const MODIFY_KEY = Buffer.from("#14ljk_!\\]&0U<'(", "ascii");

function aesEcbDecrypt(key, data) {
  // 与原版一致：只解密完整 16 字节块（ncm 的 key/元数据区长度不保证是 16 倍数，余数忽略）
  const n = data.length >> 4;
  if (n === 0) return Buffer.alloc(0);
  const d = createDecipheriv("aes-128-ecb", key, null);
  d.setAutoPadding(false);
  const out = Buffer.concat([d.update(data.subarray(0, n * 16)), d.final()]);
  // 手动去 PKCS7 padding（与原版一致：末字节 ≤16 时截断）
  const pad = out[out.length - 1];
  if (pad > 0 && pad <= 16) return out.subarray(0, out.length - pad);
  return out;
}

function buildKeyBox(key) {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;
  let swap = 0, c = 0, last = 0, offset = 0;
  for (let i = 0; i < 256; i++) {
    swap = box[i];
    c = (swap + last + key[offset++]) & 0xff;
    if (offset >= key.length) offset = 0;
    box[i] = box[c];
    box[c] = swap;
    last = c;
  }
  return box;
}

function decryptAudio(buf, box) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const j = (i + 1) & 0xff;
    out[i] = buf[i] ^ box[(box[j] + box[(box[j] + j) & 0xff]) & 0xff];
  }
  return out;
}

function decryptNcm(buf) {
  if (buf.subarray(0, 8).toString("latin1") !== "CTENFDAM") throw new Error("不是有效的 ncm 文件");
  let off = 10; // 魔数 8 + 跳过 2

  // ── key 区 ──
  let n = buf.readUInt32LE(off); off += 4;
  const keyData = Buffer.from(buf.subarray(off, off + n).map((b) => b ^ 0x64)); off += n;
  const mKey = aesEcbDecrypt(CORE_KEY, keyData);
  const box = buildKeyBox(mKey.subarray(17));

  // ── 元数据区 ──
  n = buf.readUInt32LE(off); off += 4;
  let metadata = null;
  if (n > 0) {
    const mod = Buffer.from(buf.subarray(off, off + n).map((b) => b ^ 0x63)); off += n;
    const dec = aesEcbDecrypt(MODIFY_KEY, Buffer.from(mod.subarray(22).toString("base64"), "base64"));
    try { metadata = JSON.parse(dec.subarray(6).toString("utf8")); } catch { /* 忽略 */ }
  }

  // ── 封面区 ──
  off += 5; // crc32 + image version
  const coverFrameLen = buf.readUInt32LE(off); off += 4;
  n = buf.readUInt32LE(off); off += 4;
  let cover = null;
  if (n > 0) {
    cover = buf.subarray(off, off + n); off += n;
  }
  off += coverFrameLen - n;

  // ── 音频区 ──
  const audio = decryptAudio(buf.subarray(off), box);
  const format = audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33 ? "mp3" : "flac";
  return { audio, format, metadata, cover };
}

async function cmdNcm(args) {
  const outFlag = args.indexOf("--out");
  const outDir = outFlag >= 0 ? args[outFlag + 1] : null;
  const removeSrc = args.includes("--remove");
  const input = args.filter((a) => !a.startsWith("--"))[0];
  if (!input) {
    console.error("用法: pnpm media ncm <文件|目录> [--out <目录>] [--remove]");
    process.exit(1);
  }

  const isDir = existsSync(input) && (await stat(input)).isDirectory();
  const ncmFiles = isDir
    ? (await readdir(input)).filter((f) => extname(f).toLowerCase() === ".ncm").sort()
    : [basename(input)];
  if (ncmFiles.length === 0) {
    warn("未找到 ncm 文件");
    return;
  }

  if (outDir) await mkdir(outDir, { recursive: true });
  let ok = 0, failed = 0, coverWritten = false;
  for (const f of ncmFiles) {
    const src = isDir ? join(input, f) : input;
    const dstDir = outDir || dirname(src);
    const dst = join(dstDir, basename(f, ".ncm") + ".mp3");
    try {
      const { audio, format, metadata, cover } = decryptNcm(await readFile(src));
      if (format !== "mp3") {
        warn(`${f}: 解密产物是 ${format}（非 mp3），跳过`);
        failed++;
        continue;
      }
      await writeFile(dst, audio);
      // 专辑封面：ncm 封面区提取落盘（仅第一首；已有手动封面则不覆盖）
      if (cover && !coverWritten && !["cover.jpg", "cover.JPG", "cover.png"].some((n) => existsSync(join(dstDir, n)))) {
        const ext = cover[0] === 0x89 ? "png" : "jpg";
        const coverOut = join(dstDir, `cover.${ext}`);
        await writeFile(coverOut, cover);
        log(`  （ncm 封面 ${cover.length} bytes → ${basename(coverOut)}）`);
        coverWritten = true;
      }
      const meta = metadata ? `${metadata.musicName || ""} / ${metadata.artist?.[0]?.[0] || ""}` : "无元数据";
      log(`✓ ${f} → ${dst}（${(audio.length / 1024 / 1024).toFixed(1)}MB, ${meta}）`);
      if (removeSrc) {
        await unlink(src);
        log(`  （已删除源文件 ${f}）`);
      }
      ok++;
    } catch (e) {
      warn(`${f}: ${e.message}`);
      failed++;
    }
  }
  log(`\n完成: ${ok} 成功, ${failed} 失败`);
  if (ok > 0) log("下一步: pnpm media album <专辑目录>");
}

// ── review: 札记编辑 ──────────────────────────────────────

async function cmdReview(args) {
  const musicIdx = args.indexOf("--music");
  const photoIdx = args.indexOf("--photo");
  const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

  if (musicIdx >= 0) {
    const name = args[musicIdx + 1];
    const text = args[musicIdx + 2] ?? "";
    const music = await readJson(MUSIC_JSON);
    const album = music.albums.find((a) => a.name === name);
    if (!album) { warn(`未找到专辑: ${name}`); process.exit(1); }
    album.review = text.trim();
    await writeFile(MUSIC_JSON, JSON.stringify(music, null, 2) + "\n");
    log(text.trim() ? `✓ 已设置 ${name} 札记: ${text.trim()}` : `✓ 已清空 ${name} 札记`);
    return;
  }
  if (photoIdx >= 0) {
    const key = args[photoIdx + 1];
    const text = args[photoIdx + 2] ?? "";
    const photos = await readJson(PHOTOS_JSON);
    const photo = photos.find((p) => p.src.includes(key) || String(photos.indexOf(p) + 1) === key);
    if (!photo) { warn(`未找到照片: ${key}`); process.exit(1); }
    if (text.trim()) photo.note = text.trim();
    else photo.note = ""; // 清空也写空串,note 字段恒存在
    await writeFile(PHOTOS_JSON, JSON.stringify(photos, null, 2) + "\n");
    log(text.trim() ? `✓ 已设置 ${photo.alt} 札记` : `✓ 已清空 ${photo.alt} 札记`);
    return;
  }

  // 交互式
  const { rl, ask } = createPrompter();

  // 编辑一类札记（kind: 0=音乐 1=摄影）；返回 true（b 返回）/ false（q 退出）
  const setReview = async (kind) => {
    const file = kind === 0 ? MUSIC_JSON : PHOTOS_JSON;
    const data = await readJson(file);
    const items = kind === 0 ? data.albums : data;
    while (true) {
      log("");
      items.forEach((x, i) => {
        const cur = kind === 0 ? x.review : x.note;
        log(`  [${i + 1}] ${x.name || x.alt}${cur ? ` — ${cur}` : ""}`);
      });
      const sel = await pick(ask, `选择 [1-${items.length}, b 返回, q 退出]: `, items.length, { allowBack: true });
      if (sel === "q") return false;
      if (sel === "b") return true;
      const item = items[sel];
      const cur = kind === 0 ? item.review : item.note;
      log(`  当前札记: ${cur ? `"${cur}"` : "（无）"}`);
      const text = (await ask(`输入札记（直接回车 = 清空，q = 取消）: `)).trim();
      if (text === "q") continue;
      if (kind === 0) {
        item.review = text;
      } else {
        if (text) item.note = text;
        else delete item.note;
      }
      await writeFile(file, JSON.stringify(data, null, 2) + "\n");
      log(text ? `✓ 已设置 ${item.name || item.alt} 札记` : `✓ 已清空 ${item.name || item.alt} 札记`);
    }
  };

  while (true) {
    const kind = await pick(ask, "编辑哪种札记？[1] 音乐  [2] 摄影  [q] 退出: ", 2);
    if (kind === "q") break;
    if (kind === 0 || kind === 1) {
      const back = await setReview(kind);
      if (!back) break;
    }
  }
  rl.close();
  log("已退出");
}

// ── 入口（仅直接运行时执行，import 时不触发）─────────────

const [cmd, ...rest] = process.argv.slice(2);
const COMMANDS = { photos: cmdPhotos, album: cmdAlbum, ncm: cmdNcm, review: cmdReview };

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  if (!COMMANDS[cmd]) {
    log(`用法: pnpm media <photos|album|ncm|review> [参数]`);
    log(`  photos <RAW目录> [--no-upload]`);
    log(`  album <专辑目录> [--no-upload]`);
    log(`  ncm <文件|目录> [--out <目录>]`);
    log(`  review [--music <专辑> [文本] | --photo <src|序号> [文本]]`);
    process.exit(cmd ? 1 : 0);
  }
  await COMMANDS[cmd](rest);
}
