/**
 * mann-whitney-u-test.ts - Mann-Whitney U Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Mann-Whitney U test checks whether two independent samples come from the
 * same distribution. It pools the observations, ranks them (averaging ranks for
 * ties), and counts how often observations from one sample outrank those from
 * the other. The smaller of the two U statistics is compared to its exact null
 * distribution for small samples, or to a tie-corrected normal approximation
 * for larger ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) to rank plus O(C(N,n1)) for the exact null enumeration
 *   Space: O(N) for the pooled, ranked sample
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid whose columns are the pooled observations sorted by value.
 *   - Rows show the value, its rank, and which sample it came from.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Average ranks for ties, returning rank by original position. */
function rankData(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
        let j = i + 1;
        while (j < indexed.length && (indexed[j] as { value: number }).value === (indexed[i] as { value: number }).value) {
            j += 1;
        }
        const averageRank = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) {
            ranks[(indexed[k] as { index: number }).index] = averageRank;
        }
        i = j;
    }
    return ranks;
}

/** Enumerate every split choosing n1 of N ranks to get the exact min-U null. */
function exactPValue(ranks: number[], n1: number, observedU: number): number {
    const n = ranks.length;
    let count = 0;
    let total = 0;
    const chosen: number[] = [];
    const recurse = (start: number): void => {
        if (chosen.length === n1) {
            total += 1;
            let r1 = 0;
            for (const idx of chosen) r1 += ranks[idx] ?? 0;
            const u1 = r1 - (n1 * (n1 + 1)) / 2;
            const u2 = n1 * (n - n1) - u1;
            if (Math.min(u1, u2) <= observedU + 1e-9) count += 1;
            return;
        }
        for (let i = start; i < n; i += 1) {
            chosen.push(i);
            recurse(i + 1);
            chosen.pop();
        }
    };
    recurse(0);
    return total === 0 ? 1 : count / total;
}

/** Abramowitz-Stegun approximation to the standard normal CDF. */
function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = 0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3 - 1.821255978 * t ** 4 + 1.330274429 * t ** 5;
    const upper = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI) * poly;
    return z >= 0 ? 1 - upper : upper;
}

/** Tie-corrected normal approximation to the two-sided min-U p-value. */
function approxPValue(ranks: number[], n1: number, observedU: number): number {
    const n = ranks.length;
    const n2 = n - n1;
    const mean = (n1 * n2) / 2;
    const counts = new Map<number, number>();
    for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
    let tieTerm = 0;
    for (const size of counts.values()) tieTerm += size ** 3 - size;
    const variance = (n1 * n2 / 12) * (n + 1 - tieTerm / (n * (n - 1)));
    if (variance <= 0) return 1;
    const z = (observedU - mean + 0.5) / Math.sqrt(variance);
    return Math.min(1, 2 * normalCdf(z));
}

/** Build the value, rank, and group rows for the pooled sample. */
function makeCells(
    pooled: Array<{ value: number; rank: number; group: string }>,
    revealed: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < pooled.length; col += 1) {
            const entry = pooled[col] as { value: number; rank: number; group: string };
            let state: EntityState = "idle";
            if (row === 2) state = entry.group === "x" ? "active" : "visited";
            if (row === 1 && col < revealed) state = "comparing";
            let label: string;
            if (row === 0) label = String(entry.value);
            else if (row === 1) label = col < revealed ? entry.rank.toFixed(1) : "-";
            else label = entry.group === "x" ? "X" : "Y";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value: row === 0 ? entry.value : row === 1 ? entry.rank : entry.group === "x" ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, rank: entry.rank, group: entry.group },
            });
        }
    }
    return entities;
}

/** The Mann-Whitney U generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[] } | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length > 0 ? task.x.map(Number) : [5, 8, 6, 9, 7];
    const y = Array.isArray(task.y) && task.y.length > 0 ? task.y.map(Number) : [3, 4, 1, 2, 0];
    const n1 = x.length;
    const n2 = y.length;
    const all = [...x, ...y];
    const ranks = rankData(all);
    const pooled = all
        .map((value, index) => ({ value, rank: ranks[index] as number, group: index < n1 ? "x" : "y" }))
        .sort((a, b) => a.value - b.value);

    let r1 = 0;
    for (let i = 0; i < n1; i += 1) r1 += ranks[i] as number;
    const u1 = r1 - (n1 * (n1 + 1)) / 2;
    const u2 = n1 * n2 - u1;
    const u = Math.min(u1, u2);
    const n = n1 + n2;
    const exact = n <= 14;
    const pValue = exact ? exactPValue(ranks, n1, u) : approxPValue(ranks, n1, u);

    yield {
        stepNumber: 0,
        entities: makeCells(pooled, 0),
        edges: [],
        description: `Pool ${n} observations from samples of size ${n1} and ${n2}, then rank them from smallest to largest.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: n, n1, n2, u1: 0, u2: 0, u: 0, pValue: 1, method: exact ? "exact" : "normal" },
    };
    let step = 1;
    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(pooled, i + 1),
            edges: [],
            description: `Ranked observation ${i + 1} of ${n}: value ${(pooled[i] as { value: number }).value} has rank ${(pooled[i] as { rank: number }).rank.toFixed(1)} in sample ${(pooled[i] as { group: string }).group}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 3, cols: n, n1, n2, u1: 0, u2: 0, u: 0, pValue: 1, method: exact ? "exact" : "normal" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(pooled, n),
        edges: [],
        description: `U1=${u1.toFixed(1)}, U2=${u2.toFixed(1)}, U=${u.toFixed(1)}; ${exact ? "exact" : "normal-approximation"} p-value ${pValue.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3, cols: n, n1, n2, u1, u2, u, pValue, method: exact ? "exact" : "normal" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing averages, the Mann-Whitney test asks whether values from one sample tend to outrank values from the other. Pool the observations and replace them by ranks. If the two samples are intermingled, their rank sums are close to what chance gives; if one sample mostly sits at the top, its rank sum is unusually large.",
        invariants: [
            "Tied observations receive the average of the ranks they would occupy.",
            "The two U statistics always satisfy U1 + U2 = n1 * n2.",
            "The reported U is the smaller of U1 and U2.",
        ],
        correctness:
            "U1 counts, over all cross-sample pairs, how many times a value from sample x exceeds a value from sample y, with ties contributing half. Under the null both samples are exchangeable, so every assignment of n1 ranks to sample x is equally likely; enumerating those assignments gives the exact probability of observing a U at least as extreme. For large samples the tie-corrected normal limit of that same distribution is used.",
        complexityRationale:
            "Sorting the pooled sample costs O(N log N). The exact null enumerates C(N, n1) rank assignments, feasible for N up to 14; beyond that a constant-time normal approximation replaces enumeration. Space is O(N) for the pooled ranked sample.",
        uses: [
            "Comparing two groups when the data are ordinal or clearly non-normal",
            "A nonparametric alternative to the two-sample t-test",
            "Analyzing Likert-scale survey responses between cohorts",
        ],
        references: [
            "Mann and Whitney, On a Test of Whether One of Two Random Variables is Stochastically Larger, 1947",
            "Wilcoxon, Individual Comparisons by Ranking Methods, 1945",
        ],
        workedExample:
            "Sample x = (5, 8, 6, 9, 7) and y = (3, 4, 1, 2, 0) pool to ranks 1 through 10 with x holding ranks 6 through 10. Then U1 = 55 minus 15 = 25, U2 = 25 minus 25 = 0, so U = 0, the most extreme separation possible for these sizes.",
    },
    id: "mann-whitney-u-test",
    name: "Mann-Whitney U Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N + C(N,n1))", space: "O(N)" },
    defaultInput: { x: [5, 8, 6, 9, 7], y: [3, 4, 1, 2, 0] },
    visualType: "grid",
    run,
    pseudocode: [
        "pool both samples and sort the observations",
        "assign ranks, averaging ranks for ties",
        "sum the ranks of the first sample",
        "set U1 to that sum minus n1 times (n1+1) over two",
        "set U2 to n1 times n2 minus U1",
        "take U as the smaller of U1 and U2",
        "compare U to its null distribution and report a p-value",
    ],
};

export default module;
