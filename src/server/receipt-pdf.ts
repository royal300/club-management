import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, formatDateTime, formatINR, INCOME_CATEGORY_LABEL, MODE_LABEL } from "@/lib/format";
import type { ClubSettings } from "./settings";
import type { TxnDetail } from "./queries/transactions";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** 1234567.5 → "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only" */
export function rupeesInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${crore >= 100 ? threeDigits(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const words = parts.length ? parts.join(" ") : "Zero";
  return `${words} Rupee${rupees === 1 ? "" : "s"}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}

let fontCache: Promise<{ regular: Buffer; bold: Buffer; display: Buffer }> | null = null;
function loadFonts() {
  fontCache ??= (async () => {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const [regular, bold, display] = await Promise.all([
      readFile(path.join(dir, "IBMPlexSans-Regular.ttf")),
      readFile(path.join(dir, "IBMPlexSans-Bold.ttf")),
      readFile(path.join(dir, "Fraunces-SemiBold.ttf")),
    ]);
    return { regular, bold, display };
  })();
  return fontCache;
}

const C = {
  paper: rgb(0.957, 0.937, 0.894),
  ink: rgb(0.086, 0.125, 0.106),
  muted: rgb(0.36, 0.4, 0.37),
  felt: rgb(0.059, 0.239, 0.184),
  brass: rgb(0.765, 0.569, 0.184),
  brassSoft: rgb(0.925, 0.831, 0.608),
  stamp: rgb(0.769, 0.318, 0.169),
  line: rgb(0.85, 0.82, 0.75),
};

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function rightText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = C.ink) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, size), y, size, font, color });
}

export async function renderReceiptPdf(t: TxnDetail, club: ClubSettings, appUrl: string) {
  const fonts = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const display = await pdf.embedFont(fonts.display, { subset: true });

  const income = t.kind === "INCOME";
  const docTitle = income ? "MONEY RECEIPT" : "PAYMENT VOUCHER";
  pdf.setTitle(`${t.receiptNo} — ${club.club_name}`);
  pdf.setAuthor(club.club_name);
  pdf.setSubject(docTitle);
  pdf.setCreator("Club ledger");

  // A5 portrait
  const W = 420;
  const H = 595;
  const M = 30;
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });

  // Header band
  const bandH = 104;
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: C.felt });
  page.drawRectangle({ x: 0, y: H - bandH - 4, width: W, height: 4, color: C.brass });
  page.drawText(club.club_name, { x: M, y: H - 46, size: 24, font: display, color: C.paper });
  let hy = H - 64;
  for (const line of [club.club_address, [club.club_phone, club.club_email].filter(Boolean).join("  ·  "), club.club_registration].filter(Boolean)) {
    for (const l of wrap(line, regular, 7.5, W - 2 * M)) {
      page.drawText(l, { x: M, y: hy, size: 7.5, font: regular, color: C.brassSoft });
      hy -= 10;
    }
  }

  // Title row
  let y = H - bandH - 34;
  page.drawText(docTitle, { x: M, y, size: 11, font: bold, color: C.ink });
  rightText(page, `No. ${t.receiptNo}`, W - M, y, 10, bold);
  y -= 15;
  page.drawText(`Transaction ${t.txnCode}`, { x: M, y, size: 8, font: regular, color: C.muted });
  rightText(page, `Date: ${formatDate(t.txnDate)}`, W - M, y, 8.5, regular);
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: C.line });

  // Body
  y -= 26;
  const label = income ? INCOME_CATEGORY_LABEL[t.incomeCategory ?? "OTHER"] : (t.expenseCategory ?? "Expense");
  const party = t.partyName ?? t.memberName ?? "—";
  const amountNum = Number(t.amount);
  const rows: [string, string][] = [
    [income ? "Received with thanks from" : "Paid to", party],
    ...(t.memberCode ? ([["Member ID", t.memberCode]] as [string, string][]) : []),
    ["The sum of", rupeesInWords(amountNum)],
    [income ? "Towards" : "Being", t.description ? `${label} — ${t.description}` : label],
    ...(t.eventName ? ([["Event", t.eventName]] as [string, string][]) : []),
    ["By", `${MODE_LABEL[t.mode]}${t.referenceNo ? `  ·  Ref. ${t.referenceNo}` : ""}`],
  ];
  const labelW = 118;
  for (const [k, v] of rows) {
    page.drawText(k, { x: M, y, size: 8.5, font: regular, color: C.muted });
    const lines = wrap(v, k === "The sum of" ? bold : regular, 10, W - 2 * M - labelW);
    lines.forEach((l, i) => {
      page.drawText(l, { x: M + labelW, y: y - i * 14, size: 10, font: k === "The sum of" ? bold : regular, color: C.ink });
      page.drawLine({ start: { x: M + labelW, y: y - i * 14 - 4 }, end: { x: W - M, y: y - i * 14 - 4 }, thickness: 0.5, color: C.line, dashArray: [2, 2] });
    });
    y -= Math.max(1, lines.length) * 14 + 12;
  }

  // Amount box
  y -= 8;
  const boxH = 54;
  page.drawRectangle({ x: M + 4, y: y - boxH - 4, width: 190, height: boxH, color: C.brass });
  page.drawRectangle({ x: M, y: y - boxH, width: 190, height: boxH, color: rgb(1, 1, 1), borderColor: C.ink, borderWidth: 1.4 });
  page.drawText("AMOUNT", { x: M + 12, y: y - 16, size: 7, font: bold, color: C.muted });
  page.drawText(formatINR(amountNum), { x: M + 12, y: y - 40, size: 20, font: bold, color: C.felt });

  // Stamp — box and text rotate together around the box's corner.
  const stampText = income ? "RECEIVED" : "PAID";
  const sx = W - M - 140;
  const sy = y - 46;
  const angle = 10;
  const rad = (angle * Math.PI) / 180;
  const dx = (120 - bold.widthOfTextAtSize(stampText, 16)) / 2;
  const dy = 12;
  page.drawRectangle({ x: sx, y: sy, width: 120, height: 36, borderColor: C.stamp, borderWidth: 2.4, rotate: degrees(angle), borderOpacity: 0.85 });
  page.drawText(stampText, {
    x: sx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: sy + dx * Math.sin(rad) + dy * Math.cos(rad),
    size: 16,
    font: bold,
    color: C.stamp,
    rotate: degrees(angle),
    opacity: 0.85,
  });

  // Signature
  y -= boxH + 56;
  page.drawLine({ start: { x: W - M - 140, y }, end: { x: W - M, y }, thickness: 0.8, color: C.ink });
  rightText(page, income ? "Treasurer / Authorised signatory" : "Received by (signature)", W - M, y - 12, 7.5, regular, C.muted);
  page.drawText(`Recorded by ${t.createdByName ?? "—"}`, { x: M, y: y - 12, size: 7.5, font: regular, color: C.muted });

  // Footer
  const footerLines = wrap(club.receipt_footer, regular, 7.5, W - 2 * M);
  let fy = 40 + footerLines.length * 10;
  page.drawLine({ start: { x: M, y: fy + 8 }, end: { x: W - M, y: fy + 8 }, thickness: 0.6, color: C.line });
  for (const l of footerLines) {
    page.drawText(l, { x: M, y: fy - 4, size: 7.5, font: regular, color: C.muted });
    fy -= 10;
  }
  page.drawText(`Generated ${formatDateTime(new Date())} · ${appUrl.replace(/^https?:\/\//, "")}${club.club_pan ? ` · PAN ${club.club_pan}` : ""}`, {
    x: M,
    y: 22,
    size: 6.5,
    font: regular,
    color: C.muted,
  });
  // perforation
  for (let x = M; x < W - M; x += 8) page.drawCircle({ x, y: 12, size: 1.1, color: C.line });

  return pdf.save();
}
