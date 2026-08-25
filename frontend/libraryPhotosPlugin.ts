import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import exifr from "exifr";
import { TAKEN_AT_TAG_ORDER, takenAtFromUtcDate, wallClockFromExifValue } from "./src/lib/takenAt";

const VIRTUAL_ID = "virtual:memries-photos";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const URL_PREFIX = "/library-photos/";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export type LibraryPhotoEntry = {
  id: string;
  imageUrl: string;
  takenAt: string;
  takenAtSource: string;
  width: number;
  height: number;
  alt: string;
};

export function resolvePhotosRoot(configDir: string): string {
  if (fs.existsSync("/data/photos")) return "/data/photos";
  return path.resolve(configDir, "../data/photos");
}

export function libraryPhotosPlugin(photosRoot: string): Plugin {
  const root = path.resolve(photosRoot);

  return {
    name: "memries-library-photos",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      const entries = await buildLibrary(root);
      return `export const libraryPhotos = ${JSON.stringify(entries)};\n`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        if (!raw.startsWith(URL_PREFIX)) {
          next();
          return;
        }
        const rel = decodeURIComponent(raw.slice(URL_PREFIX.length));
        const abs = path.resolve(root, rel);
        if (!isInside(root, abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", mimeFor(abs));
        res.setHeader("Cache-Control", "public, max-age=120");
        fs.createReadStream(abs).pipe(res);
      });

      // Polling every photo in Docker is expensive; new files need a Vite restart there.
      if (process.env.CHOKIDAR_USEPOLLING !== "true" && fs.existsSync(root)) {
        watchLibrary(server, root);
      }
    },
  };
}

function watchLibrary(server: ViteDevServer, root: string): void {
  const reload = (): void => {
    const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
    if (mod) void server.reloadModule(mod);
  };
  server.watcher.add(root);
  server.watcher.on("all", (_event, file) => {
    if (isInside(root, file)) reload();
  });
}

async function buildLibrary(root: string): Promise<LibraryPhotoEntry[]> {
  if (!fs.existsSync(root)) {
    console.warn(`[memries-photos] photos root missing: ${root}`);
    return [];
  }

  const files = listImages(root);
  const sourceCounts = new Map<string, number>();
  const entries: LibraryPhotoEntry[] = [];

  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    const entry = await readEntry(abs, rel);
    entries.push(entry);
    sourceCounts.set(entry.takenAtSource, (sourceCounts.get(entry.takenAtSource) ?? 0) + 1);
  }

  entries.sort((a, b) => b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id));

  const summary = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => `${tag}=${n}`)
    .join(", ");
  console.info(`[memries-photos] ${entries.length} files from ${root} (${summary || "none"})`);

  return entries;
}

async function readEntry(abs: string, rel: string): Promise<LibraryPhotoEntry> {
  const name = path.basename(abs);
  const stat = fs.statSync(abs);
  const parsed = await parseExif(abs);
  const taken = takenAtFromParsed(parsed) ?? {
    takenAt: takenAtFromUtcDate(stat.mtime),
    takenAtSource: "file mtime",
  };
  const dims = dimensionsFromParsed(parsed) ?? readImageSize(abs) ?? { width: 1, height: 1 };

  return {
    id: rel,
    imageUrl: URL_PREFIX + rel.split("/").map(encodeURIComponent).join("/"),
    takenAt: taken.takenAt,
    takenAtSource: taken.takenAtSource,
    width: dims.width,
    height: dims.height,
    alt: name || "Photo",
  };
}

async function parseExif(abs: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await exifr.parse(abs, {
      tiff: true,
      xmp: true,
      icc: false,
      iptc: true,
      jfif: false,
      ihdr: true,
      reviveValues: false,
      mergeOutput: true,
      pick: [
        ...TAKEN_AT_TAG_ORDER,
        "PixelXDimension",
        "PixelYDimension",
        "ExifImageWidth",
        "ExifImageHeight",
        "ImageWidth",
        "ImageHeight",
        "Orientation",
      ],
    });
    return parsed ?? null;
  } catch {
    return null;
  }
}

function takenAtFromParsed(parsed: Record<string, unknown> | null): { takenAt: string; takenAtSource: string } | null {
  if (!parsed) return null;
  for (const tag of TAKEN_AT_TAG_ORDER) {
    const takenAt = wallClockFromExifValue(parsed[tag]);
    if (takenAt) return { takenAt, takenAtSource: tag };
  }
  return null;
}

function dimensionsFromParsed(
  parsed: Record<string, unknown> | null,
): { width: number; height: number } | null {
  if (!parsed) return null;
  const pairs: Array<[unknown, unknown]> = [
    [parsed.PixelXDimension, parsed.PixelYDimension],
    [parsed.ExifImageWidth, parsed.ExifImageHeight],
    [parsed.ImageWidth, parsed.ImageHeight],
  ];
  for (const [wRaw, hRaw] of pairs) {
    const width = Number(wRaw);
    const height = Number(hRaw);
    if (width > 0 && height > 0) {
      return swapIfRotated({ width, height }, parsed.Orientation);
    }
  }
  return null;
}

function swapIfRotated(
  size: { width: number; height: number },
  orientation: unknown,
): { width: number; height: number } {
  const n = typeof orientation === "number" ? orientation : 0;
  const label = typeof orientation === "string" ? orientation : "";
  const rotated =
    n === 5 || n === 6 || n === 7 || n === 8 || /90|270|Transpose|Transverse/i.test(label);
  if (!rotated) return size;
  return { width: size.height, height: size.width };
}

function listImages(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) listImages(abs, acc);
    else if (entry.isFile() && IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) acc.push(abs);
  }
  return acc;
}

function readImageSize(abs: string): { width: number; height: number } | null {
  const fd = fs.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(131072);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return imageSizeFromHeader(buf.subarray(0, n));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function imageSizeFromHeader(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length > 16 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return webpSize(buf);
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    return jpegSize(buf);
  }
  return null;
}

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function webpSize(buf: Buffer): { width: number; height: number } | null {
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X" && buf.length >= 30) {
    const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
    const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
    return { width, height };
  }
  if (kind === "VP8 " && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === "VP8L" && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function mimeFor(abs: string): string {
  switch (path.extname(abs).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function toPosix(rel: string): string {
  return rel.split(path.sep).join("/");
}
