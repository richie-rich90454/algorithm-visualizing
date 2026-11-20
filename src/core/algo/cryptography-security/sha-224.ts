/**
 * sha-224.ts - SHA-224 Cryptographic Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SHA-224 is the truncated variant of the SHA-2 family defined in FIPS 180-4.
 * It runs the SHA-256 compression function with a different set of eight
 * initial hash values and outputs the first 224 bits of the resulting chain.
 * The message is padded, split into 512-bit blocks, and absorbed with 64
 * rounds of additions, rotations, and bitwise choices per block.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(64 * blocks) word operations for blocks of 512 bits
 *   Space: O(blocks) for the padded message words
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per hash-chain word shows its current 32-bit value.
 *   - The chain word updated by the current round group is highlighted.
 *   - meta tracks the block index, round index, and the partial digest.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INITIAL = [
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
    0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
];

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

interface Sha224Input {
    message?: string;
}

const rotr = (value: number, bits: number): number => ((value >>> bits) | (value << (32 - bits))) >>> 0;

/** Pad the UTF-8/ASCII message bytes into 512-bit blocks of 32-bit words. */
export function padMessage(message: string): number[] {
    const bytes = Array.from(message, (ch) => ch.charCodeAt(0) & 0xff);
    const bitLength = bytes.length * 8;
    const padded = [...bytes, 0x80];
    while (padded.length % 64 !== 56) padded.push(0);
    for (let i = 7; i >= 0; i -= 1) padded.push((bitLength / (2 ** (8 * i))) & 0xff);
    const words: number[] = [];
    for (let i = 0; i < padded.length; i += 4) {
        words.push(((padded[i] ?? 0) << 24 | (padded[i + 1] ?? 0) << 16 | (padded[i + 2] ?? 0) << 8 | (padded[i + 3] ?? 0)) >>> 0);
    }
    return words;
}

/** Apply one SHA-256 compression step to the eight-word chain. */
export function compress(chain: number[], block: number[]): number[] {
    const w = [...block];
    for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15] ?? 0;
        const b = w[i - 2] ?? 0;
        const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
        const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
        w[i] = (((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0);
    }
    let [a, b, c, d, e, f, g, h] = chain;
    for (let i = 0; i < 64; i += 1) {
        const s1 = rotr(e ?? 0, 6) ^ rotr(e ?? 0, 11) ^ rotr(e ?? 0, 25);
        const ch = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
        const t1 = (((h ?? 0) + s1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0);
        const s0 = rotr(a ?? 0, 2) ^ rotr(a ?? 0, 13) ^ rotr(a ?? 0, 22);
        const maj = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
        const t2 = (s0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = ((d ?? 0) + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
    }
    return [a ?? 0, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0, g ?? 0, h ?? 0].map(
        (value, index) => (value + (chain[index] ?? 0)) >>> 0,
    );
}

/** Compute the 56-character hexadecimal SHA-224 digest of a message. */
export function sha224(message: string): string {
    const words = padMessage(message);
    let chain = [...INITIAL];
    for (let offset = 0; offset < words.length; offset += 16) {
        chain = compress(chain, words.slice(offset, offset + 16));
    }
    return chain.slice(0, 7).map((word) => word.toString(16).padStart(8, "0")).join("");
}

function makeEntities(chain: number[], active: number): VisualEntity[] {
    return chain.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: value.toString(16).padStart(8, "0"),
        value,
        state: (index === active ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Sha224Input | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const words = padMessage(message);
    const blocks = words.length / 16;
    let chain = [...INITIAL];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(chain, -1),
        edges: [],
        description: `Hashing a ${message.length}-character message with SHA-224 over ${blocks} block(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { blocks, rounds: 0, digest: sha224(message) },
    };
    step += 1;

    for (let block = 0; block < blocks; block += 1) {
        chain = compress(chain, words.slice(block * 16, block * 16 + 16));
        yield {
            stepNumber: step,
            entities: makeEntities(chain, block % 8),
            edges: [],
            description: `Block ${block + 1} absorbed: sixty-four rounds update the eight-word hash chain.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { blocks, block: block + 1, rounds: (block + 1) * 64, digest: sha224(message) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(chain, -1),
        edges: [],
        description: `SHA-224 digest: ${sha224(message)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { blocks, digest: sha224(message), rounds: blocks * 64 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SHA-224 reuses the SHA-256 mixing machinery but starts from eight different seed words and keeps only seven of them at the end. Each message block schedule expands sixteen input words into sixty-four, and every round folds a nonlinear choice and a majority function into the running chain, which makes reversing or colliding it infeasible.",
        invariants: [
            "Every chain word is a 32-bit unsigned value after each addition.",
            "The message schedule extends sixteen words to sixty-four using only rotations and shifts.",
            "Compression updates a working copy and adds it back to the incoming chain.",
        ],
        correctness:
            "The compression round is the SHA-256 round proved in FIPS 180-4: the chosen rotations and nonlinear functions preserve the diffusion properties that make finding a collision or preimage computationally infeasible. Starting from the SHA-224-specific initialization and truncating to seven words yields the standardized 224-bit digest.",
        complexityRationale:
            "Each 512-bit block needs sixty-four rounds of constant work, so hashing an n-byte message takes O(64 * blocks) word operations. The padded schedule holds sixty-four words per block, giving O(blocks) space for the visualization.",
        uses: [
            "Digital signatures and certificates that specify a 224-bit hash",
            "Message integrity checks where a shorter digest is desirable",
            "Deterministic key derivation and pseudorandom generation",
        ],
        references: [
            "NIST FIPS 180-4, Secure Hash Standard",
            "NIST SP 800-107, Recommendation for Applications Using Approved Hash Algorithms",
        ],
        workedExample:
            "Padding the message 'abc' produces one 512-bit block. Sixty-four rounds mix the expanded schedule into the SHA-224 initialization, and the first seven chain words are written as 23097d22 3405d822 8642a477 bda255b3 2aadbce4 bda0b3f7 e36c9da7.",
    },
    id: "sha-224",
    name: "SHA-224 Hash",
    category: "cryptography-security",
    complexity: { time: "O(64 * blocks)", space: "O(blocks)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the message and split it into 512-bit blocks",
        "initialize the eight chain words with the SHA-224 constants",
        "for each block, expand sixteen words into a sixty-four word schedule",
        "run sixty-four rounds of rotations, choices, and additions",
        "add the working variables back into the chain",
        "concatenate the first seven chain words in hexadecimal",
        "done: the 224-bit digest is the result",
    ],
};

export default module;
