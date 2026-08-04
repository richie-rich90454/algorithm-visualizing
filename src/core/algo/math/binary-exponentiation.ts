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
    id: "binary-exponentiation",
    name: "Binary Exponentiation",
    category: "math",
    complexity: { time: "O(log b)", space: "O(1)" },
    // 3^13 = 1594323; 13 = 1101 in binary.
    defaultInput: { base: 3, exponent: 13 },
    visualType: "grid",
    run,
};

export default module;
