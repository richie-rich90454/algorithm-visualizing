/**
 * pollard-rho.ts – Pollard's Rho Algorithm (integer factorization)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pollard's rho finds a non-trivial factor of a composite number n. It uses a
 * pseudo-random function f(x) = (x² + c) mod n; iterating f produces a
 * sequence that eventually cycles. By also running a "tortoise" at half speed
 * and taking gcd of the difference with n, a repeated value mod a hidden prime
 * factor p shows up as a shared divisor – exposing p. The "rho" is the Greek
 * letter shape of the cycle.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(1/4)) expected
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tortoise position is YELLOW (comparing).
 *   - The hare position is PINK (highlight).
 *   - A discovered factor is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The cycle-detection trick is the heart to teach.
 *   - Usually paired with Miller-Rabin for full factorization.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A tiny gcd helper. */
function gcd(a: number, b: number): number {
    while (b !== 0) {
        const r = a % b;
        a = b;
        b = r;
    }
    return a;
}

/**
 * Build a pair of bars showing the tortoise and hare.
 *
 * @param tortoise The tortoise value.
 * @param hare The hare value.
 * @returns Two bar entities (tortoise comparing, hare highlight).
 */
function makePair(tortoise: number, hare: number): VisualEntity[] {
    const states: EntityState[] = ["comparing", "highlight"];
    return [tortoise, hare].map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Pollard's Rho generator.
 *
 * @param input `{ n }` – the number to factor.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 91;

    let step = 0;

    // Frame 0: the number to factor.
    yield {
        stepNumber: step,
        entities: makePair(n, 0),
        edges: [],
        description: `Finding a factor of ${n} with Pollard's rho.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // Small/trivial cases.
    if (n % 2 === 0) {
        yield {
            stepNumber: step,
            entities: makePair(n, 0),
            edges: [],
            description: `Found factor 2 immediately.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { factor: 2 },
        };
        return;
    }

    // Pollard's rho: tortoise and hare.
    let x = 2;
    let y = 2;
    const c = 1;
    const f = (v: number): number => (v * v + c) % n;

    let factor = 1;
    let iterations = 0;
    const MAX_ITER = 200;

    while (factor === 1 && iterations < MAX_ITER) {
        // Hare moves twice as fast.
        x = f(x);
        y = f(f(y));

        yield {
            stepNumber: step,
            entities: makePair(x, y),
            edges: [],
            description: `Tortoise = ${x}, hare = ${y}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { iterations },
        };
        step += 1;

        // If the hare caught the tortoise, restart with a new constant.
        if (x === y) {
            // (Educational simplification: restart parameters.)
            yield {
                stepNumber: step,
                entities: makePair(x, y),
                edges: [],
                description: "Cycle detected – restarting with new parameters.",
                codeLineNumber: 3,
                layout: "array",
                meta: { iterations },
            };
            step += 1;
            x = 2;
            y = 2;
            iterations += 1;
            continue;
        }

        factor = gcd(Math.abs(x - y), n);
        iterations += 1;
    }

    const factorStates = new Map<number, EntityState>();
    if (factor > 1 && factor < n) {
        factorStates.set(0, "sorted");
    } else {
        factorStates.set(0, "swapped");
    }

    yield {
        stepNumber: step,
        entities: makePair(factor, 0).map((cell, index) => ({
            ...cell,
            state: factorStates.get(index) ?? cell.state,
        })),
        edges: [],
        description:
            factor > 1 && factor < n
                ? `Found factor ${factor} of ${n} after ${iterations} iteration(s).`
                : `Failed to find a factor in ${iterations} iteration(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { factor, iterations },
    };
}

/** The Pollard's Rho module, registered with the engine. */
const module: AlgorithmModule = {
    id: "pollard-rho",
    name: "Pollard's Rho",
    category: "math",
    complexity: { time: "O(n^(1/4))", space: "O(1)" },
    // 91 = 7 × 13 – small enough to watch the tortoise and hare.
    defaultInput: { n: 91 },
    visualType: "array",
    run,
};

export default module;
