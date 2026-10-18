import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Bills, invoices and payment proofs live outside the web root and are only ever
// served through an authenticated route handler.
export function uploadDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./.data/uploads");
}

export const MAX_FILES = 5;
export function maxBytes() {
  return Math.max(1, Number(process.env.UPLOAD_MAX_MB ?? 5)) * 1024 * 1024;
}

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
];

export const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type ValidatedFile = { originalName: string; mime: string; ext: string; buffer: Buffer; size: number };

/** Checks count, size and the real file type from magic bytes (never the browser's claim). */
export async function validateFiles(files: File[]): Promise<{ files: ValidatedFile[]; error?: string }> {
  const real = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (real.length > MAX_FILES) return { files: [], error: `Attach at most ${MAX_FILES} files at a time.` };
  const out: ValidatedFile[] = [];
  for (const f of real) {
    if (f.size > maxBytes()) return { files: [], error: `"${f.name}" is larger than ${process.env.UPLOAD_MAX_MB ?? 5} MB.` };
    const buffer = Buffer.from(await f.arrayBuffer());
    const sig = SIGNATURES.find((s) => s.test(buffer));
    if (!sig) return { files: [], error: `"${f.name}" isn't a JPG, PNG, WEBP or PDF file.` };
    const originalName = path.basename(f.name).replace(/[^\w.\- ()]/g, "_").slice(0, 200) || `file.${sig.ext}`;
    out.push({ originalName, mime: sig.mime, ext: sig.ext, buffer, size: f.size });
  }
  return { files: out };
}

export async function storeFile(file: ValidatedFile) {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true, mode: 0o750 });
  const storedName = `${randomUUID()}.${file.ext}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, storedName), file.buffer, { mode: 0o640, flag: "wx" });
  return storedName;
}

export async function readStoredFile(storedName: string) {
  // storedName comes from our DB, but never trust a path: keep it inside the upload dir.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(storedName)) throw new Error("Invalid stored file name");
  return readFile(path.join(/*turbopackIgnore: true*/ uploadDir(), storedName));
}

export async function removeStoredFile(storedName: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(storedName)) return;
  await unlink(path.join(/*turbopackIgnore: true*/ uploadDir(), storedName)).catch(() => {});
}
