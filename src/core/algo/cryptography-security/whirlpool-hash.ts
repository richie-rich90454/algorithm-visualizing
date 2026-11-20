/**
 * whirlpool-hash.ts - Whirlpool Compression Structure (Toy State)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Whirlpool is a 512-bit hash built from a 512-bit block cipher W with the
 * Miyaguchi-Preneel feed-forward: each message block is fed into W keyed by
 * the current chaining value, then XORed with both the chaining value and the
 * cipher output. The real W cipher uses a large S-box, byte transposition,
 * and a linear diffusion layer over an 8x8 byte state. This module keeps that
 * round structure - substitution, rotation, diffusion, constants, and key
 * addition - but shrinks the state to eight bytes with a small permutation
 * S-box, so the whole compression can be followed by hand. It is a teaching
 * model and provides no cryptographic security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m * rounds * width) for m message blocks
 *   Space: O(width) for the chaining state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the message block, the chaining state, and the final digest.
 *   - The active block is highlighted while its W compression runs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A nibble S-box that is a permutation of 0 through 15. */
export const SBOX = [12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2];

const WIDTH = 8;
const ROUNDS = 4;
const INITIAL = [0x6a, 0x09, 0xe6, 0x67, 0xf3, 0xbc, 0xc9, 0x09];

function substitute(value: number): number {
    return ((SBOX[value >> 4] ?? 0) << 4) | (SBOX[value & 0x0f] ?? 0);
}

/** One toy W round: substitute, rotate, diffuse, add constant and key. */
export function whirlpoolRound(state: number[], key: number[], round: number): number[] {
    const subbed = state.map(substitute);
    const shift = round % WIDTH;
    const rotated = subbed.map((_, i) => subbed[(i + shift) % WIDTH] ?? 0);
    const diffused = rotated.map((_, i) => (rotated[i] ?? 0) ^ (rotated[(i + 1) % WIDTH] ?? 0) ^ (rotated[(i + 3) % WIDTH] ?? 0));
    return diffused.map((value, i) => (value ^ ((round * 16 + i) & 0xff) ^ (key[i] ?? 0)) & 0xff);
}

/** The toy block cipher W keyed by eight bytes. */
export function wCipher(block: number[], key: number[]): number[] {
    let state = [...block];
    for (let round = 0; round < ROUNDS; round += 1) {
        const roundKey = key.map((value, i) => (value + round * 17 + i * 3) & 0xff);
        state = whirlpoolRound(state, roundKey, round);
    }
    return state;
}

/** Pad with 0x80 and zeros so the input is a whole number of blocks. */
export function padMessage(message: number[]): number[][] {
    const padded = [...message, 0x80];
    while (padded.length % WIDTH !== 0) {
        padded.push(0);
    }
    const blocks: number[][] = [];
    for (let i = 0; i < padded.length; i += WIDTH) {
        blocks.push(padded.slice(i, i + WIDTH));
    }
    return blocks;
}

/** Absorb all blocks with Miyaguchi-Preneel and return the 8-byte digest. */
export function whirlpoolHash(message: number[]): number[] {
    let state = [...INITIAL];
    for (const block of padMessage(message)) {
        const key = [...state];
        const cipher = wCipher(block, key);
        state = cipher.map((value, i) => (value ^ (key[i] ?? 0) ^ (block[i] ?? 0)) & 0xff);
    }
    return state;
}

function rowCells(row: number, bytes: number[], state: EntityState, revealed: number): VisualEntity[] {
    return Array.from({ length: WIDTH }, (_, col) => {
        const value = bytes[col] ?? 0;
        return {
            id: `byte-${row}-${col}`,
            type: "cell" as const,
            label: value.toString(16).toUpperCase().padStart(2, "0"),
            value,
            state: col < revealed ? state : ("unvisited" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        };
    });
}

function toHex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join("");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number[] } | null) ?? {};
    const message = Array.isArray(task.message) ? task.message : [72, 105, 33];
    const blocks = padMessage(message);
    const digest = whirlpoolHash(message);
    let state = [...INITIAL];
    let step = 0;

    const frame = (blockIndex: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, blockIndex >= 0 ? (blocks[blockIndex] ?? []) : [], blockIndex >= 0 ? "active" : "unvisited", WIDTH),
            ...rowCells(1, state, "pivot", WIDTH),
            ...rowCells(2, blockIndex === blocks.length - 1 ? digest : [], "sorted", blockIndex === blocks.length - 1 ? WIDTH : 0),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: WIDTH,
            messageBytes: message.length,
            blocks: blocks.length,
            rounds: ROUNDS,
            state: toHex(state),
            digest: toHex(digest),
        },
    });

    yield frame(-1, "Initialize the eight-byte chaining value.", 0);
    for (let i = 0; i < blocks.length; i += 1) {
        const key = [...state];
        const cipher = wCipher(blocks[i] ?? [], key);
        state = cipher.map((value, j) => (value ^ (key[j] ?? 0) ^ ((blocks[i] ?? [])[j] ?? 0)) & 0xff);
        yield frame(i, `Absorb block ${i + 1}: compress with W, then feed forward the block and old state.`, 1);
    }
    yield frame(blocks.length - 1, `Final chaining value is the toy Whirlpool digest ${toHex(digest)}.`, 2);
}

const module: AlgorithmModule = {
    id: "whirlpool-hash",
    name: "Whirlpool Compression (Toy State)",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(1)" },
    defaultInput: { message: [72, 105, 33] },
    visualType: "grid",
    run,
    pseudocode: [
        "state ← the initial chaining value",
        "pad the message with 0x80 and zeros to a whole number of blocks",
        "for each block: key ← the current state",
        "cipher ← W(block) under that key, using substitution, rotation, diffusion, and constants",
        "state ← cipher xor key xor block (Miyaguchi-Preneel feed-forward)",
        "after the last block, output the state as the digest",
    ],
    education: {
        intuition:
            "Whirlpool turns a block cipher into a hash by using the current hash value as the cipher key and then mixing the block back in. The feed-forward step is important: it makes the compression one-way, because recovering the input would require inverting the cipher and knowing the relation between key and output. The diffusion layer spreads each input byte across the whole state so one changed message bit affects every output byte.",
        invariants: [
            "The S-box is a permutation, so substitution loses no information on its own.",
            "Diffusion combines three byte positions with XOR so a single byte change propagates.",
            "Miyaguchi-Preneel always XORs the key and the message block back into the cipher output.",
        ],
        correctness:
            "Every round is a composition of invertible byte permutations, rotations, XOR diffusion, and constant additions, so the toy W block function is a bijection for a fixed key. Hash collision resistance comes from the compression feed-forward and the large real state; the small state here can only illustrate the structure and cannot resist collisions.",
        complexityRationale:
            "Each message block runs a fixed four rounds over eight bytes, so hashing m blocks takes O(m) time and uses a constant-size chaining state.",
        uses: [
            "Teaching block-cipher-based hash constructions",
            "Understanding Miyaguchi-Preneel feed-forward",
            "Studying diffusion and avalanche in round functions",
        ],
        references: [
            "ISO/IEC 10118-3, Hash functions dedicated hash functions, Whirlpool",
            "Rijmen and Barreto, The Whirlpool Hashing Function, 2003",
        ],
        workedExample:
            "For message bytes 48 69 21 the tool pads one 8-byte block ending in 0x80. W encrypts that block under the initial chaining value, then the block and the old chaining value are XORed back in; the resulting eight bytes are printed as the toy digest.",
    },
};

export default module;
