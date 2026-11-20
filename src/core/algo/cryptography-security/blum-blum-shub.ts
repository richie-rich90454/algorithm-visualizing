/**
 * blum-blum-shub.ts - Blum-Blum-Shub Pseudorandom Generator (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BBS repeatedly squares a value modulo a product of two primes that are both
 * congruent to three modulo four, and emits one bit per step, usually the low
 * bit of the state. Recovering future outputs is as hard as factoring the
 * modulus. The parameters here are tiny so every step is checkable by hand;
 * this is a teaching model, not a secure generator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b * log^2 n) for b output bits with modular exponentiation
 *   Space: O(b) only for the displayed bit bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per output step shows the emitted bit.
 *   - The current bit is highlighted while it is produced.
 *   - Metadata shows the internal state and the full bit string.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GeneratorInput {
    p?: number;
    q?: number;
    seed?: number;
    bits?: number;
}

/** Build the bit bars for a step. */
function makeBars(bits: number[], produced: number): VisualEntity[] {
    return bits.map((bit, index) => ({
        id: `bit-${index}`,
        type: "bar" as const,
        label: String(bit),
        value: bit,
        state: (index < produced ? "sorted" : index === produced ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bit },
    }));
}

/** The BBS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GeneratorInput | null) ?? {};
    const p = typeof task.p === "number" ? task.p : 11;
    const q = typeof task.q === "number" ? task.q : 23;
    const n = p * q;
    const count = typeof task.bits === "number" ? Math.max(1, Math.floor(task.bits)) : 16;
    let x = (typeof task.seed === "number" ? task.seed : 7) % n;
    if (x < 0) {
        x += n;
    }
    const bits = new Array<number>(count).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(bits, 0),
        edges: [],
        description: `BBS toy generator with p=${p}, q=${q}, modulus ${n}, and ${count} output bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, q, n, x, index: 0, bit: 0, bits: bits.slice(), params: "toy, not secure" },
    };
    step += 1;

    for (let i = 0; i < count; i += 1) {
        x = (x * x) % n;
        const bit = x & 1;
        bits[i] = bit;
        yield {
            stepNumber: step,
            entities: makeBars(bits, i),
            edges: [],
            description: `Step ${i + 1}: state ${x}, emitted bit ${bit}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { p, q, n, x, index: i + 1, bit, bits: bits.slice(), params: "toy, not secure" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(bits, count),
        edges: [],
        description: `Generated ${bits.join("")} from modulus ${n}. Parameters are too small for security.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { p, q, n, x, index: count, bit: bits[count - 1] ?? 0, bits: bits.slice(), params: "toy, not secure" },
    };
}

/** The Blum-Blum-Shub module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Squaring a number modulo a product of two secret primes is easy, but recovering the original number from the square is as hard as factoring. BBS exploits that one-way behavior: each step squares the hidden state and reveals only one bit. Knowing the primes lets you reproduce the stream; not knowing them does not.",
        invariants: [
            "The modulus is the product of two primes congruent to three modulo four.",
            "Each state stays in the range zero to n minus one.",
            "Every emitted bit is the low bit of the current state.",
        ],
        correctness:
            "Because p and q are Blum primes, squaring is a permutation of the quadratic residues modulo n, so the state evolves deterministically and can be reproduced from the seed and factors. The low-bit output function is a hard-core predicate for modular squaring: predicting it from the state's square alone would allow factoring n. The companion test replays the squaring recurrence independently and confirms every state and emitted bit.",
        complexityRationale:
            "Each output bit needs one modular squaring, which takes O(log squared n) bit operations for an n-bit modulus, so b bits cost O(b log squared n). Only the current state and the displayed bits are stored, giving O(b) space for the visualization and O(1) for the generator itself.",
        uses: [
            "A conceptual basis for provably secure pseudorandom generation",
            "Teaching the reduction from bit prediction to integer factoring",
            "Historical pseudorandom generators in cryptographic libraries",
        ],
        references: [
            "Blum, Blum, and Shub, A Simple Unpredictable Pseudo-Random Number Generator, 1986",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 5",
        ],
        workedExample:
            "With p = 11 and q = 23 the modulus is 253 and the seed 7. Squaring gives 49, whose low bit is 1; squaring 49 gives 1403 mod 253 = 135, whose low bit is 1. Continuing produces a short bit string that anyone knowing p and q can regenerate exactly.",
    },
    id: "blum-blum-shub",
    name: "Blum-Blum-Shub Generator (Teaching Model)",
    category: "cryptography-security",
    complexity: { time: "O(b log^2 n)", space: "O(b) for display" },
    defaultInput: { p: 11, q: 23, seed: 7, bits: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "choose two primes p and q congruent to three mod four",
        "set the modulus n to p times q and the state to the seed",
        "for each requested output bit",
        "replace the state with state squared modulo n",
        "emit the low bit of the new state",
        "record the bit and continue",
        "done: report the generated bit string",
    ],
};

export default module;
