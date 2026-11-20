/**
 * ansari-bradley-test.ts - Ansari-Bradley Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Ansari-Bradley test compares the spreads of two independent samples that
 * share a common center. Pool the observations, find the combined median, and
 * rank each observation by its distance from that median: the value nearest the
 * center gets the smallest score and the most extreme value the largest. If one
 * sample is more spread out, its observations collect the larger scores. An
 * exact p-value comes from enumerating which scores belong to the first sample.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) to rank plus O(C(N,n)) for the exact null
 *   Space: O(N) for the pooled, scored sample
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid whose columns are the pooled observations ordered by distance.
 *   - Rows show the value, its distance from the median, its score, and group.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function midranks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
        let j = i + 1;
        while (j < indexed.length && (indexed[j] as { value: number }).value === (indexed[i] as { value: number }).value) j += 1;
        const averageRank = (i + 1 + j) / 2;
        for (let t = i; t < j; t += 1) ranks[(indexed[t] as { index: number }).index] = averageRank;
        i = j;
    }
    return ranks;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] as number : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Exact two-sided p-value over all ways of choosing n scores for sample x. */
function exactPValue(scores: number[], n: number, observedT: number): number {
    const N = scores.length;
    const center = scores.reduce((sum, s) => sum + s, 0) * (n / N);
    const observedDeviation = Math.abs(observedT - center);
    let extreme = 0;
    let total = 0;
    const chosen: number[] = [];
    const recurse = (start: number): void => {
        if (chosen.length === n) {
            total += 1;
            const t = chosen.reduce((sum, idx) => sum + (scores[idx] ?? 0), 0);
            if (Math.abs(t - center) >= observedDeviation - 1e-9) extreme += 1;
            return;
        }
        for (let i = start; i < N; i += 1) {
            chosen.push(i);
            recurse(i + 1);
            chosen.pop();
        }
    };
    recurse(0);
    return total === 0 ? 1 : extreme / total;
}

function makeCells(ordered: Array<{ value: number; distance: number; score: number; group: string }>, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows: Array<[string, (e: { value: number; distance: number; score: number; group: string }) => string]> = [
        ["value", (e) => String(e.value)],
        ["dist", (e) => e.distance.toFixed(2)],
        ["score", (e) => e.score.toFixed(1)],
        ["group", (e) => e.group],
    ];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < ordered.length; col += 1) {
            const entry = ordered[col] as { value: number; distance: number; score: number; group: string };
            const shown = col < revealed;
            const state: EntityState = row === 3 ? (entry.group === "x" ? "active" : "visited") : shown ? (row === 2 ? "comparing" : "idle") : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? rows[row]![1](entry) : "-",
                value: row === 0 ? entry.value : row === 1 ? entry.distance : row === 2 ? entry.score : entry.group === "x" ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, score: entry.score, group: entry.group },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[] } | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length > 0 ? task.x.map(Number) : [4, 6, 8, 10, 12];
    const y = Array.isArray(task.y) && task.y.length > 0 ? task.y.map(Number) : [6, 7, 8, 9, 10];
    const n = x.length;
    const m = y.length;
    const N = n + m;
    const pooled = [
        ...x.map((value) => ({ value, group: "x" })),
        ...y.map((value) => ({ value, group: "y" })),
    ];
    const med = median(pooled.map((p) => p.value));
    const distances = pooled.map((p) => Math.abs(p.value - med));
    const scores = midranks(distances);
    const ordered = pooled
        .map((p, i) => ({ value: p.value, distance: distances[i] as number, score: scores[i] as number, group: p.group }))
        .sort((a, b) => a.distance - b.distance);
    let tStat = 0;
    for (let i = 0; i < n; i += 1) tStat += scores[i] as number;
    const expectedT = (scores.reduce((sum, s) => sum + s, 0) * n) / N;
    const exact = N <= 16;
    const pValue = exactPValue(scores, n, tStat);

    yield {
        stepNumber: 0,
        entities: makeCells(ordered, 0),
        edges: [],
        description: `Pool ${N} observations, find median ${med.toFixed(3)}, and score distance from it.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: N, n, m, N, median: med, tStat: 0, expectedT, pValue: 1, exact },
    };
    let step = 1;
    for (let i = 0; i < N; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(ordered, i + 1),
            edges: [],
            description: `Observation ${i + 1}: value ${(ordered[i] as { value: number }).value}, distance ${(ordered[i] as { distance: number }).distance.toFixed(2)}, score ${(ordered[i] as { score: number }).score.toFixed(1)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 4, cols: N, n, m, N, median: med, tStat: 0, expectedT, pValue: 1, exact },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(ordered, N),
        edges: [],
        description: `Score sum T = ${tStat.toFixed(1)} versus expected ${expectedT.toFixed(1)}; exact two-sided p-value ${pValue.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 4, cols: N, n, m, N, median: med, tStat, expectedT, pValue, exact },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If two samples have the same spread, their values should sit a similar distance from the shared center. Rank all observations by how far they are from the pooled median rather than by their raw value. A sample with a wider spread will occupy the far ends and collect the biggest distance scores.",
        invariants: [
            "Scores are midranks of the distances from the pooled median.",
            "The value closest to the median receives score one.",
            "The sum of all scores is N times (N+1) over two.",
        ],
        correctness:
            "Under the null of equal scale and a common median, the pooled observations are exchangeable between the two samples once centered, so every choice of n scores for the first sample is equally likely. Enumerating those C(N,n) choices gives the exact probability of a score sum as far from its expectation as the observed one, which is the two-sided p-value.",
        complexityRationale:
            "Finding the median and ranking distances costs O(N log N). The exact null enumerates C(N,n) subsets, tractable for N up to 16. Space is O(N) for the pooled scored sample.",
        uses: [
            "Comparing measurement precision between two instruments",
            "A robust alternative to the F-test for equal variances",
            "Checking the equal-variance assumption before a t-test",
        ],
        references: [
            "Ansari and Bradley, Rank Sums for Testing Equality of Scale, 1960",
            "Conover, Practical Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "For x = (4, 6, 8, 10, 12) and y = (6, 7, 8, 9, 10) the pooled median is 8. Distances from 8 are scored 1 through 10, and the wider sample x collects the large scores at 4 and 12, giving a larger T than the tight sample y.",
    },
    id: "ansari-bradley-test",
    name: "Ansari-Bradley Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N + C(N,n))", space: "O(N)" },
    defaultInput: { x: [4, 6, 8, 10, 12], y: [6, 7, 8, 9, 10] },
    visualType: "grid",
    run,
    pseudocode: [
        "pool the two samples and find their combined median",
        "compute each observation's distance from the median",
        "rank the distances, assigning average ranks for ties",
        "sum the scores belonging to the first sample into T",
        "compute the expected score sum under equal scale",
        "enumerate score subsets to obtain the exact null",
        "report T and the two-sided p-value",
    ],
};

export default module;
