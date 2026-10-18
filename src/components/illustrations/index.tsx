// Hand-drawn club illustrations in a two-colour risograph style:
// ink outlines, flat paper/felt/brass fills and a slightly mis-registered shadow plate.
// Every part that animates carries a data-part attribute for GSAP to target.
import type { SVGProps } from "react";

const INK = "var(--ink)";
const PAPER = "var(--paper)";
const FELT = "var(--felt)";
const FELT_DEEP = "var(--felt-deep)";
const BRASS = "var(--brass)";
const BRASS_SOFT = "var(--brass-soft)";
const STAMP = "var(--stamp)";

type P = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ Clubhouse */

export function Clubhouse({ withDoors = true, ...props }: P & { withDoors?: boolean }) {
  return (
    <Svg viewBox="0 0 420 340" {...props}>
      {/* ground + shadow plate */}
      <ellipse cx="210" cy="318" rx="190" ry="10" fill={INK} opacity=".12" />
      <g data-part="building">
        <path d="M66 136h296v174H66z" fill={BRASS} transform="translate(6 6)" />
        <path d="M60 130h300v178H60z" fill={PAPER} stroke={INK} strokeWidth="3" />
        {/* brick courses */}
        <g stroke={INK} strokeWidth="1.2" opacity=".18">
          {[160, 190, 220, 250, 280].map((y) => (
            <path key={y} d={`M62 ${y}h296`} />
          ))}
        </g>
        {/* pediment */}
        <path d="M46 136 210 46l164 90z" fill={STAMP} transform="translate(6 6)" />
        <path d="M40 134 210 40l170 94z" fill={FELT} stroke={INK} strokeWidth="3" />
        <path d="M78 124 210 58l132 66z" fill="none" stroke={BRASS_SOFT} strokeWidth="2" opacity=".55" />
        {/* crest */}
        <circle cx="210" cy="100" r="18" fill={BRASS} stroke={INK} strokeWidth="3" />
        <path d="M203 92h14M203 98h14M207 92c8 0 8 12 0 12l9 9" fill="none" stroke={INK} strokeWidth="2.4" />
        {/* cornice */}
        <path d="M52 130h316v10H52z" fill={PAPER} stroke={INK} strokeWidth="3" />
        {/* flag */}
        <g data-part="flag">
          <path d="M210 40V6" stroke={INK} strokeWidth="3" />
          <path d="M211 8c14-6 24 6 38 0v18c-14 6-24-6-38 0z" fill={STAMP} stroke={INK} strokeWidth="2.6" />
        </g>
        {/* columns */}
        {[84, 130, 270, 316].map((x) => (
          <g key={x}>
            <path d={`M${x} 146h20v150h-20z`} fill={PAPER} stroke={INK} strokeWidth="2.6" />
            <path d={`M${x - 4} 140h28v8h-28zM${x - 4} 294h28v8h-28z`} fill={BRASS_SOFT} stroke={INK} strokeWidth="2.4" />
            <path d={`M${x + 7} 152v138M${x + 13} 152v138`} stroke={INK} strokeWidth="1" opacity=".35" />
          </g>
        ))}
        {/* windows */}
        {[106, 292].map((x) => (
          <g key={x} data-part="window">
            <path d={`M${x - 12} 186h44v58h-44z`} fill={FELT_DEEP} stroke={INK} strokeWidth="2.6" />
            <path data-part="window-light" d={`M${x - 8} 190h36v50h-36z`} fill={BRASS_SOFT} />
            <path d={`M${x + 10} 190v50M${x - 8} 214h36`} stroke={INK} strokeWidth="2" />
          </g>
        ))}
        {/* sign */}
        <path d="M160 150h100v22H160z" fill={FELT_DEEP} stroke={INK} strokeWidth="2.6" />
        <path d="M172 161h76" stroke={BRASS} strokeWidth="3" strokeDasharray="6 5" />
        {/* doorway */}
        <path d="M172 302v-92a38 38 0 0 1 76 0v92z" fill={INK} />
        <path data-part="door-glow" d="M176 302v-90a34 34 0 0 1 68 0v90z" fill={BRASS_SOFT} />
        {withDoors ? (
          <g data-part="doors">
            <path data-part="door-left" d="M176 302v-90a34 34 0 0 1 34-34v124z" fill={FELT} stroke={INK} strokeWidth="2.6" />
            <path data-part="door-right" d="M244 302v-90a34 34 0 0 0-34-34v124z" fill={FELT} stroke={INK} strokeWidth="2.6" />
            <path d="M186 222h16v30h-16zM218 222h16v30h-16z" fill="none" stroke={BRASS_SOFT} strokeWidth="1.6" opacity=".6" />
            <circle cx="203" cy="262" r="3" fill={BRASS} />
            <circle cx="217" cy="262" r="3" fill={BRASS} />
          </g>
        ) : null}
        {/* steps */}
        <path d="M150 302h120v8H150zM138 310h144v8H138z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
        {/* lanterns */}
        {[158, 262].map((x) => (
          <g key={x} data-part="lamp">
            <path d={`M${x} 196v10`} stroke={INK} strokeWidth="2.4" />
            <path d={`M${x - 6} 206h12l-2 16h-8z`} fill={BRASS_SOFT} stroke={INK} strokeWidth="2.4" />
          </g>
        ))}
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ Ledger */

export function Ledger(props: P) {
  return (
    <Svg viewBox="0 0 420 280" {...props}>
      <ellipse cx="210" cy="262" rx="180" ry="10" fill={INK} opacity=".12" />
      {/* cover */}
      <path d="M32 54c60-10 120-6 178 14 58-20 118-24 178-14v196c-60-10-120-6-178 14-58-20-118-24-178-14z" fill={STAMP} transform="translate(6 6)" />
      <path d="M26 50c62-10 124-6 184 14 60-20 122-24 184-14v196c-62-10-124-6-184 14-60-20-122-24-184-14z" fill={FELT} stroke={INK} strokeWidth="3" />
      {/* pages */}
      <path data-part="page-left" d="M38 52c58-8 116-2 172 16v178c-56-18-114-24-172-16z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <path data-part="page-right" d="M382 52c-58-8-116-2-172 16v178c56-18 114-24 172-16z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      {/* ruled lines */}
      <g stroke={INK} strokeWidth="1.2" opacity=".22">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i}>
            <path d={`M52 ${92 + i * 18}c48-6 98-2 144 12`} />
            <path d={`M368 ${92 + i * 18}c-48-6-98-2-144 12`} />
          </g>
        ))}
      </g>
      <path d="M78 80v148" stroke={STAMP} strokeWidth="1.6" opacity=".55" />
      {/* entries */}
      <g data-part="entries" fill={INK}>
        <text x="86" y="104" fontSize="12" fontFamily="var(--font-geist-mono), monospace">Subscription</text>
        <text x="86" y="122" fontSize="12" fontFamily="var(--font-geist-mono), monospace">Donation</text>
        <text x="86" y="140" fontSize="12" fontFamily="var(--font-geist-mono), monospace">Sponsorship</text>
        <text x="236" y="112" fontSize="12" fontFamily="var(--font-geist-mono), monospace">₹ 1,200.00</text>
        <text x="236" y="130" fontSize="12" fontFamily="var(--font-geist-mono), monospace">₹ 5,001.00</text>
        <text x="236" y="148" fontSize="12" fontFamily="var(--font-geist-mono), monospace">₹ 50,000.00</text>
      </g>
      <path d="M236 176h110" stroke={INK} strokeWidth="2" />
      <text x="236" y="196" fontSize="14" fontWeight="700" fill={FELT} fontFamily="var(--font-geist-mono), monospace">₹ 56,201.00</text>
      {/* tick marks */}
      <path d="M352 104l4 5 8-11M352 122l4 5 8-11M352 140l4 5 8-11" fill="none" stroke={FELT} strokeWidth="2.4" />
      {/* ribbon */}
      <path data-part="ribbon" d="M206 66v196l8-10 8 10V62" fill={BRASS} stroke={INK} strokeWidth="2.4" />
      {/* spine */}
      <path d="M210 68v178" stroke={INK} strokeWidth="2.6" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ Coins */

export function Coin({ size = 64, ...props }: P & { size?: number }) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size} {...props}>
      <circle cx="35" cy="35" r="26" fill={STAMP} />
      <circle cx="32" cy="32" r="26" fill={BRASS} stroke={INK} strokeWidth="3" />
      <circle cx="32" cy="32" r="19" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="2 4" opacity=".6" />
      <path d="M24 22h16M24 29h16M28 22c10 0 10 14 0 14l11 11" fill="none" stroke={INK} strokeWidth="3" />
    </Svg>
  );
}

export function CoinStack(props: P) {
  const coin = (y: number, i: number) => (
    <g key={i} data-part="coin">
      <path d={`M20 ${y}v10c0 7 24 12 50 12s50-5 50-12v-10`} fill={BRASS} stroke={INK} strokeWidth="2.6" />
      <ellipse cx="70" cy={y} rx="50" ry="12" fill={BRASS_SOFT} stroke={INK} strokeWidth="2.6" />
      <path d={`M30 ${y + 6}v6M44 ${y + 9}v6M58 ${y + 10}v6M72 ${y + 10}v6M86 ${y + 10}v6M100 ${y + 8}v6M112 ${y + 5}v6`} stroke={INK} strokeWidth="1.4" opacity=".45" />
    </g>
  );
  return (
    <Svg viewBox="0 0 140 160" {...props}>
      <ellipse cx="72" cy="150" rx="58" ry="8" fill={INK} opacity=".12" />
      {[128, 112, 96, 80, 64, 48].map((y, i) => coin(y, i))}
      <text x="70" y="53" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="var(--font-fraunces), serif">₹</text>
    </Svg>
  );
}

/* ------------------------------------------------------------------ Members */

export function Members(props: P) {
  const person = (x: number, fill: string, shadow: string, hair: string, key: string, scale = 1) => (
    <g key={key} data-part="member" transform={`translate(${x} ${scale === 1 ? 0 : 14}) scale(${scale})`}>
      <path d="M8 200c0-44 22-70 52-70s52 26 52 70z" fill={shadow} transform="translate(6 6)" />
      <path d="M8 200c0-44 22-70 52-70s52 26 52 70z" fill={fill} stroke={INK} strokeWidth="3" />
      <path d="M44 132l16 22 16-22" fill="none" stroke={INK} strokeWidth="2.6" />
      <circle cx="60" cy="96" r="30" fill={PAPER} stroke={INK} strokeWidth="3" />
      <path d={hair} fill={INK} />
      <circle cx="50" cy="98" r="2.6" fill={INK} />
      <circle cx="70" cy="98" r="2.6" fill={INK} />
      <path d="M52 110c5 4 11 4 16 0" fill="none" stroke={INK} strokeWidth="2.4" />
    </g>
  );
  return (
    <Svg viewBox="0 0 420 260" {...props}>
      <ellipse cx="210" cy="244" rx="190" ry="10" fill={INK} opacity=".12" />
      {person(26, BRASS, STAMP, "M30 92c0-22 14-34 30-34s30 12 30 34c-8-10-22-14-30-14s-22 4-30 14z", "a", 0.9)}
      {person(290, STAMP, BRASS, "M30 96c-2-26 14-38 30-38 20 0 32 14 30 38-4-12-14-20-30-20s-26 8-30 20zM84 84c10 14 8 34 2 46 8-16 4-34-2-46z", "c", 0.9)}
      {person(150, FELT, BRASS, "M30 90c2-20 14-32 30-32s28 12 30 32c-12-8-20-10-30-10s-18 2-30 10z", "b")}
      {/* membership card */}
      <g data-part="card" transform="rotate(-6 210 214)">
        <path d="M126 186h176v64H126z" fill={FELT_DEEP} transform="translate(6 6)" />
        <path d="M126 186h176v64H126z" fill={PAPER} stroke={INK} strokeWidth="3" />
        <path d="M126 186h176v16H126z" fill={FELT} stroke={INK} strokeWidth="3" />
        <circle cx="152" cy="226" r="12" fill={BRASS_SOFT} stroke={INK} strokeWidth="2.4" />
        <text x="174" y="222" fontSize="11" fontWeight="700" fill={INK} fontFamily="var(--font-geist-mono), monospace">MEM-2026-0042</text>
        <path d="M174 234h70" stroke={INK} strokeWidth="2" opacity=".35" />
        <text x="140" y="198" fontSize="9" fontWeight="700" fill={PAPER} fontFamily="var(--font-geist-mono), monospace" letterSpacing="2">MEMBER</text>
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ Events */

export function Bunting(props: P) {
  const flags = [STAMP, BRASS, FELT, BRASS_SOFT, STAMP, FELT, BRASS, STAMP, BRASS_SOFT];
  return (
    <Svg viewBox="0 0 420 90" preserveAspectRatio="none" {...props}>
      <path d="M0 10c140 40 280 40 420 0" fill="none" stroke={INK} strokeWidth="2.6" />
      {flags.map((c, i) => {
        const x = 22 + i * 44;
        const t = x / 420;
        const y = 10 + 4 * 30 * t * (1 - t) * 1.0 * 1.0 + 0.5;
        return (
          <path
            key={i}
            data-part="flag"
            d={`M${x - 14} ${y}l14 ${34}l14 ${-34}z`}
            fill={c}
            stroke={INK}
            strokeWidth="2.4"
          />
        );
      })}
    </Svg>
  );
}

export function EventCalendar(props: P) {
  return (
    <Svg viewBox="0 0 220 220" {...props}>
      <ellipse cx="110" cy="206" rx="86" ry="8" fill={INK} opacity=".12" />
      <path d="M32 40h160v156H32z" fill={STAMP} transform="translate(6 6)" />
      <path d="M32 40h160v156H32z" fill={PAPER} stroke={INK} strokeWidth="3" />
      <path d="M32 40h160v40H32z" fill={FELT} stroke={INK} strokeWidth="3" />
      <path d="M66 26v28M158 26v28" stroke={INK} strokeWidth="5" />
      <text x="112" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill={PAPER} fontFamily="var(--font-geist-mono), monospace" letterSpacing="3">OCTOBER</text>
      <text data-part="day" x="112" y="160" textAnchor="middle" fontSize="72" fill={INK} fontFamily="var(--font-fraunces), serif" fontWeight="600">17</text>
      <circle cx="160" cy="176" r="12" fill={BRASS} stroke={INK} strokeWidth="2.4" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ Receipt */

export function ReceiptPaper(props: P) {
  return (
    <Svg viewBox="0 0 200 260" {...props}>
      <path d="M20 10h160v236l-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8z" fill={BRASS_SOFT} transform="translate(6 6)" />
      <path d="M20 10h160v236l-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8z" fill={PAPER} stroke={INK} strokeWidth="3" />
      <text x="100" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK} fontFamily="var(--font-geist-mono), monospace" letterSpacing="2">RECEIPT</text>
      <path d="M40 54h120" stroke={INK} strokeWidth="1.6" strokeDasharray="4 4" />
      {[78, 100, 122, 144].map((y, i) => (
        <g key={y}>
          <path d={`M40 ${y}h${[64, 52, 70, 46][i]}`} stroke={INK} strokeWidth="2.4" opacity=".55" />
          <path d={`M${160 - [26, 34, 22, 30][i]} ${y}h${[26, 34, 22, 30][i]}`} stroke={INK} strokeWidth="2.4" opacity=".55" />
        </g>
      ))}
      <path d="M40 166h120" stroke={INK} strokeWidth="2.4" />
      <text x="160" y="190" textAnchor="end" fontSize="16" fontWeight="700" fill={FELT} fontFamily="var(--font-geist-mono), monospace">₹ 5,001</text>
      <g data-part="stamp" transform="rotate(-14 96 214)">
        <rect x="56" y="196" width="82" height="34" rx="4" fill="none" stroke={STAMP} strokeWidth="3.4" />
        <text x="97" y="220" textAnchor="middle" fontSize="18" fontWeight="800" fill={STAMP} fontFamily="var(--font-geist-mono), monospace" letterSpacing="3">PAID</text>
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ Empty states */

export function EmptyLedger(props: P) {
  return (
    <Svg viewBox="0 0 240 160" {...props}>
      <ellipse cx="120" cy="148" rx="96" ry="7" fill={INK} opacity=".1" />
      <path d="M22 30c32-6 66-4 98 8 32-12 66-14 98-8v104c-32-6-66-4-98 8-32-12-66-14-98-8z" fill={BRASS_SOFT} transform="translate(5 5)" />
      <path d="M22 30c32-6 66-4 98 8 32-12 66-14 98-8v104c-32-6-66-4-98 8-32-12-66-14-98-8z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <path d="M120 38v104" stroke={INK} strokeWidth="2.4" />
      <g stroke={INK} strokeWidth="1.2" opacity=".2">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <path d={`M34 ${56 + i * 16}c26-4 52-2 76 6`} />
            <path d={`M206 ${56 + i * 16}c-26-4-52-2-76 6`} />
          </g>
        ))}
      </g>
      <g data-part="pen" transform="rotate(32 180 60)">
        <path d="M168 20h14v70l-7 12-7-12z" fill={STAMP} stroke={INK} strokeWidth="2.4" />
        <path d="M168 34h14" stroke={INK} strokeWidth="2.4" />
      </g>
    </Svg>
  );
}

export function EmptyChairs(props: P) {
  const chair = (x: number, c: string) => (
    <g transform={`translate(${x} 0)`}>
      <path d="M10 40h44v50H10z" fill={c} stroke={INK} strokeWidth="2.6" />
      <path d="M6 90h52v12H6z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <path d="M10 102v34M54 102v34" stroke={INK} strokeWidth="3" />
    </g>
  );
  return (
    <Svg viewBox="0 0 240 160" {...props}>
      <ellipse cx="120" cy="142" rx="96" ry="7" fill={INK} opacity=".1" />
      {chair(30, BRASS)}
      {chair(88, FELT)}
      {chair(146, STAMP)}
      <path d="M178 22c6-10 20-10 22 2 2 10-10 12-10 20" fill="none" stroke={INK} strokeWidth="2.6" />
      <circle cx="190" cy="54" r="2.6" fill={INK} />
    </Svg>
  );
}

export function EmptyCalendar(props: P) {
  return (
    <Svg viewBox="0 0 240 160" {...props}>
      <ellipse cx="120" cy="146" rx="80" ry="7" fill={INK} opacity=".1" />
      <path d="M70 26h100v110H70z" fill={BRASS_SOFT} transform="translate(5 5)" />
      <path d="M70 26h100v110H70z" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <path d="M70 26h100v24H70z" fill={FELT} stroke={INK} strokeWidth="2.6" />
      <g fill={INK} opacity=".25">
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => <rect key={`${r}${c}`} x={80 + c * 17} y={60 + r * 17} width="10" height="10" rx="2" />),
        )}
      </g>
      <path d="M40 60c-14 0-14 20 0 20M200 60c14 0 14 20 0 20" fill="none" stroke={STAMP} strokeWidth="2.6" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ Marks */

export function ClubMark({ className, ...props }: P) {
  return (
    <Svg viewBox="0 0 40 40" className={className} {...props}>
      <path d="M4 18 20 6l16 12z" fill={BRASS} stroke="currentColor" strokeWidth="2.4" />
      <path d="M8 18h24v16H8z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 34v-8a4 4 0 0 1 8 0v8" fill={STAMP} stroke="currentColor" strokeWidth="2.4" />
    </Svg>
  );
}
