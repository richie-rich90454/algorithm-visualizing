/**
 * differential-cryptanalysis.ts - Differential Cryptanalysis (Toy Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Differential cryptanalysis studies how a fixed input difference propagates
 * through a cipher. The analyst encrypts a pair of plaintexts that differ by a
 * chosen delta and records the difference of the two ciphertexts. By counting
 * output differences over all plaintext pairs for one round, the analyst finds
 * the most likely characteristic and can use it to filter key guesses. This
 * teaching model uses a four-nibble state and the bijective PRESENT S-box; it
 * demonstrates the method on a toy cipher and is not an attack on a real one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^16 * rounds) for the full one-round differential distribution
 *   Space: O(2^16) for the output-difference counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the two running states and their xor difference in hex.
 *   - Each substitution, permutation, and key addition is its own frame.
 *   - meta carries the output difference and the best one-round characteristic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AttackInput {
    plaintext?: string;
    diff?: string;
    key?: string;
    rounds?: number;
}

const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];

const nibbles = (value: number): number[] => [
    (value >> 12) & 15,
    (value >> 8) & 15,
    (value >> 4) & 15,
    value & 15,
];
const substitute = (value: number): number => {
    const n = nibbles(value);
    return (SBOX[n[0] ?? 0]! << 12) | (SBOX[n[1] ?? 0]! << 8) | (SBOX[n[2] ?? 0]! << 4) | SBOX[n[3] ?? 0]!;
};
const permute = (value: number): number => {
    const n = nibbles(value);
    return ((n[0] ?? 0) << 12) | ((n[2] ?? 0) << 8) | ((n[1] ?? 0) << 4) | (n[3] ?? 0);
};
const addKey = (value: number, key: number, round: number): number =>
    (value ^ ((key + 0x1111 * round) & 0xffff)) & 0xffff;
const toHex = (value: number): string => (value & 0xffff).toString(16).padStart(4, "0");
const parse = (value: string | undefined, fallback: number): number => {
    if (value === undefined) {
        return fallback;
    }
    const parsed = Number.parseInt(value.replace(/^0x/i, ""), 16);
    return Number.isNaN(parsed) ? fallback : parsed & 0xffff;
};

function makeCells(a: number, b: number, label: string): VisualEntity[] {
    return [
        { id: "state-a", label: "p", value: a },
        { id: "state-b", label: "p xor d", value: b },
        { id: "state-diff", label, value: a ^ b },
    ].map((entity, index) => ({
        id: entity.id,
        type: "cell" as const,
        label: `${entity.label}:0x${toHex(entity.value)}`,
        value: entity.value,
        state: (index === 2 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, field: entity.label },
    }));
}

/** Count output differences for every base plaintext over one round. */
function distribution(inputDiff: number, key: number): { bestDiff: number; bestCount: number } {
    const counts = new Map<number, number>();
    for (let base = 0; base < 0x10000; base += 1) {
        const c0 = addKey(permute(substitute(base)), key, 0);
        const c1 = addKey(permute(substitute(base ^ inputDiff)), key, 0);
        const delta = c0 ^ c1;
        counts.set(delta, (counts.get(delta) ?? 0) + 1);
    }
    let bestDiff = 0;
    let bestCount = -1;
    for (const [delta, count] of counts) {
        if (count > bestCount) {
            bestDiff = delta;
            bestCount = count;
        }
    }
    return { bestDiff, bestCount };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AttackInput | null) ?? {};
    const plaintext = parse(task.plaintext, 0x0000);
    const diff = parse(task.diff, 0x1000);
    const key = parse(task.key, 0xabcd);
    const rounds = Math.max(1, task.rounds ?? 2);
    const roundDiffs: string[] = [];
    let a = plaintext;
    let b = plaintext ^ diff;
    let step = 0;

    const snap = (description: string, line: number, label: string): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(a, b, label),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            inputDiff: toHex(diff),
            plaintext: toHex(plaintext),
            key: toHex(key),
            rounds,
            roundDiffs: [...roundDiffs],
            outputDiff: toHex(a ^ b),
        },
    });

    yield snap(
        `Track input difference 0x${toHex(diff)} through ${rounds} round(s) of the toy cipher.`,
        0,
        "diff",
    );
    step += 1;

    for (let r = 0; r < rounds; r += 1) {
        a = substitute(a);
        b = substitute(b);
        roundDiffs.push(toHex(a ^ b));
        yield snap(
            `Round ${r + 1}: after the S-box substitution the pair differs by 0x${toHex(a ^ b)}.`,
            2,
            "after S",
        );
        step += 1;

        a = permute(a);
        b = permute(b);
        roundDiffs.push(toHex(a ^ b));
        yield snap(
            `Round ${r + 1}: after permuting nibble positions the difference is 0x${toHex(a ^ b)}.`,
            3,
            "after P",
        );
        step += 1;

        a = addKey(a, key, r);
        b = addKey(b, key, r);
        roundDiffs.push(toHex(a ^ b));
        yield snap(
            `Round ${r + 1}: adding the round key leaves the difference at 0x${toHex(a ^ b)}.`,
            4,
            "after key",
        );
        step += 1;
    }

    const best = rounds === 1 ? distribution(diff, key) : { bestDiff: -1, bestCount: 0 };
    const finalFrame = snap(
        `Differential trail complete: ciphertext difference 0x${toHex(a ^ b)} for input difference 0x${toHex(diff)}.`,
        6,
        "final",
    );
    yield {
        ...finalFrame,
        meta: {
            ...finalFrame.meta,
            bestDiff: best.bestDiff < 0 ? "" : toHex(best.bestDiff),
            bestCount: best.bestCount,
            totalPairs: 0x10000,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of studying one encryption, compare two encryptions whose inputs differ in a chosen way. A nonlinear substitution changes how that difference looks, but a good differential remains likely enough to be useful. If one input difference often produces the same output difference, an attacker can test candidate key bits by seeing which guesses are consistent with that characteristic.",
        invariants: [
            "The two plaintexts always differ by exactly the chosen input difference.",
            "Adding the same round key to both states leaves their xor difference unchanged.",
            "The S-box is bijective, so every nibble difference maps to a valid set of outputs.",
            "The final difference is the xor of the two independently computed ciphertexts.",
        ],
        correctness:
            "Encrypting both members of a pair through identical round functions and xoring the results at each stage gives the true propagation of the difference, because the round key is the same for both branches and cancels in the xor. The one-round distribution enumerates all 2 to the 16 base plaintexts, so its maximum count is the exact most probable output difference. Any key guess inconsistent with an observed high-probability characteristic can be discarded, which is the basis of the attack.",
        complexityRationale:
            "Tracing one pair costs O(rounds) substitutions. The exhaustive one-round distribution tries 2 to the 16 base plaintexts and does constant work per pair, so it runs in O(2 to the 16) time and its counters occupy O(2 to the 16) space in the worst case.",
        uses: [
            "Key-recovery attacks on reduced-round block ciphers during cryptanalysis",
            "Design criteria for S-boxes with low maximum differential probability",
            "Teaching the difference between a differential and a differential characteristic",
        ],
        references: [
            "Biham and Shamir, Differential Cryptanalysis of the Data Encryption Standard, 1993",
            "Nyberg, Differentially Uniform Mappings for Cryptography, EUROCRYPT 1993",
        ],
        workedExample:
            "Choose input difference 0x1000, so only the most significant nibble of the pair differs. After the S-box the difference may spread within that nibble, the nibble permutation moves it to a new position, and the round key does not change it. Encrypting all 65536 base plaintexts for one round reveals which output difference occurs most often, giving the analyst the strongest characteristic to work with.",
    },
    id: "differential-cryptanalysis",
    name: "Differential Cryptanalysis (Toy Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(2^16 * rounds)", space: "O(2^16)" },
    defaultInput: { plaintext: "0x0000", diff: "0x1000", key: "0xabcd", rounds: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "pick a plaintext pair with a chosen input difference",
        "for each round of the toy cipher",
        "apply the S-box to both states and record the difference",
        "permute the nibbles of both states",
        "add the round key to both states",
        "record the final ciphertext difference",
        "optionally enumerate all pairs for the best one-round trail",
        "done: report the differential and its most likely outcome",
    ],
};

export default module;
