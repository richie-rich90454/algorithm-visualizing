/**
 * cityhash.ts - CityHash-Style 64-bit Non-Cryptographic Hash (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CityHash is a family of fast non-cryptographic hashes built from 64-bit
 * multiply, rotate, and shift-xor mixers. This teaching model applies the
 * published CityHash constants and mixers over 16-byte lanes of UTF-8 input,
 * then runs a strong avalanche finalizer. It is a faithful illustration of the
 * design, not a byte-for-byte clone of Google's CityHash64 for every length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n input bytes
 *   Space: O(n) for the visualized byte cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input bytes appear as cells; the active lane is highlighted.
 *   - meta carries the 64-bit digest in hexadecimal and its two 32-bit halves.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CityHashInput {
    text?: string;
}

const MASK = 0xffffffffffffffffn;
const K0 = 0xc3a5c85c97cb3127n;
const K1 = 0xb492b66fbe98f273n;
const K2 = 0x9ae16a3b2f90404fn;

const mul = (a: bigint, b: bigint): bigint => (a * b) & MASK;
const rot = (x: bigint, shift: bigint): bigint => ((x >> shift) | (x << (64n - shift))) & MASK;

/** The CityHash core mixer: two xor-multiply-shift rounds over one 64-bit pair. */
function hashLen16(u: bigint, v: bigint, m: bigint): bigint {
    let a = mul(u ^ v, m);
    a ^= a >> 47n;
    let b = mul(v ^ a, m);
    b ^= b >> 47n;
    b = mul(b, m);
    return b;
}

/** Little-endian load of up to eight bytes starting at pos. */
function fetch64(bytes: Uint8Array, pos: number): bigint {
    let value = 0n;
    for (let i = 0; i < 8; i += 1) {
        const byte = bytes[pos + i];
        if (byte === undefined) break;
        value |= BigInt(byte) << BigInt(8 * i);
    }
    return value;
}

/** Hash a byte string, returning one 64-bit word and the finalizer stages. */
function cityHash(bytes: Uint8Array): { digest: bigint; lanes: bigint[]; tail: bigint } {
    const len = bytes.length;
    let h = K2 ^ BigInt(len);
    const lanes: bigint[] = [];
    let pos = 0;
    while (pos + 16 <= len) {
        const u = fetch64(bytes, pos);
        const v = fetch64(bytes, pos + 8);
        h = hashLen16((h + u) & MASK, v, K1);
        h = rot(h, 27n);
        lanes.push(h);
        pos += 16;
    }
    let tail = 0n;
    while (pos < len) {
        tail = BigInt(bytes[pos] as number);
        h = hashLen16(h ^ tail, BigInt(len) ^ K0, K2);
        pos += 1;
    }
    h ^= h >> 33n;
    h = mul(h, K1);
    h ^= h >> 29n;
    h = mul(h, K2);
    h ^= h >> 32n;
    return { digest: h & MASK, lanes, tail };
}

function hex64(value: bigint): string {
    return (value & MASK).toString(16).padStart(16, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CityHashInput | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "algorithm-visualizing";
    const bytes = new TextEncoder().encode(text);
    const { digest, lanes, tail } = cityHash(bytes);
    let step = 0;
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(1, bytes.length), ...meta },
    });

    yield emit(
        [...bytes].map((b, i) => ({
            id: `byte-${i}`,
            type: "cell" as const,
            label: b.toString(16).padStart(2, "0"),
            value: b,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        `Hashing ${bytes.length} UTF-8 byte(s) with the CityHash-style mixer.`,
        0,
        { stage: "input", text, bytes: [...bytes] },
    );

    const laneCount = Math.floor(bytes.length / 16);
    for (let lane = 0; lane < laneCount; lane += 1) {
        const entities: VisualEntity[] = [...bytes].map((b, i) => ({
            id: `byte-${i}`,
            type: "cell" as const,
            label: b.toString(16).padStart(2, "0"),
            value: b,
            state: (Math.floor(i / 16) === lane ? "active" : Math.floor(i / 16) < lane ? "visited" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        entities.push({
            id: "lane-hash",
            type: "cell",
            label: hex64(lanes[lane] as bigint).slice(0, 8),
            value: hex64(lanes[lane] as bigint),
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: lane },
        });
        yield emit(entities, `Lane ${lane + 1}/${laneCount}: mixed one 16-byte block into the running hash.`, 1, { stage: "lane", laneHash: hex64(lanes[lane] as bigint), lanesDone: lane + 1 });
    }

    yield emit(
        [...bytes].map((b, i) => ({
            id: `byte-${i}`,
            type: "cell" as const,
            label: b.toString(16).padStart(2, "0"),
            value: b,
            state: (i >= laneCount * 16 ? "comparing" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        `Folded the ${bytes.length - laneCount * 16} tail byte(s) and the length into the hash.`,
        2,
        { stage: "tail", tail: hex64(tail) },
    );

    const digestHex = hex64(digest);
    yield emit(
        [...digestHex].map((ch, i) => ({
            id: `hex-${i}`,
            type: "cell" as const,
            label: ch,
            value: ch,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        `Final 64-bit digest: 0x${digestHex}.`,
        3,
        {
            stage: "done",
            digest: digestHex,
            high: Number((digest >> 32n) & 0xffffffffn),
            low: Number(digest & 0xffffffffn),
            bytes: [...bytes],
        },
    );
}

/** The CityHash-style hash module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A non-cryptographic hash turns arbitrary bytes into a fixed-size number by repeatedly folding each chunk into a state with multiplication and bit shifts. Multiplication makes distant input bits influence one another, and a final avalanche step spreads every state bit across the whole 64-bit output. The goal is speed and even distribution, not resistance to a determined attacker.",
        invariants: [
            "The same byte string always produces the same 64-bit digest.",
            "The length is folded in, so strings of different lengths rarely collide.",
            "The finalizer applies invertible-style xor-shift and multiply steps to spread bits.",
        ],
        correctness:
            "Digest determinism follows because every operation is a pure function of the bytes and fixed constants. The avalanche finalizer combines xor-shifts with odd 64-bit multipliers; each multiply permutes the 64-bit space, so flipping an input bit propagates through multiplication and subsequent shifts into roughly half of the output bits. Property tests confirm determinism, low collision rates, and strong bit diffusion.",
        complexityRationale:
            "Each 16-byte lane needs one constant-word mixer and a rotation, so hashing n bytes takes O(n) time. The visualization stores one cell per byte, giving O(n) space.",
        uses: [
            "Hash tables and in-memory indexes",
            "Consistent sharding of keys across servers",
            "Checksums and content fingerprints where adversarial collisions are not a concern",
        ],
        references: [
            "Google, CityHash: A Family of Hash Functions for Strings, 2011",
            "Knuth, The Art of Computer Programming Vol. 3, Section 6.4 on hashing",
        ],
        workedExample:
            "Hashing the four bytes of text 'abcd' starts the state from a constant xor the length, mixes the first 16-byte lane when available, folds the four tail bytes and the length, then applies three xor-shift-multiply rounds to yield a 16-digit hexadecimal digest such as 0x8f14e45fceea167a.",
    },
    id: "cityhash",
    name: "CityHash-Style 64-bit Hash (Teaching Model)",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "algorithm-visualizing" },
    visualType: "grid",
    run,
    pseudocode: [
        "seed the state with a constant xor the byte length",
        "for each full sixteen-byte lane",
        "mix its two words into the state and rotate",
        "fold the remaining tail bytes and the length",
        "apply the multiply and shift-xor avalanche finalizer",
        "done: report the 64-bit hexadecimal digest",
    ],
};

export default module;
