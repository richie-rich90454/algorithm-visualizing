/**
 * tea.ts - TEA Block Cipher (Tiny Encryption Algorithm, Faithful Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TEA is a compact 64-bit block cipher with a 128-bit key. It keeps two 32-bit
 * data words and iterates a simple round that shifts, adds, and xors each word
 * with the other and with two key words. A golden-ratio constant accumulates in
 * a running sum so that every round behaves differently. Decryption walks the
 * same rounds backward with subtraction. This is the original TEA, distinct
 * from the later XTEA revision that changed the key schedule.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per 64-bit block
 *   Space: O(1) for the two working words and the running sum
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two cells hold the data words v0 and v1 in hexadecimal.
 *   - The word updated in the current half-round is highlighted.
 *   - meta carries the running sum, round count, and ciphertext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CipherInput {
    words?: [number, number];
    key?: [number, number, number, number];
    rounds?: number;
}

const DELTA = 0x9e3779b9;
const wrap = (x: number): number => x >>> 0;

function makeCells(v0: number, v1: number, updated: 0 | 1 | null, sum: number): VisualEntity[] {
    return [
        { value: v0, label: "v0", idx: 0 },
        { value: v1, label: "v1", idx: 1 },
    ].map(({ value, label, idx }) => ({
        id: `word-${label}`,
        type: "cell" as const,
        label: `${label}:0x${wrap(value).toString(16).padStart(8, "0")}`,
        value: wrap(value),
        state: (idx === updated ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: idx, word: label, sum },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CipherInput | null) ?? {};
    let v0 = wrap(task.words?.[0] ?? 0x12345678);
    let v1 = wrap(task.words?.[1] ?? 0x9abcdef0);
    const key = task.key ?? [0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210];
    const rounds = Math.max(1, task.rounds ?? 32);
    let sum = 0;
    let step = 0;

    const snap = (description: string, line: number, updated: 0 | 1 | null): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(v0, v1, updated, sum),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            v0,
            v1,
            sum,
            rounds,
            ciphertext:
                wrap(v0).toString(16).padStart(8, "0") + wrap(v1).toString(16).padStart(8, "0"),
        },
    });

    yield snap(
        `TEA encrypting one 64-bit block with 128-bit key over ${rounds} rounds.`,
        0,
        null,
    );
    step += 1;

    for (let r = 0; r < rounds; r += 1) {
        sum = wrap(sum + DELTA);
        v0 = wrap(
            v0 +
                (wrap((v1 << 4) + (key[0] ?? 0)) ^
                    wrap(v1 + sum) ^
                    wrap((v1 >>> 5) + (key[1] ?? 0))),
        );
        yield snap(`Round ${r + 1}: mix key words 0 and 1 into v0 with sum 0x${sum.toString(16)}.`, 2, 0);
        step += 1;
        v1 = wrap(
            v1 +
                (wrap((v0 << 4) + (key[2] ?? 0)) ^
                    wrap(v0 + sum) ^
                    wrap((v0 >>> 5) + (key[3] ?? 0))),
        );
        yield snap(`Round ${r + 1}: mix key words 2 and 3 into v1 with the same sum.`, 3, 1);
        step += 1;
    }

    yield snap(
        `TEA complete after ${rounds} rounds; ciphertext 0x${wrap(v0).toString(16).padStart(8, "0")}${wrap(v1).toString(16).padStart(8, "0")}.`,
        5,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "TEA treats a 64-bit block as two halves and repeatedly folds one half into the other using shifts, additions, and xors with pieces of a 128-bit key. A constant based on the golden ratio is added to a running sum each round, so even though the round code is identical every iteration uses a different value. Two halves are updated per round, and the ciphertext is the pair after all rounds.",
        invariants: [
            "All word arithmetic wraps modulo 2 to the 32.",
            "The running sum increases by the same golden-ratio constant each round.",
            "Each half-round uses the current value of the other word first.",
            "Decryption undoes half-rounds in the exact reverse order with subtraction.",
        ],
        correctness:
            "Each half-round computes v = v + F(other, sum, keys), where the added quantity depends only on the other word, the sum, and key words. During decryption the other word and sum still hold their values from that point, so subtracting the same quantity recovers the previous v. Reversing the half-rounds from last to first and finally subtracting the accumulated sum therefore restores the plaintext for any key and round count.",
        complexityRationale:
            "Every round performs a constant number of 32-bit operations on two words, so a block takes O(rounds) time. Only the two data words, the running sum, and the four key words are stored, giving O(1) space.",
        uses: [
            "A compact block cipher for teaching Feistel-style mixing",
            "Historical lightweight encryption in early embedded and network protocols",
            "A baseline for comparing the stronger key schedule of XTEA",
        ],
        references: [
            "Wheeler and Needham, TEA, a Tiny Encryption Algorithm, Fast Software Encryption 1994",
            "Needham and Wheeler, Correction to XTEA, 1997",
        ],
        workedExample:
            "With data words 0x12345678 and 0x9abcdef0, key words 0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210, and 32 rounds, the sum starts at zero and grows by 0x9e3779b9 each round. The first round folds v1 into v0, the second folds the new v0 into v1, and after 32 rounds the two words are the ciphertext shown in the final frame.",
    },
    id: "tea",
    name: "TEA Block Cipher",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(1)" },
    defaultInput: {
        words: [0x12345678, 0x9abcdef0],
        key: [0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210],
        rounds: 32,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the running sum to zero",
        "for each of the rounds",
        "add the golden-ratio constant to the sum",
        "mix key words zero and one into v0 from v1",
        "mix key words two and three into v1 from the new v0",
        "wrap every word to 32 bits after each operation",
        "after all rounds report v0 and v1 as ciphertext",
        "done: decryption subtracts in reverse sum order",
    ],
};

export default module;
