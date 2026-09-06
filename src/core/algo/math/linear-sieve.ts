/**
 * linear-sieve.ts – Linear Sieve (Euler's sieve)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The linear sieve finds all primes up to n in guaranteed O(n) time by
 * ensuring every composite is marked exactly once. It keeps a list of primes
 * found so far; each composite is written by its smallest prime factor, and
 * the inner loop stops as soon as the current prime would divide the number,
 * so no composite is ever crossed out twice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each composite is marked exactly once
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The number being processed is YELLOW (comparing).
 *   - The composite it writes is RED (swapped).
 *   - Confirmed primes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "mark once" invariant is the conceptual heart.
 *   - Naturally computes the smallest prime factor of every number too.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The sieve limit used when no input is provided. */
const DEFAULT_N = 60;

/**
 * Build a grid of number cells for the sieve.
 *
 * @param limit The upper bound.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a 10-column grid layout.
 */
function makeCells(
    limit: number,
    isComposite: boolean[] = [],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const cols = 10;
    for (let num = 2; num <= limit; num += 1) {
        const row = Math.floor((num - 2) / cols);
        const col = (num - 2) % cols;
        cells.push({
            id: `cell-${num}`,
            type: "cell" as const,
            label: String(num),
            value: num,
            state: states.get(num) ?? (isComposite[num] ? "swapped" : "unvisited"),
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
 * The Linear Sieve generator.
 *
 * @param input `{ n }` – the upper bound.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const limit = typeof task.n === "number" ? task.n : DEFAULT_N;

    const isComposite = new Array<boolean>(limit + 1).fill(false);
    const primes: number[] = [];
    let step = 0;

    // Frame 0: the untouched grid.
    yield {
        stepNumber: step,
        entities: makeCells(limit),
        edges: [],
        description: `Linear sieve up to ${limit} – every composite marked exactly once.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { primes: 0 },
    };
    step += 1;

    // The linear sieve main loop.
    for (let i = 2; i <= limit; i += 1) {
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(limit, isComposite, states),
            edges: [],
            description: `Processing ${i}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { primes: primes.length },
        };
        step += 1;

        // If i is unmarked, it is prime.
        if (!isComposite[i]) {
            primes.push(i);
        }

        // Mark composites i·p for each prime p, stopping when p divides i.
        for (const prime of primes) {
            const multiple = i * prime;
            if (multiple > limit) {
                break;
            }
            isComposite[multiple] = true;

            const markStates = new Map<number, EntityState>([
                [i, "comparing"],
                [multiple, "swapped"],
            ]);
            yield {
                stepNumber: step,
                entities: makeCells(limit, isComposite, markStates),
                edges: [],
                description: `Marked ${multiple} = ${i} × ${prime}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { primes: primes.length },
            };
            step += 1;

            // The crucial stopping rule: this composite's smallest prime
            // factor is `prime`, so do not mark it with larger primes again.
            if (i % prime === 0) {
                break;
            }
        }
    }

    // Final frame: paint every prime green.
    const finalStates = new Map<number, EntityState>();
    for (const prime of primes) {
        finalStates.set(prime, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(limit, isComposite, finalStates),
        edges: [],
        description: `Found ${primes.length} primes up to ${limit} in linear time.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { primes: primes.length },
    };
}

/** The Linear Sieve module, registered with the engine. */
const module: AlgorithmModule = {
    id: "linear-sieve",
    name: "Linear Sieve",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    // Same limit as the classic sieve for a direct comparison.
    defaultInput: { n: DEFAULT_N },
    visualType: "grid",
    run,
};

export default module;
