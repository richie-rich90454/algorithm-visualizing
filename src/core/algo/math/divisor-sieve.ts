/**
 * divisor-sieve.ts - Divisor-Counting Sieve (tau function)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Counts how many positive divisors each integer from 1 to n has. Instead of
 * factoring every number separately, the sieve walks each candidate divisor d
 * once and adds one to every multiple of d. After all d have been visited,
 * cell k holds tau(k), the number of divisors of k. This is the divisor-count
 * sieve; it is distinct from the divisor-sum sieve, which accumulates the
 * value of each divisor rather than counting it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) because the multiples of d sum to n/1 + n/2 + ... + n/n
 *   Space: O(n) for the tau table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per integer k shows the tau value accumulated so far.
 *   - Cells hit by the current divisor d are highlighted as COMPARING.
 *   - The final frame paints every cell SORTED and stores table in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** One grid cell holding a divisor count. */
function cell(index: number, value: number, state: EntityState): VisualEntity {
    const col = index % 10;
    const row = Math.floor(index / 10);
    return {
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col, number: index + 1 },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.trunc(task.n)) : 24;
    const tau = new Array<number>(n + 1).fill(0);
    let step = 0;

    const cells = (active: Set<number>, final = false): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let k = 1; k <= n; k += 1) {
            const state: EntityState = final
                ? "sorted"
                : active.has(k)
                  ? "comparing"
                  : "idle";
            out.push(cell(k - 1, tau[k] as number, state));
        }
        return out;
    };

    yield {
        stepNumber: step,
        entities: cells(new Set()),
        edges: [],
        description: `Initialize tau(k) to zero for every k from 1 to ${n}, then sweep candidate divisors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, divisor: 0, tauN: 0, step },
    };
    step += 1;

    for (let d = 1; d <= n; d += 1) {
        const touched = new Set<number>();
        for (let m = d; m <= n; m += d) {
            tau[m] = (tau[m] as number) + 1;
            touched.add(m);
        }
        yield {
            stepNumber: step,
            entities: cells(touched),
            edges: [],
            description: `Divisor ${d}: add one to tau at each of its ${touched.size} multiple(s) up to ${n}.`,
            codeLineNumber: d === n ? 4 : 2,
            layout: "grid",
            meta: { n, divisor: d, tauN: tau[n], touched: touched.size, step },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(new Set(), true),
        edges: [],
        description: `Done: tau(${n}) = ${tau[n]}, and the table holds the divisor count of every value up to ${n}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, divisor: n, tauN: tau[n], table: tau.slice(1), step },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A number d divides exactly the multiples of d, so rather than asking each integer which numbers divide it, turn the question around. Visit each divisor once and drop one mark into every multiple's bucket. Once every divisor has passed, the bucket for k counts precisely the divisors of k.",
        invariants: [
            "After visiting divisor d, tau(k) counts the divisors of k that are at most d.",
            "Divisor d contributes exactly one mark to d, 2d, 3d, and so on.",
            "Every tau value is a nonnegative integer no larger than n.",
        ],
        correctness:
            "For a fixed k, the inner loop adds one to tau(k) if and only if the current d divides k, because it visits k exactly when k is a multiple of d. Summing over all d from 1 to n therefore counts every positive divisor of k once and no nondivisor at all, which is the definition of tau(k). The final table is correct for every k from 1 to n.",
        complexityRationale:
            "The inner loop runs n/d times for divisor d, so the total number of increments is n times the harmonic sum up to n, which is O(n log n). The tau table is the only growing structure, using O(n) space; the frame's touched set is bounded by n as well.",
        uses: [
            "Computing divisor counts for all values up to a bound in number theory queries",
            "Classifying highly composite and abundant numbers",
            "Counting divisors as a subroutine in multiplicative-function sieves",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 1, Section 1.2.4",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 2",
        ],
        workedExample:
            "For n = 6 the sweep marks multiples of 1 (all six), of 2 (2, 4, 6), of 3 (3, 6), of 4 (4), of 5 (5), and of 6 (6). The resulting counts are tau(1)=1, tau(2)=2, tau(3)=2, tau(4)=3, tau(5)=2, tau(6)=4, which match the divisor lists of each number.",
    },
    id: "divisor-sieve",
    name: "Divisor-Counting Sieve",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { n: 24 },
    visualType: "grid",
    run,
    pseudocode: [
        "set tau(k) to zero for every k from one to n",
        "for each candidate divisor d from one to n",
        "for each multiple m of d up to n",
        "increment tau(m) by one",
        "after all divisors, every tau(k) is the divisor count of k",
        "done: report the completed divisor-count table",
    ],
};

export default module;
