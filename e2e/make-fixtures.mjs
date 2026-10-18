// Generates the small files the tests upload. Run once: node e2e/make-fixtures.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const out = new URL("./fixtures/", import.meta.url);
fs.mkdirSync(out, { recursive: true });

// A 120x80 PNG "payment screenshot": brass with a green band.
function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [0];
    for (let x = 0; x < w; x++) row.push(...(y > h * 0.35 && y < h * 0.65 ? [15, 61, 47] : [195, 145, 47]));
    rows.push(Buffer.from(row));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
fs.writeFileSync(new URL("upi-proof.png", out), png(120, 80));

const pdf = await PDFDocument.create();
const page = pdf.addPage([420, 300]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("TAX INVOICE — Ma Durga Decorators", { x: 30, y: 250, size: 14, font, color: rgb(0, 0, 0) });
page.drawText("Pandal lighting, final instalment     Rs. 2,350.00", { x: 30, y: 210, size: 11, font });
fs.writeFileSync(new URL("vendor-bill.pdf", out), await pdf.save());

fs.writeFileSync(new URL("not-really.png", out), "This is plain text pretending to be a PNG.");
console.log("fixtures written");
