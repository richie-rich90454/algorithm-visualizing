/**
 * xorshift.ts - Xorshift32 Pseudorandom Number Generator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Xorshift32 is a fast pseudorandom generator that advances a 32-bit state by
 * three shift-and-xor steps. It needs no multiplication or memory table, and
 * a nonzero seed produces a long period of 2^32 - 1 values. It is useful for
 * simulations and teaching, but it is not cryptographically secure because
 * the state can be recovered from a few outputs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per generated word
 *   Space: O(n) for the displayed sequence (O(1) live state)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per output slot; generated slots show their word.
 *   - The newest output is highlighted as the state is advanced.
 *   - The final frame reports the full sequence and terminal state.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Advance a xorshift32 state by one step. */
function step(state: number): number {
    let x = state >>> 0;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
}

/** The xorshift32 generator module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(200, Math.floor(task.count ?? 12)));
    let state = (task.seed ?? 1) >>> 0;
    if (state === 0) state = 1;
    const initialState = state;
    const sequence: number[] = [];

    const bars = (): VisualEntity[] =>
        Array.from({ length: count }, (_, i) => {
            const value = sequence[i] ?? 0;
            return {
                id: `word-${i}`,
                type: "bar" as const,
                label: String(value),
                value,
                state: (i === sequence.length - 1 ? "active" : i < sequence.length ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: i, value },
            };
        });

    yield {
        stepNumber: 0,
        entities: bars(),
        edges: [],
        description: `Seeded xorshift32 with state ${state}; generating ${count} word(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed: initialState, state, count, sequence: [] },
    };
    let stepNumber = 1;
    for (let i = 0; i < count; i += 1) {
        state = step(state);
        sequence.push(state);
        yield {
            stepNumber,
            entities: bars(),
            edges: [],
            description: `Step ${i + 1}: shifting and xoring the state produced ${state}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { seed: initialState, state, count, sequence: sequence.slice(), index: i },
        };
        stepNumber += 1;
    }
    yield {
        stepNumber,
        entities: bars(),
        edges: [],
        description: `Generated ${count} word(s); the final state is ${state}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { seed: initialState, state, count, sequence: sequence.slice() },
    };
}

/** The xorshift32 generator module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Xorshift generates randomness by shuffling the bits of a single 32-bit state. It shifts the state left by 13 bits and xors, right by 17 bits and xors, then left by 5 bits and xors. Those three operations mix bits quickly using only cheap CPU instructions, and a nonzero state can never collapse to zero.",
        invariants: [
            "The state is always a 32-bit unsigned integer.",
            "A nonzero seed never produces a zero output.",
            "The same seed always produces the same sequence.",
        ],
        correctness:
            "Each xorshift step is a linear invertible transformation over the 32-bit vector space when restricted to nonzero states, so it permutes the 2^32 - 1 nonzero states in one cycle. Starting from a nonzero seed, every output is therefore nonzero and no value repeats before the full period. Because the transformation is deterministic, replaying a seed reproduces exactly the same words.",
        complexityRationale:
            "One output requires three shifts and three xors, all constant time, so generating n words is O(n). The live generator keeps a single 32-bit state; the displayed bars use O(n) space.",
        uses: [
            "Fast randomness for simulations and games",
            "Monte Carlo sampling where cryptographic strength is unnecessary",
            "Teaching the relationship between bitwise operations and pseudorandomness",
        ],
        references: [
            "Marsaglia, Xorshift RNGs, 2003",
            "Wikipedia, Xorshift",
        ],
        workedExample:
            "Starting from state 1, one step shifts left 13 and xors to get 8193, shifts that right 17 and xors, then shifts left 5 and xors, producing the first output 270369. Repeating the same three operations yields the next word without storing any history.",
    },
    id: "xorshift",
    name: "Xorshift32 Generator",
    category: "cryptography-security",
    complexity: { time: "O(1) per word", space: "O(n) displayed" },
    defaultInput: { seed: 1, count: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "seed the 32-bit state with a nonzero value",
        "for each requested output",
        "shift the state left 13 bits and xor it with itself",
        "shift the state right 17 bits and xor it with itself",
        "shift the state left 5 bits and xor it with itself",
        "emit the state as the next random word",
        "done: report the generated sequence",
    ],
};

export default module;
