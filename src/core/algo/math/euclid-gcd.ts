/**
 * euclid-gcd.ts – Euclid's Algorithm (Greatest Common Divisor)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The GCD of two integers is the largest integer that divides both. Euclid's
 * algorithm computes it by repeated remainder: gcd(a, b) = gcd(b, a mod b),
 * until the remainder is zero, at which point the last non-zero divisor is the
 * GCD. Each step dramatically shrinks the numbers (at least halving them every
 * two steps), which is why it is so fast.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log min(a, b)) – the Euclidean remainder sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two numbers are shown as bars.
 *   - The current pair being reduced is YELLOW (comparing).
 *   - The final GCD bar is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The oldest non-trivial algorithm in history (c. 300 BC).
 *   - The engine behind modular arithmetic and RSA key generation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pair of bar entities for the current (a, b).
 *
 * @param a The first number.
 * @param b The second number.
 * @param states Optional index → state overrides.
 * @returns Two bar entities.
 */
function makeBars(
    a: number,
    b: number,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return [
        { value: a, label: String(a) },
        { value: b, label: String(b) },
    ].map((item, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: item.label,
        value: item.value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Euclid GCD generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    let a = typeof task.a === "number" ? task.a : 48;
    let b = typeof task.b === "number" ? task.b : 36;

    let step = 0;
    let iterations = 0;

    // Frame 0: the two starting numbers.
    yield {
        stepNumber: step,
        entities: makeBars(a, b),
        edges: [],
        description: `Computing gcd(${a}, ${b}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iterations },
    };
    step += 1;

    // The Euclidean loop.
    while (b !== 0) {
        const states = new Map<number, EntityState>([
            [0, "comparing"],
            [1, "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(a, b, states),
            edges: [],
            description: `gcd(${a}, ${b}) – remainder ${a} mod ${b} = ${a % b}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { iterations },
        };
        step += 1;

        // Replace (a, b) with (b, a mod b).
        const r = a % b;
        a = b;
        b = r;
        iterations += 1;
    }

    // The final GCD is a.
    const finalStates = new Map<number, EntityState>([
        [0, "sorted"],
        [1, "idle"],
    ]);
    yield {
        stepNumber: step,
        entities: makeBars(a, 0, finalStates),
        edges: [],
        description: `gcd = ${a} after ${iterations} iteration(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { iterations, gcd: a },
    };
}

/** The Euclid GCD module, registered with the engine. */
const module: AlgorithmModule = {
    id: "euclid-gcd",
    name: "Euclid's GCD",
    category: "math",
    complexity: { time: "O(log min(a, b))", space: "O(1)" },
    // gcd(48, 36) = 12 – a few remainder steps make a clean animation.
    defaultInput: { a: 48, b: 36 },
    visualType: "array",
    run,
};

export default module;
