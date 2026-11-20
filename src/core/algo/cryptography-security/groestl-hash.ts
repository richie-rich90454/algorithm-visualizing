/**
 * groestl-hash.ts - GrolSTl P and Q Permutations (Toy State)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Groestl is a SHA-3 finalist built from two AES-like permutations named P
 * and Q. Messages are absorbed into a wide state with a feed-forward of both
 * permutations, and the digest is squeezed from that state. The real design
 * uses a 512- or 1024-bit state, a large S-box, and ten rounds. This module
 * keeps the two-permutation, substitution-rotation-diffusion structure but
 * shrinks everything to eight bytes and four rounds so every operation can be
 * inspected. It is a teaching model, not a secure hash function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m * rounds * width) for m message blocks
 *   Space: O(width) for the chaining state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the message block, the P permutation output, and the digest.
 *   - The active block is highlighted while the two permutations are applied.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A nibble permutation used by both toy permutations. */
export const SBOX = [3, 8, 15, 1, 10, 6, 5, 12, 0, 14, 11, 2, 9, 7, 4, 13];

const WIDTH = 8;
const ROUNDS = 4;
const INITIAL = [0x24, 0x3f, 0x6a, 0x88, 0xbf, 0x4c, 0xd1, 0x0e];

export type PermutationVariant = "P" | "Q";

function substitute(value: number): number {
    return ((SBOX[value >> 4] ?? 0) << 4) | (SBOX[value & 0x0f] ?? 0);
}

/** One toy round of P or Q with variant-specific rotation and diffusion. */
export function groestlRound(state: number[], key: number[], round: number, variant: PermutationVariant): number[] {
    const subbed = state.map(substitute);
    const shift = (round + (variant === "Q" ? 3 : 0)) % WIDTH;
    const rotated = subbed.map((_, i) => subbed[(i + shift) % WIDTH] ?? 0);
    const diffused = rotated.map((_, i) =>
        variant === "P"
            ? (rotated[i] ?? 0) ^ (rotated[(i + 1) % WIDTH] ?? 0) ^ (rotated[(i + 3) % WIDTH] ?? 0)
            : (rotated[i] ?? 0) ^ (rotated[(i + 2) % WIDTH] ?? 0) ^ (rotated[(i + 5) % WIDTH] ?? 0),
    );
    const base = variant === "P" ? 0x10 : 0x80;
    return diffused.map((value, i) => (value ^ ((base + round * 8 + i) & 0xff) ^ (key[i] ?? 0)) & 0xff);
}

/** Run four rounds of the chosen variant. */
export function groestlPermute(state: number[], key: number[], variant: PermutationVariant): number[] {
    let current = [...state];
    for (let round = 0; round < ROUNDS; round += 1) {
        const roundKey = key.map((value, i) => (value + round * 23 + i * 5) & 0xff);
        current = groestlRound(current, roundKey, round, variant);
    }
    return current;
}

/** Pad the message into eight-byte blocks with a 0x80 marker. */
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

/** Absorb all blocks with the P/Q feed-forward and squeeze the digest. */
export function groestlHash(message: number[]): number[] {
    let state = [...INITIAL];
    for (const block of padMessage(message)) {
        const mixed = state.map((value, i) => (value ^ (block[i] ?? 0)) & 0xff);
        const p = groestlPermute(mixed, block, "P");
        const q = groestlPermute(block, state, "Q");
        state = p.map((value, i) => (value ^ (q[i] ?? 0) ^ (state[i] ?? 0)) & 0xff);
    }
    return groestlPermute(state, INITIAL, "P");
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
    const message = Array.isArray(task.message) ? task.message : [72, 105, 33, 33];
    const blocks = padMessage(message);
    const digest = groestlHash(message);
    let state = [...INITIAL];
    let step = 0;

    const frame = (blockIndex: number, pValue: number[], description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, blockIndex >= 0 ? (blocks[blockIndex] ?? []) : [], blockIndex >= 0 ? "active" : "unvisited", WIDTH),
            ...rowCells(1, pValue, "pivot", pValue.length > 0 ? WIDTH : 0),
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

    yield frame(-1, [], "Initialize the eight-byte state for the toy Groestl permutations.", 0);
    for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i] ?? [];
        const mixed = state.map((value, j) => (value ^ (block[j] ?? 0)) & 0xff);
        const p = groestlPermute(mixed, block, "P");
        const q = groestlPermute(block, state, "Q");
        state = p.map((value, j) => (value ^ (q[j] ?? 0) ^ (state[j] ?? 0)) & 0xff);
        yield frame(i, p, `Absorb block ${i + 1}: feed P of the mixed state and Q of the block back into the state.`, 1);
    }
    yield frame(blocks.length - 1, digest, `Squeeze the final P permutation as the toy digest ${toHex(digest)}.`, 2);
}

const module: AlgorithmModule = {
    id: "groestl-hash",
    name: "Groestl P and Q (Toy State)",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(1)" },
    defaultInput: { message: [72, 105, 33, 33] },
    visualType: "grid",
    run,
    pseudocode: [
        "state ← the initial constant",
        "pad the message into eight-byte blocks with a 0x80 marker",
        "for each block: mixed ← state xor block",
        "p ← P(mixed keyed by block) and q ← Q(block keyed by state)",
        "state ← p xor q xor state (two-permutation feed-forward)",
        "after all blocks, digest ← P(state) keyed by the initial constant",
        "output the digest",
    ],
    education: {
        intuition:
            "Groestl hashes by encrypting the message with two related permutations and adding the results back to the state. Using two variants matters: P and Q share the same round skeleton but differ in how bytes move and in their round constants, which makes the feed-forward harder to cancel. The toy version shows why two distinct permutations are useful and how a sponge-like absorb loop works.",
        invariants: [
            "P and Q use the same S-box but different rotation offsets and diffusion taps.",
            "Every absorbed block is added back into the state, so the compression is not a bare permutation.",
            "The digest depends on the whole message through the chained state.",
        ],
        correctness:
            "Each permutation round is a composition of bijections and deterministic key additions, so P and Q are injective for a fixed key. The absorb step chains every block into the state, so changing any message block changes the state and therefore the final digest. The toy state is only 64 bits, so this demonstrates structure rather than real collision resistance.",
        complexityRationale:
            "Two fixed-round permutations run per block, each linear in the eight-byte width, so hashing m blocks takes O(m) time and uses a constant-size state.",
        uses: [
            "Teaching the SHA-3 finalist design space",
            "Understanding sponge absorption with two permutations",
            "Comparing permutation-based and block-cipher-based hashes",
        ],
        references: [
            "Gauravaram et al., Groestl - a SHA-3 candidate, 2008",
            "NIST, SHA-3 Cryptographic Hash Algorithm Competition, 2012",
        ],
        workedExample:
            "For message bytes 48 69 21 21 the tool pads one 8-byte block. It computes P on the state XOR block and Q on the block itself, folds both back into the state, then squeezes P of the final state under the initial constant to print the eight-byte toy digest.",
    },
};

export default module;
