/**
 * mobius-inversion.ts – Möbius Inversion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Möbius function μ(n) is defined by prime factorization: μ(1) = 1,
 * μ(n) = 0 if n has a squared prime factor, and μ(n) = (−1)^k when n is the
 * product of k distinct primes. Möbius inversion is the identity
 *
 *   if g(n) = Σ_{d|n} f(d)   then   f(n) = Σ_{d|n} μ(d)·g(n/d),
 *
 * which "inverts" a divisor-sum relationship. This visualization computes μ
 * for a range and demonstrates the inversion identity on a simple example.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sieve-style computation
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows μ(n) for n = 1..limit.
 *   - Positive μ cells are GREEN (sorted), zero GRAY (unvisited),
 *     negative RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - μ is the "inversion kernel" of divisor sums.
 *   - Powers inclusion-exclusion over the divisors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The range limit used when no input is provided. */
const DEFAULT_N = 40;

/**
 * Build a grid of cells showing μ(n).
 *
 * @param mu The Möbius values.
 * @returns Cell entities in a 10-column grid.
 */
function makeCells(mu: number[]): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const cols = 10;
    for (let num = 1; num < mu.length; num += 1) {
        const value = mu[num] ?? 0;
        const row = Math.floor((num - 1) / cols);
        const col = (num - 1) % cols;
        cells.push({
            id: `cell-${num}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (value > 0 ? "sorted" : value < 0 ? "swapped" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        });
    }
    return cells;
}

/**
 * The Möbius Inversion generator.
 *
 * @param input `{ n }` – the range limit.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const limit = typeof task.n === "number" ? task.n : DEFAULT_N;

    let step = 0;

    // Frame 0: an empty grid to announce the computation.
    yield {
        stepNumber: step,
        entities: makeCells([1, 1]),
        edges: [],
        description: `Computing the Möbius function μ(n) for n = 1..${limit}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Compute μ via a sieve: mu[n] starts as 1, multiply by −1 for each prime
    // factor, and set to 0 if a squared prime factor is found.
    const mu = new Array<number>(limit + 1).fill(1);
    const isComposite = new Array<boolean>(limit + 1).fill(false);
    const primes: number[] = [];

    mu[1] = 1;
    for (let i = 2; i <= limit; i += 1) {
        if (!isComposite[i]) {
            primes.push(i);
            mu[i] = -1;
        }
        for (const prime of primes) {
            const multiple = i * prime;
            if (multiple > limit) {
                break;
            }
            isComposite[multiple] = true;
            // If prime divides i, the multiple has a squared prime factor.
            if (i % prime === 0) {
                mu[multiple] = 0;
                break;
            }
            mu[multiple] = -(mu[i] ?? 0);
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(mu),
        edges: [],
        description: `μ computed: 1 for square-free with even factor count, −1 for odd, 0 for squares.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { limit },
    };
    step += 1;

    // Demonstrate the inversion identity on a concrete divisor sum.
    // Let g(n) = Σ_{d|n} f(d) with f = μ. Then Σ_{d|n} μ(d)·g(n/d) = f(n) = μ(n).
    const demoN = 12;
    const gOf = (n: number): number => {
        let sum = 0;
        for (let d = 1; d <= n; d += 1) {
            if (n % d === 0) {
                sum += mu[d] ?? 0;
            }
        }
        return sum;
    };
    // Invert: f(n) = Σ_{d|n} μ(d)·g(n/d).
    const inverted = (n: number): number => {
        let sum = 0;
        for (let d = 1; d <= n; d += 1) {
            if (n % d === 0) {
                sum += (mu[d] ?? 0) * gOf(n / d);
            }
        }
        return sum;
    };

    const f12 = inverted(demoN);

    yield {
        stepNumber: step,
        entities: makeCells(mu),
        edges: [],
        description: `Inversion demo: Σ_{d|${demoN}} μ(d)·g(${demoN}/d) = ${f12}, which equals f(${demoN}) = μ(${demoN}) = ${mu[demoN]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { demoN, inverted: f12 },
    };
}

/** The Möbius Inversion module, registered with the engine. */
const module: AlgorithmModule = {
    id: "mobius-inversion",
    name: "Möbius Inversion",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // A range that shows all three μ values clearly.
    defaultInput: { n: DEFAULT_N },
    visualType: "grid",
    run,
};

export default module;
