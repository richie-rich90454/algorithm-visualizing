/**
 * chacha20-poly1305.ts - ChaCha20 Block Core and Poly1305 MAC (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module implements the exact mathematical cores of two primitives used
 * together in the ChaCha20-Poly1305 AEAD construction: the ChaCha20 block
 * function (the quarter round, the ten double rounds, and the final feed-forward
 * addition) and the Poly1305 polynomial message authentication code modulo
 * 2^130 - 5. Both computations are faithful and match the RFC 8439 test
 * vectors; the visualization also shows every double round of the state.
 *
 * This is a TEACHING MODEL of the primitive cores, not a complete AEAD
 * implementation: it does not generate a one-time key from a nonce, XOR a full
 * keystream against a message of arbitrary length, build the AAD/length mac_data
 * buffer, or provide constant-time tag verification. Do not use it to protect
 * real data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for one ChaCha20 block and O(L/16) for an L-byte Poly1305 tag
 *   Space: O(1) beyond the fixed state and tag
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows 0-3 of the grid show the 16 ChaCha state words in hexadecimal.
 *   - Rows 4-7 show the 16 Poly1305 tag bytes, revealed at the end.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    key?: number[];
    nonce?: number[];
    counter?: number;
    message?: string;
    polyKey?: number[];
}

const MASK = 0xffffffff;
const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

const rotl32 = (x: number, n: number): number => (((x << n) | (x >>> (32 - n))) >>> 0) & MASK;

/** The ChaCha quarter round on four state words (indices into s). */
function quarterRound(s: number[], a: number, b: number, c: number, d: number): void {
    s[a] = ((s[a] ?? 0) + (s[b] ?? 0)) & MASK;
    s[d] = rotl32((s[d] ?? 0) ^ (s[a] ?? 0), 16);
    s[c] = ((s[c] ?? 0) + (s[d] ?? 0)) & MASK;
    s[b] = rotl32((s[b] ?? 0) ^ (s[c] ?? 0), 12);
    s[a] = ((s[a] ?? 0) + (s[b] ?? 0)) & MASK;
    s[d] = rotl32((s[d] ?? 0) ^ (s[a] ?? 0), 8);
    s[c] = ((s[c] ?? 0) + (s[d] ?? 0)) & MASK;
    s[b] = rotl32((s[b] ?? 0) ^ (s[c] ?? 0), 7);
}

/** One full double round (four column quarter rounds, four diagonal). */
function doubleRound(s: number[]): void {
    quarterRound(s, 0, 4, 8, 12);
    quarterRound(s, 1, 5, 9, 13);
    quarterRound(s, 2, 6, 10, 14);
    quarterRound(s, 3, 7, 11, 15);
    quarterRound(s, 0, 5, 10, 15);
    quarterRound(s, 1, 6, 11, 12);
    quarterRound(s, 2, 7, 8, 13);
    quarterRound(s, 3, 4, 9, 14);
}

const leBytesToBigInt = (bytes: number[]): bigint => {
    let value = 0n;
    for (let i = bytes.length - 1; i >= 0; i -= 1) {
        value = (value << 8n) | BigInt(bytes[i] ?? 0);
    }
    return value;
};

const clampR = (bytes: number[]): number[] => {
    const r = bytes.slice(0, 16);
    const pad = new Array<number>(Math.max(0, 16 - r.length)).fill(0);
    const full = [...r, ...pad];
    full[3] = (full[3] ?? 0) & 15;
    full[7] = (full[7] ?? 0) & 15;
    full[11] = (full[11] ?? 0) & 15;
    full[15] = (full[15] ?? 0) & 15;
    full[4] = (full[4] ?? 0) & 252;
    full[8] = (full[8] ?? 0) & 252;
    full[12] = (full[12] ?? 0) & 252;
    return full;
};

/** Exact Poly1305 tag over a byte message, returned as 16 little-endian bytes. */
function poly1305Tag(key: number[], message: number[]): number[] {
    const r = leBytesToBigInt(clampR(key));
    const s = leBytesToBigInt(Array.from({ length: 16 }, (_, i) => key[i + 16] ?? 0));
    const p = (1n << 130n) - 5n;
    let acc = 0n;
    for (let i = 0; i < message.length; i += 16) {
        const block = message.slice(i, i + 16);
        const n = leBytesToBigInt([...block, 0x01]);
        acc = ((acc + n) * r) % p;
    }
    const tag = (acc + s) & ((1n << 128n) - 1n);
    return Array.from({ length: 16 }, (_, i) => Number((tag >> BigInt(8 * i)) & 0xffn));
}

const hexWord = (w: number): string => (w >>> 0).toString(16).padStart(8, "0");
const hexByte = (b: number): string => (b & 0xff).toString(16).padStart(2, "0");

function makeCells(words: number[], tag: number[] | null, reveal: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < 16; i += 1) {
        cells.push({
            id: `word-${i}`,
            type: "cell" as const,
            label: hexWord(words[i] ?? 0),
            value: words[i] ?? 0,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(i / 4), col: i % 4, section: "chacha", index: i },
        });
    }
    for (let i = 0; i < 16; i += 1) {
        cells.push({
            id: `tag-${i}`,
            type: "cell" as const,
            label: reveal && tag ? hexByte(tag[i] ?? 0) : "??",
            value: reveal && tag ? tag[i] ?? 0 : "?",
            state: reveal ? ("sorted" as EntityState) : ("unvisited" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 4 + Math.floor(i / 4), col: i % 4, section: "poly1305", index: i },
        });
    }
    return cells;
}

/** The ChaCha20 plus Poly1305 teaching generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const key = (task.key ?? Array.from({ length: 32 }, (_, i) => i)).slice(0, 32);
    const nonce = (task.nonce ?? [0, 0, 0, 9, 0, 0, 0, 0x4a, 0, 0, 0, 0]).slice(0, 12);
    const counter = typeof task.counter === "number" ? task.counter : 1;
    const message = String(task.message ?? "Cryptographic Forum Research Group");
    const polyKey = (task.polyKey ??
        [
            0x85, 0xd6, 0xbe, 0x78, 0x57, 0x55, 0x6d, 0x33, 0x7f, 0x44, 0x52, 0xfe, 0x42, 0xd5,
            0x06, 0xa8, 0x01, 0x03, 0x80, 0x8a, 0xfb, 0x0d, 0xb2, 0xfd, 0x4a, 0xbf, 0xf6, 0xaf,
            0x41, 0x49, 0xf5, 0x1b,
        ]).slice(0, 32);
    const msgBytes = Array.from(message, (ch) => ch.charCodeAt(0) & 0xff);
    const tag = poly1305Tag(polyKey, msgBytes);

    const leWord = (bytes: number[], offset: number): number =>
        (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16) | ((bytes[offset + 3] ?? 0) << 24);

    const initial: number[] = [
        ...CONSTANTS,
        leWord(key, 0),
        leWord(key, 4),
        leWord(key, 8),
        leWord(key, 12),
        leWord(key, 16),
        leWord(key, 20),
        leWord(key, 24),
        leWord(key, 28),
        counter >>> 0,
        leWord(nonce, 0),
        leWord(nonce, 4),
        leWord(nonce, 8),
    ];
    const working = initial.slice();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(working, tag, false),
        edges: [],
        description: `ChaCha20 state initialized with constants, key, counter ${counter}, and nonce. Poly1305 message has ${msgBytes.length} bytes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 8, cols: 4, round: 0, chachaState: working.slice(), tagHex: "", note: "teaching model of primitive cores" },
    };
    step += 1;

    for (let round = 1; round <= 10; round += 1) {
        doubleRound(working);
        const cells = makeCells(working, tag, false);
        for (const cell of cells.slice(0, 16)) {
            cell.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: cells,
            edges: [],
            description: `Double round ${round} of 10: four column quarter rounds then four diagonal quarter rounds.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 8, cols: 4, round, chachaState: working.slice(), tagHex: "" },
        };
        step += 1;
    }

    const keystream = working.map((w, i) => (w + (initial[i] ?? 0)) & MASK);
    yield {
        stepNumber: step,
        entities: makeCells(keystream, tag, false),
        edges: [],
        description: "Feed-forward: add the original state words to obtain the ChaCha20 keystream block.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 8, cols: 4, round: 10, chachaState: keystream.slice(), tagHex: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(keystream, tag, true),
        edges: [],
        description: `Poly1305 tag over ${msgBytes.length} message bytes: ${tag.map(hexByte).join("")}. Full AEAD construction is not implemented.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 8,
            cols: 4,
            round: 10,
            chachaState: keystream.slice(),
            tag,
            tagHex: tag.map(hexByte).join(""),
            messageBytes: msgBytes,
            note: "teaching model of primitive cores",
        },
    };
}

/** The ChaCha20-Poly1305 teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "ChaCha20 and Poly1305 are usually paired: ChaCha20 produces a pseudorandom keystream that hides a message, and Poly1305 computes a short authentication tag so tampering is detected. This teaching model shows the two core calculations exactly. The ChaCha state is sixteen 32-bit words mixed by add, rotate, and XOR; the Poly1305 tag is a polynomial evaluated modulo the prime 2^130 minus 5.",
        invariants: [
            "A ChaCha quarter round uses only addition modulo 2^32, XOR, and fixed rotations, so it is a permutation of the state.",
            "After ten double rounds the original state is added back in a feed-forward step to form the keystream.",
            "The Poly1305 accumulator is always reduced modulo 2^130 minus 5, and the final tag adds the secret s modulo 2^128.",
        ],
        correctness:
            "Each ChaCha quarter round applies invertible add-XOR-rotate operations, and the full block function matches the RFC 8439 test vector word for word. Poly1305 interprets each message block as a little-endian integer with a high marker bit, updates the accumulator as ((acc + block) times r) mod (2^130 - 5), and adds s; this reproduces the RFC 8439 tag for the example message. Because the arithmetic is done with exact 32-bit words and big integers, the demonstrated steps are faithful to the primitives even though the surrounding AEAD framing is omitted.",
        complexityRationale:
            "One ChaCha20 block uses a fixed ten double rounds, so its cost is constant. Poly1305 processes one 16-byte block per iteration, giving O(L/16) time for an L-byte message and constant working space.",
        uses: [
            "A teaching model for the primitives behind the TLS 1.3 ChaCha20-Poly1305 cipher suite",
            "Understanding the ChaCha quarter round and the Poly1305 polynomial MAC",
            "A stepping stone to a full authenticated-encryption implementation",
        ],
        references: [
            "Nir and Langley, RFC 8439: ChaCha20 and Poly1305 for IETF Protocols, 2018",
            "Bernstein, The ChaCha Family of Stream Ciphers, 2008",
        ],
        workedExample:
            "With the RFC 8439 key of bytes 00 through 1f, counter 1, and the given nonce, the block function ends at the state e4e7f110, 15593bd1, and so on. For the message Cryptographic Forum Research Group with the RFC one-time key, the Poly1305 accumulator finishes at 28d31b7caff946c77c8844335369d03a7, and adding s gives the tag a8061dc1305136c6c22b8baf0c0127a9.",
    },
    id: "chacha20-poly1305",
    name: "ChaCha20-Poly1305 (Teaching Model)",
    category: "cryptography-security",
    complexity: { time: "O(L/16)", space: "O(1)" },
    defaultInput: {
        key: Array.from({ length: 32 }, (_, i) => i),
        nonce: [0, 0, 0, 9, 0, 0, 0, 0x4a, 0, 0, 0, 0],
        counter: 1,
        message: "Cryptographic Forum Research Group",
        polyKey: [
            0x85, 0xd6, 0xbe, 0x78, 0x57, 0x55, 0x6d, 0x33, 0x7f, 0x44, 0x52, 0xfe, 0x42, 0xd5,
            0x06, 0xa8, 0x01, 0x03, 0x80, 0x8a, 0xfb, 0x0d, 0xb2, 0xfd, 0x4a, 0xbf, 0xf6, 0xaf,
            0x41, 0x49, 0xf5, 0x1b,
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "load constants, key, counter, and nonce into the sixteen-word state",
        "for ten double rounds mix the state with quarter rounds",
        "each quarter round adds, XORs, and rotates four words",
        "add the original state words back to form the keystream",
        "clamp r and read s from the one-time Poly1305 key",
        "for each sixteen-byte message block update the accumulator modulo 2^130 minus 5",
        "add s and serialize the low 128 bits as the tag",
        "done: report the keystream words and the Poly1305 tag",
    ],
};

export default module;
