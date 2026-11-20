/**
 * partition-number-hardy-ramanujan.ts - Partition Numbers by Rademacher's Series.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hardy-Ramanujan-Rademacher formula is an exact rapidly convergent series
 * for the partition number p(n). Each term combines a Dedekind sum, a complex
 * exponential root of unity and the derivative of a hyperbolic-sine expression.
 * Summing a short prefix and rounding gives p(n) exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K^2) for K series terms and their Dedekind sums
 *   Space: O(K) for the displayed contribution table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is a series index k with its root-of-unity sum and term.
 *   - The newest row is highlighted and the final row is green.
 *   - The final frame reports p(n) and the number of terms used.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PartitionInput {
    n?: number;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

/** The Dedekind sum s(h,k). */
function dedekind(h: number, k: number): number {
    let sum = 0;
    for (let r = 1; r < k; r += 1) {
        const first = r / k - 0.5;
        const raw = (h * r) / k;
        const second = Number.isInteger(raw) ? 0 : raw - Math.floor(raw) - 0.5;
        sum += first * second;
    }
    return sum;
}

/** The complex root-of-unity sum A_k(n). */
function rootSum(n: number, k: number): { re: number; im: number } {
    let re = 0;
    let im = 0;
    for (let h = 1; h <= k; h += 1) {
        if (gcd(h, k) !== 1) {
            continue;
        }
        const argument = Math.PI * (dedekind(h, k) - (2 * n * h) / k);
        re += Math.cos(argument);
        im += Math.sin(argument);
    }
    return { re, im };
}

interface Contribution {
    k: number;
    magnitude: number;
    term: number;
}

/** Exact p(n) from a truncated Rademacher series, rounded to an integer. */
function computePartition(n: number): { value: number; contributions: Contribution[] } {
    const s = n - 1 / 24;
    const C = Math.PI * Math.sqrt(2 / 3);
    const K = Math.max(10, Math.ceil(2 * Math.sqrt(n) + 8));
    const contributions: Contribution[] = [];
    let sumReal = 0;
    for (let k = 1; k <= K; k += 1) {
        const A = rootSum(n, k);
        const u = (C / k) * Math.sqrt(s);
        const dphi = C * Math.cosh(u) / (2 * k * s) - Math.sinh(u) / (2 * Math.pow(s, 1.5));
        const scale = Math.sqrt(k) * dphi;
        const term = A.re * scale;
        sumReal += term;
        contributions.push({ k, magnitude: Math.hypot(A.re, A.im), term });
    }
    const raw = sumReal / (Math.PI * Math.SQRT2);
    return { value: Math.round(raw), contributions };
}

function makeEntities(rows: Contribution[], done: boolean, shown: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < shown; i += 1) {
        const row = rows[i]!;
        const values: Array<[string, number]> = [
            ["k", row.k],
            ["|Ak|", row.magnitude],
            ["term", row.term],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${Number.isFinite(value) ? value.toPrecision(7) : value}`,
                value,
                state: (done ? "sorted" : i === shown - 1 ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PartitionInput | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.trunc(task.n)) : 20;
    const { value, contributions } = computePartition(n);

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Computing the partition number p(${n}) from the Hardy-Ramanujan-Rademacher series.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: contributions.length, cols: 3, n, shown: 0 },
    };

    for (let i = 0; i < contributions.length; i += 1) {
        const row = contributions[i]!;
        yield {
            stepNumber: i + 1,
            entities: makeEntities(contributions, false, i + 1),
            edges: [],
            description: `Term k=${row.k}: root-of-unity magnitude ${row.magnitude.toPrecision(5)} contributes ${row.term.toPrecision(6)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: contributions.length, cols: 3, n, shown: i + 1, k: row.k },
        };
    }

    yield {
        stepNumber: contributions.length + 1,
        entities: makeEntities(contributions, true, contributions.length),
        edges: [],
        description: `Done: p(${n}) = ${value} from ${contributions.length} series terms.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: contributions.length, cols: 3, n, shown: contributions.length, value, terms: contributions.length },
    };
}

const module: AlgorithmModule = {
    id: "partition-number-hardy-ramanujan",
    name: "Partition Number (Hardy-Ramanujan-Rademacher)",
    category: "math",
    complexity: { time: "O(K^2)", space: "O(K)" },
    defaultInput: { n: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "set s to n minus 1/24 and C to pi times sqrt(2/3)",
        "for each series index k up to the chosen cutoff",
        "compute the root-of-unity sum A_k from Dedekind sums",
        "compute the derivative of sinh((C/k)sqrt(s))/sqrt(s)",
        "multiply sqrt(k), A_k and that derivative, then add to the total",
        "divide the total by pi times sqrt(2) and round",
        "done: report the integer as the partition number p(n)",
    ],
    education: {
        intuition:
            "The partition function p(n) counts the ways to write n as a sum of positive integers. Hardy and Ramanujan found an asymptotic formula, and Rademacher made it exact by adding a sum of carefully weighted root-of-unity terms. Each term uses the modular symmetries of the generating function, and the series converges so quickly that a short prefix determines p(n) exactly.",
        invariants: [
            "The parameter s equals n minus 1/24 and stays fixed for the run.",
            "Each A_k is a sum of complex roots of unity over integers coprime to k.",
            "The term for k combines A_k with the derivative of the hyperbolic-sine factor.",
            "Rounding the final real total yields an integer partition number.",
        ],
        correctness:
            "Rademacher's theorem states that the infinite series equals p(n) exactly, derived from the modular transformation of the partition generating function and a contour integral with a complete set of singularities. Truncating after K terms leaves an error below one half for n in the displayed range, so rounding to the nearest integer returns the exact partition number.",
        complexityRationale:
            "Each of the K terms requires a Dedekind sum over at most k values, so total work is O(K squared). The visualization keeps only one row per term, giving O(K) space for the contribution table.",
        uses: [
            "Computing partition numbers for large n without dynamic programming",
            "Testing modular-form identities and asymptotics",
            "Counting integer partitions in combinatorics and statistical mechanics",
        ],
        references: [
            "Rademacher, On the Partition Function p(n), 1937",
            "Andrews, The Theory of Partitions, chapter on the circle method",
        ],
        workedExample:
            "For n=20 the series converges to p(20)=627. As a check, the smaller values are p(4)=5, p(5)=7 and p(10)=42, all recovered by the same truncated series after rounding.",
    },
};

export default module;
