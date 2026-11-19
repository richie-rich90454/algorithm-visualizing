/**
 * totient-sieve.ts - Totient Sieve (Euler's Phi Over a Range)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The totient sieve computes Euler's phi function for every value up to n in
 * one linear pass. It is a linear sieve that also maintains phi: when a prime
 * p first appears phi(p) = p - 1, and a composite i*p gets phi(i)*p when p
 * divides i, otherwise phi(i)*(p-1). This produces the whole table in O(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - each composite is written exactly once
 *   Space: O(n) for the phi table and composite flags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells 1..n display the running phi value for each integer.
 *   - The current integer is ACTIVE; a newly written composite is SORTED.
 *   - Confirmed primes keep their phi = value - 1 entries highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one phi cell. */
function cell(num: number, value: number, state: EntityState): VisualEntity {
    const cols = 10;
    return {
        id: `cell-${num}`,
        type: "cell" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor((num - 1) / cols), col: (num - 1) % cols, num },
    };
}

/** Build the full table of phi cells with optional state overrides. */
function makeCells(phi: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let num = 1; num < phi.length; num += 1) {
        cells.push(cell(num, phi[num] ?? 0, states.get(num) ?? "idle"));
    }
    return cells;
}

/** The Totient Sieve generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 30;

    if (!Number.isFinite(n) || n < 1) {
        yield {
            stepNumber: 0,
            entities: [cell(1, 0, "highlight")],
            edges: [],
            description: "The totient sieve needs n >= 1.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { phi: [0], n },
        };
        return;
    }

    const phi = new Array<number>(n + 1).fill(0);
    for (let i = 0; i <= n; i += 1) {
        phi[i] = i;
    }
    const composite = new Array<boolean>(n + 1).fill(false);
    const primes: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(phi),
        edges: [],
        description: `Sieve phi(1..${n}): start with phi(k) = k for every k.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, phi: phi.slice(1), primes: 0 },
    };
    step += 1;

    for (let i = 2; i <= n; i += 1) {
        if (!composite[i]) {
            primes.push(i);
            phi[i] = i - 1;
        }
        for (const p of primes) {
            const multiple = i * p;
            if (multiple > n) {
                break;
            }
            composite[multiple] = true;
            if (i % p === 0) {
                phi[multiple] = (phi[i] as number) * p;
            } else {
                phi[multiple] = (phi[i] as number) * (p - 1);
            }
        }
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(phi, states),
            edges: [],
            description: `After i = ${i}: phi(${i}) = ${phi[i]}, known primes = ${primes.length}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { n, phi: phi.slice(1), i, primes: primes.length },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (const p of primes) {
        finalStates.set(p, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(phi, finalStates),
        edges: [],
        description: `Computed phi(1..${n}); phi(${n}) = ${phi[n]} using ${primes.length} primes.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, phi: phi.slice(1), phiN: phi[n], primes: primes.length },
    };
}

/** The Totient Sieve module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Euler's totient phi(n) counts the integers up to n that are coprime to n. Computing it one value at a time means factoring each input, but a linear sieve can build every value from 1 to n at once. Starting from phi(k) = k, each prime lowers the running value by a factor of (1 - 1/p), and the smallest-prime-factor rule of the linear sieve writes each composite once.",
        invariants: [
            "phi(p) = p - 1 for every prime p discovered.",
            "For a composite i*p where p divides i, phi(i*p) = phi(i) * p.",
            "For a composite i*p where p does not divide i, phi(i*p) = phi(i) * (p - 1).",
        ],
        correctness:
            "The phi recurrence follows from multiplicativity and phi(p^k) = p^k - p^(k-1). When p divides i, the prime power already sits inside i, so multiplying by p scales phi by p; otherwise p is a new prime factor and scales phi by p - 1. The linear sieve reaches each composite through its smallest prime factor exactly once, so every phi value is set correctly and never overwritten.",
        complexityRationale:
            "Each composite number is assigned once, so the total work is linear in n, giving O(n) time. The phi table, composite flags, and prime list each hold O(n) entries, so space is O(n).",
        uses: [
            "Precomputing phi for every residue in a large range",
            "Counting generators of cyclic groups used in cryptography",
            "Building Euler's theorem and totient-sum queries over ranges",
        ],
        references: [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 2",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.2.6",
        ],
        workedExample:
            "Sieving to 10: phi(2) = 1 when 2 is prime, phi(4) = phi(2)*2 = 2, phi(6) = phi(3)*(2-1) = 2, phi(8) = phi(4)*2 = 4, and phi(9) = phi(3)*3 = 6. The table 1, 1, 2, 2, 4, 2, 6, 4, 6, 4 matches direct gcd counts.",
    },
    id: "totient-sieve",
    name: "Totient Sieve",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize phi[k] = k for k = 1..n",
        "for each i from 2 to n, if i unmarked make it a prime with phi = i - 1",
        "for each known prime p while i*p <= n mark the composite i*p",
        "if p divides i set phi[i*p] = phi[i]*p, else phi[i]*(p-1)",
        "record the freshly computed phi values",
        "done: phi(1..n) is the full totient table",
    ],
};

export default module;
