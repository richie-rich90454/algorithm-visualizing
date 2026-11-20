/**
 * rc5.ts - RC5 Block Cipher (Faithful Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RC5 is a parameterized Feistel-like block cipher with a 32-bit word size.
 * Its key schedule expands a secret byte key into 2(r+1) round words using
 * addition and rotations driven by the constants 0xb7e15163 and 0x9e3779b9.
 * Encryption mixes two data words over r rounds with data-dependent rotations;
 * decryption reverses those rounds and subtracts the round words.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r + b) for r rounds and b key bytes
 *   Space: O(r) for the expanded round-key array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two cells hold the data words v0 and v1.
 *   - The word updated in the current round is highlighted.
 *   - meta carries the round, expanded-key count, and ciphertext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CipherInput {
    words?: [number, number];
    key?: number[];
    rounds?: number;
}

const P32 = 0xb7e15163;
const Q32 = 0x9e3779b9;
const MASK = 0xffffffff;

const wrap = (x: number): number => x >>> 0;
const rotl = (x: number, shift: number): number => {
    const n = shift & 31;
    return n === 0 ? wrap(x) : wrap((x << n) | (x >>> (32 - n)));
};
const rotr = (x: number, shift: number): number => {
    const n = shift & 31;
    return n === 0 ? wrap(x) : wrap((x >>> n) | (x << (32 - n)));
};

/** Expand a byte key into the RC5 round-key array. */
function expandKey(key: number[], rounds: number): number[] {
    const t = 2 * (rounds + 1);
    const s: number[] = new Array(t);
    s[0] = P32;
    for (let i = 1; i < t; i += 1) {
        s[i] = wrap((s[i - 1] ?? 0) + Q32);
    }
    const c = Math.max(1, Math.ceil(key.length / 4));
    const l: number[] = new Array(c).fill(0);
    for (let i = 0; i < key.length; i += 1) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        l[wordIndex] = wrap((l[wordIndex] ?? 0) + ((key[i] ?? 0) << (8 * byteIndex)));
    }
    let i = 0;
    let j = 0;
    let a = 0;
    let b = 0;
    const loops = 3 * Math.max(t, c);
    for (let k = 0; k < loops; k += 1) {
        a = s[i] = rotl(wrap((s[i] ?? 0) + a + b), 3);
        b = l[j] = rotl(wrap((l[j] ?? 0) + a + b), a + b);
        i = (i + 1) % t;
        j = (j + 1) % c;
    }
    return s;
}

function makeCells(a: number, b: number, updated: 0 | 1 | null): VisualEntity[] {
    return [
        { v: a, label: "v0", idx: 0 },
        { v: b, label: "v1", idx: 1 },
    ].map(({ v, label, idx }) => ({
        id: `word-${label}`,
        type: "cell" as const,
        label: `${label}:0x${wrap(v).toString(16).padStart(8, "0")}`,
        value: wrap(v),
        state: (updated === idx ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: idx, word: label },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CipherInput | null) ?? {};
    const words: [number, number] = task.words ?? [0x12345678, 0x9abcdef0];
    const key: number[] = task.key ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const rounds = Math.max(1, task.rounds ?? 12);
    const s = expandKey(key, rounds);
    let a = wrap(wrap(words[0]) + (s[0] ?? 0));
    let b = wrap(wrap(words[1]) + (s[1] ?? 0));
    let step = 0;

    const snap = (description: string, line: number, updated: 0 | 1 | null): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(a, b, updated),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            v0: a,
            v1: b,
            round: Math.max(0, line - 2),
            rounds,
            scheduleWords: s.length,
            ciphertext:
                wrap(a).toString(16).padStart(8, "0") + wrap(b).toString(16).padStart(8, "0"),
        },
    });

    yield snap(
        `RC5-${rounds} initialized; expanded ${key.length} key bytes into ${s.length} round words.`,
        0,
        null,
    );
    step += 1;

    for (let r = 1; r <= rounds; r += 1) {
        a = rotl(wrap(a ^ b), b) + (s[2 * r] ?? 0);
        a = wrap(a);
        yield snap(`Round ${r}: rotate (v0 xor v1) left by v1 and add round word ${2 * r}.`, 2, 0);
        step += 1;
        b = rotl(wrap(b ^ a), a) + (s[2 * r + 1] ?? 0);
        b = wrap(b);
        yield snap(`Round ${r}: rotate (v1 xor v0) left by v0 and add round word ${2 * r + 1}.`, 3, 1);
        step += 1;
    }

    yield snap(
        `Encryption complete after ${rounds} rounds; ciphertext 0x${wrap(a).toString(16).padStart(8, "0")}${wrap(b).toString(16).padStart(8, "0")}.`,
        5,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RC5 gets much of its strength from rotations whose amount depends on the data itself. A secret byte key is first stretched into a table of round words. Each round then xors the two data halves, rotates by the value of the other half, and adds a round word. Undoing those additions and rotations in reverse order restores the plaintext.",
        invariants: [
            "All arithmetic on the 32-bit words wraps modulo 2 to the 32.",
            "Rotation amounts are taken from the current value of the opposite word.",
            "The expanded round-key table is fixed for the whole encryption.",
            "Decryption applies the inverse operations in exactly reverse round order.",
        ],
        correctness:
            "Each encryption round is invertible: the added round word can be subtracted and a data-dependent left rotation can be undone by the opposite rotation using the still-available other word. Because decryption walks rounds from last to first and finally subtracts the initial round words, composing encryption and decryption gives the identity for every key and block. The round-key expansion is deterministic so both sides derive the same table.",
        complexityRationale:
            "Key expansion performs a constant number of passes over the larger of the round table and the key word list, and encryption performs a constant amount of work for each of r rounds, giving O(r + b) time. The expanded table holds 2(r+1) words, so space is O(r).",
        uses: [
            "Historical symmetric encryption in early RSA BSAFE and related toolkits",
            "A compact teaching cipher for data-dependent rotations",
            "Parameterized cipher research exploring word size and round count",
        ],
        references: [
            "Rivest, The RC5 Encryption Algorithm, Fast Software Encryption 1994",
            "Rivest and Reinhold, RC5 Variable-Length Key Scheme, 1996",
        ],
        workedExample:
            "With words (0x12345678, 0x9ABCDEF0) and a 16-byte key, expansion yields 26 round words for 12 rounds. The first round rotates the xor of the two words left by the second word and adds round word 2; the second updates the other half. After 12 alternating rounds the two words form the 64-bit ciphertext shown in the final frame.",
    },
    id: "rc5",
    name: "RC5 Block Cipher",
    category: "cryptography-security",
    complexity: { time: "O(r + b)", space: "O(r)" },
    defaultInput: {
        words: [0x12345678, 0x9abcdef0],
        key: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        rounds: 12,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "expand the byte key into 2(r+1) round words",
        "add round words zero and one to the data words",
        "for each of r rounds",
        "rotate v0 xor v1 left by v1 and add the next round word",
        "rotate v1 xor v0 left by v0 and add the next round word",
        "keep both 32-bit words wrapped modulo 2 to the 32",
        "after all rounds report the two ciphertext words",
        "done: decryption reverses the rounds and subtractions",
    ],
};

export default module;
