// Minimal, dependency-free OpenTimestamps client for Cloudflare Workers.
//
// Why hand-rolled: the `javascript-opentimestamps` npm package pulls bitcoinjs-lib
// / tiny-secp256k1 (native/WASM) which do NOT bundle into a browser-target Worker.
// We only need three things, and none of them require Bitcoin verification:
//   1. SUBMIT a SHA-256 digest to public OTS calendars (establishes the anchor — the
//      timestamp is fixed the moment the calendar accepts it and includes it in its
//      next Bitcoin tx; everything after is just *retrieval*).
//   2. BUILD a standard .ots detached-proof file from the calendar response(s).
//   3. UPGRADE a pending proof to a complete (Bitcoin-attested) one once confirmed.
// Independent verification is offloaded to standard tooling (the `ots` CLI or
// https://opentimestamps.org) — we never reimplement Bitcoin consensus.
//
// Format references (python-opentimestamps): serialize.py (LEB128 varuint, varbytes),
// timestamp.py (tree: 0xff = "another edge follows", 0x00 = attestation marker),
// op.py (op tags), notary.py (attestation magics).

// ---- constants ----------------------------------------------------------------

// b'\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94' (31 bytes)
const MAGIC = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73,
  0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);

const OP_SHA256 = 0x08;
const OP_APPEND = 0xf0;
const OP_PREPEND = 0xf1;
const OP_REVERSE = 0xf2;
const OP_HEXLIFY = 0xf3;

const ATT_PENDING = new Uint8Array([0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e]);
const ATT_BITCOIN = new Uint8Array([0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01]);

// Public calendars (the standard whitelist). We submit to all; we only need one to
// survive to Bitcoin, but redundancy protects against any single calendar vanishing.
export const DEFAULT_CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.opentimestamps.org',
  'https://btc.calendar.catallaxy.com',
];

const ACCEPT = 'application/vnd.opentimestamps.v1';

// ---- model --------------------------------------------------------------------

type Attestation =
  | { kind: 'pending'; uri: string }
  | { kind: 'bitcoin'; height: number }
  | { kind: 'unknown'; magic: Uint8Array; payload: Uint8Array };

interface Op { tag: number; arg?: Uint8Array }

interface Timestamp {
  msg: Uint8Array;                              // message digest at this node
  attestations: Attestation[];
  ops: Array<{ op: Op; child: Timestamp }>;
}

// ---- byte helpers -------------------------------------------------------------

class Reader {
  pos = 0;
  constructor(private buf: Uint8Array) {}
  get remaining() { return this.buf.length - this.pos; }
  byte(): number {
    if (this.pos >= this.buf.length) throw new Error('OTS: unexpected end of stream');
    return this.buf[this.pos++];
  }
  peek(): number { return this.buf[this.pos]; }
  bytes(n: number): Uint8Array {
    if (this.pos + n > this.buf.length) throw new Error('OTS: read past end');
    return this.buf.slice(this.pos, (this.pos += n));
  }
  varuint(): number {
    let result = 0, shift = 0, b: number;
    do { b = this.byte(); result += (b & 0x7f) * 2 ** shift; shift += 7; } while (b & 0x80);
    return result;
  }
  varbytes(): Uint8Array { return this.bytes(this.varuint()); }
}

function pushVaruint(out: number[], n: number) {
  if (n === 0) { out.push(0); return; }
  while (n > 0) { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 0x80; out.push(b); }
}
function pushVarbytes(out: number[], b: Uint8Array) { pushVaruint(out, b.length); out.push(...b); }

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r;
}
function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
export function hex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}
function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}
export function toBase64(b: Uint8Array): string {
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s);
}
export function fromBase64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}

// ---- op execution -------------------------------------------------------------

async function applyOp(op: Op, msg: Uint8Array): Promise<Uint8Array> {
  switch (op.tag) {
    case OP_APPEND: return concat(msg, op.arg!);
    case OP_PREPEND: return concat(op.arg!, msg);
    case OP_REVERSE: return msg.slice().reverse();
    case OP_HEXLIFY: return new TextEncoder().encode(hex(msg));
    case OP_SHA256: return new Uint8Array(await crypto.subtle.digest('SHA-256', msg));
    // ripemd160 / sha1 aren't in WebCrypto; they don't appear on the calendar→Bitcoin
    // path, so we abort the upgrade rather than guess (the pending proof is kept).
    default: throw new Error(`OTS: unsupported op 0x${op.tag.toString(16)}`);
  }
}

// ---- parse / serialize --------------------------------------------------------

function readAttestation(r: Reader): Attestation {
  const magic = r.bytes(8);
  const payload = r.varbytes();
  const pr = new Reader(payload);
  if (eq(magic, ATT_PENDING)) return { kind: 'pending', uri: new TextDecoder().decode(pr.varbytes()) };
  if (eq(magic, ATT_BITCOIN)) return { kind: 'bitcoin', height: pr.varuint() };
  return { kind: 'unknown', magic, payload };
}

function writeAttestation(out: number[], att: Attestation) {
  if (att.kind === 'pending') {
    out.push(...ATT_PENDING);
    const inner: number[] = []; pushVarbytes(inner, new TextEncoder().encode(att.uri));
    pushVarbytes(out, new Uint8Array(inner));
  } else if (att.kind === 'bitcoin') {
    out.push(...ATT_BITCOIN);
    const inner: number[] = []; pushVaruint(inner, att.height);
    pushVarbytes(out, new Uint8Array(inner));
  } else {
    out.push(...att.magic); pushVarbytes(out, att.payload);
  }
}

function readOp(r: Reader, tag: number): Op {
  if (tag === OP_APPEND || tag === OP_PREPEND) return { tag, arg: r.varbytes() };
  return { tag };
}

// Parse a Timestamp tree from the current reader position, given the message at this
// node. async because computing each op's result digest may require SHA-256.
async function parseTimestamp(r: Reader, msg: Uint8Array): Promise<Timestamp> {
  const ts: Timestamp = { msg, attestations: [], ops: [] };
  // Edges: every edge but the last is prefixed with 0xff. 0x00 marks an attestation
  // edge; anything else is an op tag.
  for (;;) {
    let tag = r.byte();
    const isLast = tag !== 0xff;
    if (!isLast) tag = r.byte();      // consume the actual edge tag after 0xff
    if (tag === 0x00) {
      ts.attestations.push(readAttestation(r));
    } else {
      const op = readOp(r, tag);
      const child = await parseTimestamp(r, await applyOp(op, msg));
      ts.ops.push({ op, child });
    }
    if (isLast) break;
  }
  return ts;
}

function serializeTimestamp(out: number[], ts: Timestamp) {
  const edges = ts.attestations.length + ts.ops.length;
  if (edges === 0) throw new Error('OTS: empty timestamp');
  let i = 0;
  const writeEdge = (fn: () => void) => { if (i < edges - 1) out.push(0xff); fn(); i++; };
  for (const att of ts.attestations) writeEdge(() => { out.push(0x00); writeAttestation(out, att); });
  for (const { op, child } of ts.ops) writeEdge(() => {
    out.push(op.tag);
    if (op.arg) pushVarbytes(out, op.arg);
    serializeTimestamp(out, child);
  });
}

// Parse a full detached .ots file → digest + root timestamp.
async function parseDetached(bytes: Uint8Array): Promise<{ digest: Uint8Array; root: Timestamp }> {
  const r = new Reader(bytes);
  if (!eq(r.bytes(MAGIC.length), MAGIC)) throw new Error('OTS: bad magic');
  r.varuint();                                  // major version
  const hashOp = r.byte();
  if (hashOp !== OP_SHA256) throw new Error(`OTS: unexpected file hash op 0x${hashOp.toString(16)}`);
  const digest = r.bytes(32);
  const root = await parseTimestamp(r, digest);
  return { digest, root };
}

function buildDetached(digest: Uint8Array, timestamp: Timestamp): Uint8Array {
  const out: number[] = [...MAGIC, 0x01, OP_SHA256, ...digest];
  serializeTimestamp(out, timestamp);
  return new Uint8Array(out);
}

// Merge timestamp b into a (same msg). Union of attestations + ops; ops with the same
// tag+arg are merged recursively. Used to combine multiple calendars' responses, and
// to graft an upgrade response onto a pending node.
function mergeTimestamp(a: Timestamp, b: Timestamp) {
  for (const att of b.attestations) {
    const dup = a.attestations.some((x) =>
      (x.kind === 'pending' && att.kind === 'pending' && x.uri === att.uri) ||
      (x.kind === 'bitcoin' && att.kind === 'bitcoin' && x.height === att.height));
    if (!dup) a.attestations.push(att);
  }
  for (const be of b.ops) {
    const match = a.ops.find((ae) =>
      ae.op.tag === be.op.tag &&
      ((!ae.op.arg && !be.op.arg) || (ae.op.arg && be.op.arg && eq(ae.op.arg, be.op.arg))));
    if (match) mergeTimestamp(match.child, be.child);
    else a.ops.push(be);
  }
}

function anyBitcoin(ts: Timestamp): { found: boolean; height?: number } {
  for (const att of ts.attestations) if (att.kind === 'bitcoin') return { found: true, height: att.height };
  for (const { child } of ts.ops) { const r = anyBitcoin(child); if (r.found) return r; }
  return { found: false };
}

// Collect every pending attestation with the digest committed at that node.
function collectPending(ts: Timestamp, out: Array<{ uri: string; commitment: Uint8Array; node: Timestamp }> = []) {
  for (const att of ts.attestations) if (att.kind === 'pending') out.push({ uri: att.uri, commitment: ts.msg, node: ts });
  for (const { child } of ts.ops) collectPending(child, out);
  return out;
}

// ---- network ------------------------------------------------------------------

async function submitDigest(calendar: string, digest: Uint8Array): Promise<Timestamp | null> {
  try {
    const res = await fetch(`${calendar.replace(/\/+$/, '')}/digest`, {
      method: 'POST',
      headers: { 'Accept': ACCEPT, 'Content-Type': 'application/octet-stream' },
      body: digest,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = new Uint8Array(await res.arrayBuffer());
    return await parseTimestamp(new Reader(body), digest);
  } catch (err) {
    console.error(`OTS submit ${calendar} failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ---- public API ---------------------------------------------------------------

// Submit a SHA-256 digest (hex) to the calendars and return a pending .ots file
// (base64) plus the calendars that accepted it. Returns null if every calendar fails.
export async function createOtsForDigest(
  digestHex: string,
  calendars: string[] = DEFAULT_CALENDARS,
): Promise<{ otsBase64: string; calendars: string[] } | null> {
  const digest = fromHex(digestHex);
  if (digest.length !== 32) return null;

  const results = await Promise.all(calendars.map((c) => submitDigest(c, digest)));
  let root: Timestamp | null = null;
  const accepted: string[] = [];
  results.forEach((ts, i) => {
    if (!ts) return;
    accepted.push(calendars[i]);
    if (!root) root = ts; else mergeTimestamp(root, ts);
  });
  if (!root) return null;
  return { otsBase64: toBase64(buildDetached(digest, root)), calendars: accepted };
}

// Try to upgrade a pending proof to a Bitcoin-attested one. Contacts each pending
// calendar's /timestamp/<commitment> endpoint and grafts any returned (Bitcoin) path.
// Returns the (possibly unchanged) proof + whether it now carries a Bitcoin attestation.
// Never throws — on any failure the original proof is returned unchanged.
export async function upgradeOts(
  otsBase64: string,
): Promise<{ otsBase64: string; complete: boolean; blockHeight?: number } | null> {
  try {
    const { digest, root } = await parseDetached(fromBase64(otsBase64));
    let changed = false;

    for (const p of collectPending(root)) {
      try {
        const url = `${p.uri.replace(/\/+$/, '')}/timestamp/${hex(p.commitment)}`;
        const res = await fetch(url, { headers: { 'Accept': ACCEPT }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;                  // 404 = not anchored yet
        const body = new Uint8Array(await res.arrayBuffer());
        const upgraded = await parseTimestamp(new Reader(body), p.commitment);
        mergeTimestamp(p.node, upgraded);       // graft Bitcoin path onto the node
        changed = true;
      } catch { /* skip this calendar, keep others */ }
    }

    const btc = anyBitcoin(root);
    if (!changed && !btc.found) return { otsBase64, complete: false };
    return { otsBase64: toBase64(buildDetached(digest, root)), complete: btc.found, blockHeight: btc.height };
  } catch (err) {
    console.error('OTS upgrade failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Internals exposed for unit tests only — not part of the public API.
function serializeTimestampBytes(ts: Timestamp): Uint8Array {
  const o: number[] = []; serializeTimestamp(o, ts); return new Uint8Array(o);
}
export const __testing = {
  applyOp, buildDetached, parseDetached, parseTimestamp, serializeTimestampBytes,
  collectPending, mergeTimestamp, anyBitcoin, Reader, eq,
  OP_SHA256, OP_APPEND,
};
