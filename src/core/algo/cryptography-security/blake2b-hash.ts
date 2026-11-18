/**
 * blake2b-hash.ts - BLAKE2-Style Compression (Toy 32-Bit Model)
 *
 * A deliberately small BLAKE2-like compression function: the G mixing
 * rotation constants and the column/diagonal schedule mirror the real design,
 * but words are 32 bits and only two rounds are run. This is an educational
 * model of the exact mixing arithmetic, not production BLAKE2b-512.
 *
 * Time:  O(rounds * 16) mixing operations  Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BlakeInput {
    message?: string;
    rounds?: number;
}

const IV = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function add32(a: number, b: number): number {
    return (a + b) >>> 0;
}

function rotr32(value: number, bits: number): number {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** The BLAKE-style G mixing function on four words and two message words. */
function G(v: number[], a: number, b: number, c: number, d: number, x: number, y: number): void {
    v[a] = add32(add32(v[a], v[b]), x);
    v[d] = rotr32(v[d] ^ v[a], 16);
    v[c] = add32(v[c], v[d]);
    v[b] = rotr32(v[b] ^ v[c], 12);
    v[a] = add32(add32(v[a], v[b]), y);
    v[d] = rotr32(v[d] ^ v[a], 8);
    v[c] = add32(v[c], v[d]);
    v[b] = rotr32(v[b] ^ v[c], 7);
}

/** Pack the message into sixteen little-endian 32-bit words, zero padded. */
function messageWords(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const words: number[] = [];
    for (let w = 0; w < 16; w += 1) {
        let value = 0;
        for (let b = 0; b < 4; b += 1) {
            value += (bytes[w * 4 + b] ?? 0) << (8 * b);
        }
        words.push(value >>> 0);
    }
    return words;
}

/** Run the column and diagonal G steps for one round. */
function compressRound(v: number[], m: number[]): void {
    G(v, 0, 4, 8, 12, m[0], m[1]);
    G(v, 1, 5, 9, 13, m[2], m[3]);
    G(v, 2, 6, 10, 14, m[4], m[5]);
    G(v, 3, 7, 11, 15, m[6], m[7]);
    G(v, 0, 5, 10, 15, m[8], m[9]);
    G(v, 1, 6, 11, 12, m[10], m[11]);
    G(v, 2, 7, 8, 13, m[12], m[13]);
    G(v, 3, 4, 9, 14, m[14], m[15]);
}

function toHex(word: number): string {
    return (word >>> 0).toString(16).padStart(8, "0");
}

function makeCells(words: number[], highlightRound: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < 16; i += 1) {
        entities.push({
            id: `cell-${Math.floor(i / 8)}-${i % 8}`,
            type: "cell",
            label: toHex(words[i] ?? 0),
            value: words[i] ?? 0,
            state: (highlightRound ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(i / 8), col: i % 8 },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BlakeInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const rounds = Math.max(1, Math.min(8, typeof task.rounds === "number" ? Math.trunc(task.rounds) : 2));
    const m = messageWords(message);
    const v: number[] = [...IV, ...IV];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(v, false),
        edges: [],
        description: `Toy BLAKE2 compression of "${message}" with ${rounds} round(s); 32-bit words, not production BLAKE2b.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: 8, round: 0, rounds, v: [...v], digest: "" },
    };
    step += 1;

    for (let r = 1; r <= rounds; r += 1) {
        compressRound(v, m);
        yield {
            stepNumber: step,
            entities: makeCells(v, true),
            edges: [],
            description: `Round ${r}: eight column G mixes followed by eight diagonal G mixes.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: 8, round: r, rounds, v: [...v], digest: "" },
        };
        step += 1;
    }

    const state = IV.map((value, i) => (value ^ v[i] ^ v[i + 8]) >>> 0);
    const digest = state.map(toHex).join("");
    yield {
        stepNumber: step,
        entities: makeCells(v, false),
        edges: [],
        description: `Final state folded with the initialization vector; toy digest ${digest}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 2, cols: 8, round: rounds, rounds, v: [...v], state, digest },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BLAKE2 compresses a message block into a fixed-size state using a mixing function called G. Each G adds two words, rotates and XORs in a diagonal pattern, and repeats with two different message words. Running G over columns and then diagonals diffuses every input bit across the whole state, which is the heart of the hash's avalanche behavior.",
        invariants: [
            "All arithmetic is modulo 2 to the 32nd power, so each word stays a 32-bit value.",
            "Each G mixes four state words using two message words and four rotations.",
            "The final state is the working vector folded with the initialization vector by XOR.",
        ],
        correctness:
            "This model is a faithful arithmetic toy: G performs the same add, XOR, and rotate sequence as the BLAKE design with the 32-bit rotation constants 16, 12, 8, and 7, and the round schedule applies all eight column and eight diagonal mixes. The test recomputes those operations independently and checks the state words and digest exactly. It does not claim the security, word size, or round count of production BLAKE2b.",
        complexityRationale:
            "Each round applies sixteen G functions, each with a constant number of operations, so a fixed number of rounds is O(1) time and O(1) space for the state and message words.",
        uses: [
            "Teaching the internals of modern ARX hash functions",
            "Demonstrating diffusion and the avalanche effect",
            "A compact model before studying full BLAKE2b or BLAKE3",
        ],
        references: [
            "Aumasson et al., BLAKE2: Simpler, Smaller, Fast as MD5, 2013",
            "Menezes et al., Handbook of Applied Cryptography, Chapter 9",
        ],
        workedExample:
            "Compressing the empty message with all message words zero starts from the eight initialization words duplicated into a sixteen-word working vector. One round applies G to columns (0,4,8,12), (1,5,9,13), (2,6,10,14), (3,7,11,15) and then the diagonals, after which the working vector is folded back to eight state words and printed as hex.",
    },
    id: "blake2b-hash",
    name: "BLAKE2b Hash (Toy Compression)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(1)" },
    defaultInput: { message: "abc", rounds: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the state from eight fixed words",
        "pad the message into sixteen 32-bit words",
        "copy the state twice into a sixteen-word working vector",
        "for each round apply G to the four columns",
        "then apply G to the four diagonals",
        "fold the working vector back with the initial state",
        "print the eight state words as the hex digest",
        "done: report the toy digest",
    ],
};

export default module;
