/**
 * sieve-eratosthenes.ts – Sieve of Eratosthenes
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Sieve of Eratosthenes finds every prime up to a limit n. It starts with
 * all numbers marked "prime", then repeatedly takes the next unmarked number
 * (which must be prime) and marks all of its multiples as composite. Only
 * multiples from p² onward need crossing out, since smaller multiples were
 * already handled by smaller primes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log log n) – the harmonic-series bound on marking work
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The prime currently being processed is YELLOW (comparing).
 *   - Its multiples being crossed out are RED (swapped).
 *   - Confirmed primes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The oldest known prime sieve; still the fastest for small n.
 *   - The marking pattern (p, 2p, 3p, …) is visually striking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The sieve limit used when no input is provided. */
const DEFAULT_N = 60;

/**
 * Build a grid of number cells for the sieve.
 *
 * @param isComposite Whether each index is known composite.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a 10-column grid layout.
 */
function makeCells(
    limit: number,
    isComposite: boolean[],
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
 * The Sieve of Eratosthenes generator.
 *
 * @param input `{ n }` – the upper bound.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const limit = typeof task.n === "number" ? task.n : DEFAULT_N;

    const isComposite = new Array<boolean>(limit + 1).fill(false);
    const primes: number[] = [];
    let step = 0;

    // Frame 0: all numbers start unmarked.
    yield {
        stepNumber: step,
        entities: makeCells(limit, isComposite),
        edges: [],
        description: `Sieve of Eratosthenes up to ${limit}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { primes: 0 },
    };
    step += 1;

    // Walk each candidate number.
    for (let p = 2; p <= limit; p += 1) {
        // A number still unmarked is prime.
        if (!isComposite[p]) {
            primes.push(p);

            const primeStates = new Map<number, EntityState>([[p, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(limit, isComposite, primeStates),
                edges: [],
                description: `${p} is prime – crossing out its multiples.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { primes: primes.length },
            };
            step += 1;

            // Mark all multiples of p starting at p².
            for (let multiple = p * p; multiple <= limit; multiple += p) {
                isComposite[multiple] = true;

                const multipleStates = new Map<number, EntityState>([[p, "sorted"]]);
                for (let m = p * p; m <= multiple; m += p) {
                    multipleStates.set(m, "swapped");
                }
                yield {
                    stepNumber: step,
                    entities: makeCells(limit, isComposite, multipleStates),
                    edges: [],
                    description: `Marked ${multiple} as composite (multiple of ${p}).`,
                    codeLineNumber: 3,
                    layout: "grid",
                    meta: { primes: primes.length },
                };
                step += 1;
            }

            // The prime is now confirmed.
            const doneStates = new Map<number, EntityState>([[p, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeCells(limit, isComposite, doneStates),
                edges: [],
                description: `Finished processing prime ${p}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { primes: primes.length },
            };
            step += 1;
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
        description: `Found ${primes.length} primes up to ${limit}: ${primes.join(", ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { primes: primes.length },
    };
}

/** The Sieve of Eratosthenes module, registered with the engine. */
const module: AlgorithmModule = {
    id: "sieve-eratosthenes",
    name: "Sieve of Eratosthenes",
    category: "math",
    complexity: { time: "O(n log log n)", space: "O(n)" },
    // A limit that fills the grid nicely and shows several marking passes.
    defaultInput: { n: DEFAULT_N },
    visualType: "grid",
    run,
};

export default module;
