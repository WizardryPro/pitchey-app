import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createOtsForDigest, upgradeOts, hex, fromBase64, __testing,
} from '../opentimestamps';

const { applyOp, buildDetached, parseDetached, serializeTimestampBytes, collectPending, mergeTimestamp, anyBitcoin, OP_SHA256, OP_APPEND } = __testing;

// Build a realistic tree: digest --append(nonce)--> --sha256--> [pending @ alice]
async function makePendingTree() {
  const digest = new Uint8Array(32).fill(1);
  const nonce = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const m1 = await applyOp({ tag: OP_APPEND, arg: nonce }, digest);
  const m2 = await applyOp({ tag: OP_SHA256 }, m1);
  const uri = 'https://alice.btc.calendar.opentimestamps.org';
  const pendingNode = { msg: m2, attestations: [{ kind: 'pending' as const, uri }], ops: [] };
  const root = {
    msg: digest, attestations: [], ops: [
      { op: { tag: OP_APPEND, arg: nonce }, child: {
        msg: m1, attestations: [], ops: [
          { op: { tag: OP_SHA256 }, child: pendingNode },
        ],
      } },
    ],
  };
  return { digest, root, pendingNode, commitment: m2, uri };
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenTimestamps binary codec', () => {
  it('round-trips a detached .ots byte-for-byte', async () => {
    const { digest, root } = await makePendingTree();
    const bytes = buildDetached(digest, root);
    const parsed = await parseDetached(bytes);
    const rebuilt = buildDetached(parsed.digest, parsed.root);
    expect(hex(rebuilt)).toBe(hex(bytes));            // exact round-trip
    expect(hex(parsed.digest)).toBe(hex(digest));
  });

  it('locates the pending attestation and its commitment digest', async () => {
    const { digest, root, commitment, uri } = await makePendingTree();
    const parsed = await parseDetached(buildDetached(digest, root));
    const pending = collectPending(parsed.root);
    expect(pending).toHaveLength(1);
    expect(pending[0].uri).toBe(uri);
    expect(hex(pending[0].commitment)).toBe(hex(commitment));  // ops were executed correctly
    expect(anyBitcoin(parsed.root).found).toBe(false);
  });

  it('grafts a Bitcoin attestation onto a pending node', async () => {
    const { digest, root, commitment } = await makePendingTree();
    const parsed = await parseDetached(buildDetached(digest, root));
    const node = collectPending(parsed.root)[0].node;
    mergeTimestamp(node, { msg: commitment, attestations: [{ kind: 'bitcoin', height: 800123 }], ops: [] });
    const btc = anyBitcoin(parsed.root);
    expect(btc.found).toBe(true);
    expect(btc.height).toBe(800123);
    // survives a re-serialize → re-parse (the upgraded file is still well-formed)
    const reparsed = await parseDetached(buildDetached(parsed.digest, parsed.root));
    expect(anyBitcoin(reparsed.root).found).toBe(true);
  });
});

describe('OpenTimestamps network glue', () => {
  it('createOtsForDigest submits and returns a parseable pending proof', async () => {
    const digest = new Uint8Array(32).fill(7);
    const respBody = serializeTimestampBytes({ msg: digest, attestations: [{ kind: 'pending', uri: 'https://x' }], ops: [] });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => respBody.buffer })));

    const out = await createOtsForDigest(hex(digest), ['https://x']);
    expect(out).not.toBeNull();
    expect(out!.calendars).toEqual(['https://x']);
    const parsed = await parseDetached(fromBase64(out!.otsBase64));
    expect(hex(parsed.digest)).toBe(hex(digest));
    expect(collectPending(parsed.root)[0].uri).toBe('https://x');
  });

  it('createOtsForDigest returns null when every calendar fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await createOtsForDigest('00'.repeat(32), ['https://x'])).toBeNull();
  });

  it('upgradeOts grafts a Bitcoin attestation from the calendar response', async () => {
    const digest = new Uint8Array(32).fill(9);
    const uri = 'https://cal.example';
    // pending proof committed directly at the digest (uri = cal.example)
    const pendingOts = buildDetached(digest, { msg: digest, attestations: [{ kind: 'pending', uri }], ops: [] });
    const { toBase64 } = await import('../opentimestamps');
    const pendingB64 = toBase64(pendingOts);

    // calendar's /timestamp/<commitment> returns a Bitcoin attestation at the digest
    const upgradeBody = serializeTimestampBytes({ msg: digest, attestations: [{ kind: 'bitcoin', height: 815000 }], ops: [] });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe(`${uri}/timestamp/${hex(digest)}`);
      return { ok: true, arrayBuffer: async () => upgradeBody.buffer };
    }));

    const res = await upgradeOts(pendingB64);
    expect(res).not.toBeNull();
    expect(res!.complete).toBe(true);
    expect(res!.blockHeight).toBe(815000);
  });

  it('upgradeOts stays pending (complete:false) on 404', async () => {
    const digest = new Uint8Array(32).fill(3);
    const pendingOts = buildDetached(digest, { msg: digest, attestations: [{ kind: 'pending', uri: 'https://c' }], ops: [] });
    const { toBase64 } = await import('../opentimestamps');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const res = await upgradeOts(toBase64(pendingOts));
    expect(res!.complete).toBe(false);
  });
});
