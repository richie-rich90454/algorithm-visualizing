/**
 * skipjack.ts - SKIPJACK-Style Block Cipher (Teaching Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SKIPJACK is a legacy 80-bit-key, 64-bit-block Feistel cipher with a 256-entry
 * F-table and 32 rounds. This module keeps the authentic proportions: an
 * 80-bit key, a 64-bit block, a permuted byte substitution table, and an
 * unbalanced Feistel network. It reduces the round count and simplifies the
 * mixing rule so the whole schedule is visible in a short replay. It is a
 * faithful structural toy, NOT a secure or interoperable SKIPJACK implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * blockBytes) for encryption or decryption
 *   Space: O(rounds * blockBytes) for the recorded round states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the block bytes after each Feistel round.
 *   - The round in progress is highlighted.
 *   - meta carries the ciphertext and every intermediate block state.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROUNDS = 8;
const HALF = 4;
const BLOCK = 8;
const KEY = 10;

/** Deterministic permutation of all byte values, playing the F-table role. */
function buildFTable(): number[] {
    const table = Array.from({ length: 256 }, (_, i) => i);
    let state = 0x1f2e3d4c;
    for (let i = 255; i > 0; i -= 1) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        const j = state % (i + 1);
        const tmp = table[i]!;
        table[i] = table[j]!;
        table[j] = tmp;
    }
    return table;
}

const F_TABLE = buildFTable();

function rotr8(value: number, bits: number): number {
    return ((value >>> bits) | (value << (8 - bits))) & 0xff;
}

/** One Feistel round: new left is the old right, new right is left xor F(right). */
function feistel(block: number[], round: number, key: number[]): number[] {
    const right = block.slice(HALF, BLOCK);
    const mixed: number[] = new Array(HALF);
    for (let j = 0; j < HALF; j += 1) {
        const a = F_TABLE[(right[j]! ^ key[(round * 3 + j) % KEY]!) & 0xff]!;
        const b = F_TABLE[(right[(j + 1) % HALF]! ^ key[(round * 3 + j + 2) % KEY]!) & 0xff]!;
        mixed[j] = (a ^ rotr8(b, 3)) & 0xff;
    }
    const out: number[] = new Array(BLOCK);
    for (let j = 0; j < HALF; j += 1) {
        out[j] = right[j]!;
        out[j + HALF] = (block[j]! ^ mixed[j]!) & 0xff;
    }
    return out;
}

export function encryptBlock(block: number[], key: number[]): number[][] {
    const states = [block.slice()];
    let current = block.slice();
    for (let r = 0; r < ROUNDS; r += 1) {
        current = feistel(current, r, key);
        states.push(current.slice());
    }
    return states;
}

export function decryptBlock(cipher: number[], key: number[]): number[][] {
    const states = [cipher.slice()];
    let current = cipher.slice();
    for (let r = ROUNDS - 1; r >= 0; r -= 1) {
        const prevRight = current.slice(0, HALF);
        const mixed: number[] = new Array(HALF);
        for (let j = 0; j < HALF; j += 1) {
            const a = F_TABLE[(prevRight[j]! ^ key[(r * 3 + j) % KEY]!) & 0xff]!;
            const b = F_TABLE[(prevRight[(j + 1) % HALF]! ^ key[(r * 3 + j + 2) % KEY]!) & 0xff]!;
            mixed[j] = (a ^ rotr8(b, 3)) & 0xff;
        }
        const prev: number[] = new Array(BLOCK);
        for (let j = 0; j < HALF; j += 1) {
            prev[j + HALF] = prevRight[j]!;
            prev[j] = (current[j + HALF]! ^ mixed[j]!) & 0xff;
        }
        current = prev;
        states.push(current.slice());
    }
    return states;
}

function hex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Make block-byte bars for the current round. */
function makeBars(bytes: number[], round: number, done: boolean): VisualEntity[] {
    return bytes.map((byte, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: `b${index}=${byte.toString(16).padStart(2, "0")}`,
        value: byte,
        state: (done ? "sorted" : index === round % BLOCK ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, byte },
    }));
}

/** SKIPJACK toy generator: shows each Feistel round of encryption. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; key?: string } | null) ?? {};
    const text = String(task.plaintext ?? "ABCDEFGH");
    const plain = Array.from(new TextEncoder().encode(text).slice(0, BLOCK));
    while (plain.length < BLOCK) plain.push(0);
    const keyText = String(task.key ?? "0123456789");
    const key = Array.from(new TextEncoder().encode(keyText).slice(0, KEY));
    while (key.length < KEY) key.push(0);

    const states = encryptBlock(plain, key);
    const cipher = states[states.length - 1]!;
    const decrypted = decryptBlock(cipher, key)[ROUNDS]!;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(plain, 0, false),
        edges: [],
        description: `SKIPJACK toy cipher: ${BLOCK}-byte block, ${KEY}-byte key, ${ROUNDS} Feistel rounds.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { plaintext: text, ciphertext: hex(plain), round: 0, rounds: ROUNDS, decryptsBack: hex(decrypted) === hex(plain) },
    };
    step += 1;

    for (let r = 0; r < ROUNDS; r += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(states[r + 1]!, r, false),
            edges: [],
            description: `Round ${r + 1}: left and right halves swap; the right half is xored with the F-table mix.`,
            codeLineNumber: Math.min(6, r + 1),
            layout: "array",
            meta: { plaintext: text, ciphertext: hex(states[r + 1]!), round: r + 1, rounds: ROUNDS },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(cipher, 0, true),
        edges: [],
        description: `Ciphertext ${hex(cipher)}; the inverse round schedule recovers the original plaintext.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { plaintext: text, ciphertext: hex(cipher), round: ROUNDS, rounds: ROUNDS, decryptsBack: hex(decrypted) === hex(plain) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the block into two halves. In each round, move the right half to the left and xor the old left with a scrambled version of the right derived from an 80-bit key and a byte substitution table. The same round structure run backward restores the plaintext, so no separate inverse function is needed.",
        invariants: [
            "The block is always exactly eight bytes and the key exactly ten bytes.",
            "Each round is invertible because the Feistel swap does not require the round function to be invertible.",
            "Running the round keys in reverse order returns the original plaintext.",
        ],
        correctness:
            "A Feistel network is invertible regardless of its round function: given the output halves, the previous right half is the current left, and the previous left is the current right xor the same F value. Replaying the rounds with keys in reverse therefore recovers the plaintext exactly, which the module verifies on every input.",
        complexityRationale:
            "Each of the eight rounds mixes four bytes using two table lookups each, so time is linear in the rounds times the block width. Recording every intermediate block state uses linear space in the same product.",
        uses: [
            "A classroom model of legacy Feistel cipher design",
            "Demonstrating why Feistel round functions need not be invertible",
            "A compact testbed for substitution and diffusion ideas",
        ],
        references: [
            "NSA, SKIPJACK and KEA Algorithm Specifications, 1998",
            "Stinson and Paterson, Cryptography Theory and Practice, Chapter 3",
        ],
        workedExample:
            "Encrypting the eight bytes ABCDEFGH with key 0123456789 swaps halves and mixes the right half with two F-table lookups per byte in each of eight rounds. Reversing the round order and reapplying the same key bytes recovers ABCDEFGH exactly.",
    },
    id: "skipjack",
    name: "SKIPJACK Toy Cipher",
    category: "cryptography-security",
    complexity: { time: "O(rounds * 8)", space: "O(rounds * 8)" },
    defaultInput: { plaintext: "ABCDEFGH", key: "0123456789" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the plaintext to eight bytes and the key to ten bytes",
        "split the block into a four-byte left and right half",
        "for each of eight rounds derive two mixed bytes from the F-table",
        "set the new left half to the old right half",
        "set the new right half to old left xor the mixed bytes",
        "after the last round, report the ciphertext",
        "reverse the key order through the same rounds to decrypt",
        "report whether decryption recovered the plaintext",
    ],
};

export default module;
