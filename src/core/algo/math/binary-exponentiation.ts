/**
 * binary-exponentiation.ts – Binary Exponentiation (fast power)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Binary exponentiation computes a^b in O(log b) multiplications instead of
 * b, using the identity a^b = (a^(b/2))^2 when b is even, and a·a^(b-1) when
 * b is odd. The classic implementation scans the exponent's bits: a running
 * `result` is multiplied by a running `factor` only when the current bit is 1,
 * and the factor is squared at every step. Reading the bits is exactly what
 * gives the algorithm its name.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log b)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The exponent's binary bits are shown as cells.
 *   - The current bit being processed is YELLOW (comparing).
 *   - The running result and factor are reported each step.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The backbone of modular exponentiation in cryptography.
 *   - Also the basis of matrix exponentiation (Fibonacci in O(log n)).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a grid of cells showing the exponent's binary representation.
 *
 * @param bits The binary digits of the exponent (LSB first for the scan).
 * @param activeIndex The bit being processed (or -1).
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeBits(bits: number[], activeIndex = -1): VisualEntity[] {
    return bits.map((bit, index) => ({
        id: `bit-${index}`,
        type: "cell" as const,
        label: String(bit),
        value: bit,
        state: (activeIndex === index ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Binary Exponentiation generator.
 *
 * @param input `{ base, exponent }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { base?: number; exponent?: number } | null) ?? {};
    const base = typeof task.base === "number" ? task.base : 3;
    let exponent = typeof task.exponent === "number" ? task.exponent : 13;
    // Only non-negative integers have a binary scan; clamp anything else.
    exponent = Math.max(0, Math.floor(exponent));

    // The exponent in binary (LSB first, for the classic left-to-right scan).
    const bits = exponent.toString(2).split("").reverse().map(Number);

    let step = 0;
    let result = 1;
    let factor = base;

    // Frame 0: the exponent's bits.
    yield {
        stepNumber: step,
        entities: makeBits(bits),
        edges: [],
        description: `Computing ${base}^${exponent} – exponent binary is ${exponent.toString(2)} (LSB first).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { result },
    };
    step += 1;

    // Scan the bits from least significant to most.
    for (let i = 0; i < bits.length; i += 1) {
        // If this bit is set, fold the current factor into the result.
        if (bits[i] === 1) {
            result = result * factor;

            yield {
                stepNumber: step,
                entities: makeBits(bits, i),
                edges: [],
                description: `Bit ${i} = 1 → result *= ${factor} → ${result}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { result },
            };
            step += 1;
        } else {
            yield {
                stepNumber: step,
                entities: makeBits(bits, i),
                edges: [],
                description: `Bit ${i} = 0 → result unchanged (${result}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { result },
            };
            step += 1;
        }

        // Square the factor for the next bit.
        factor = factor * factor;
        if (i < bits.length - 1) {
            yield {
                stepNumber: step,
                entities: makeBits(bits, i),
                edges: [],
                description: `Squared factor → ${factor}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { result },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBits(bits),
        edges: [],
        description: `${base}^${exponent} = ${result}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { result },
    };
}

/** The Binary Exponentiation module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Binary exponentiation computes a^b by reading the bits of the exponent instead of multiplying b times. A running factor is squared at each step, and the result is multiplied by that factor only when the current bit is 1. Because the exponent has O(log b) bits, this replaces a linear number of multiplications with a logarithmic one.",
        "invariants": [
            "After processing k bits, the factor equals a raised to 2^k.",
            "The result always equals a raised to the value of the bits processed so far.",
            "Squaring the factor preserves the identity a^(2u) = (a^u)^2."
        ],
        "correctness": "The binary expansion writes b as a sum of powers of two. By induction, after each bit the accumulated result holds a raised to the partial sum, and the factor holds the next power of two. Multiplying on set bits therefore produces a^b at the end.",
        "complexityRationale": "The loop runs once per bit of b, that is floor(log2 b) + 1 times, with at most two multiplications each, so time is O(log b). Only a result and a factor variable are kept, giving O(1) space.",
        "uses": [
            "Modular exponentiation in public-key cryptography",
            "Fast computation of matrix powers for recurrences",
            "Any routine needing high fixed powers of a number"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.4",
            "Cormen et al., Introduction to Algorithms, Section 31.6"
        ],
        "workedExample": "Compute 3^13 with 13 = 1101 in binary. Start result = 1, factor = 3: bit 1 gives result 3, factor 9; bit 0 keeps result 3, factor 81; bit 1 gives result 243, factor 6561; bit 1 gives result 243*6561 = 1594323. So 3^13 = 1594323."
    },
    id: "binary-exponentiation",
    name: "Binary Exponentiation",
    category: "math",
    complexity: { time: "O(log b)", space: "O(1)" },
    // 3^13 = 1594323; 13 = 1101 in binary.
    defaultInput: { base: 3, exponent: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "write the exponent in binary; result ← 1, factor ← base",
        "scan the bits from least to most significant",
        "bit 1: result ← result × factor",
        "bit 0: leave result unchanged",
        "square the factor for the next bit",
        "done: result = base^exponent",
    ],
};

export default module;
