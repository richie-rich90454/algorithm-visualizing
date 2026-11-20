/**
 * friedman-test.ts - Friedman Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Friedman test detects differences among three or more treatments measured
 * on the same subjects. Within each subject (block) the treatment values are
 * ranked, and the rank sums for each treatment are combined into a chi-square
 * statistic with k-1 degrees of freedom. A tie correction keeps the statistic
 * valid when blocks contain equal values.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * k log k) to rank every block
 *   Space: O(n * k) for the block ranks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid whose rows are subjects and columns are treatments.
 *   - Each cell shows the within-subject rank; the revealed block is active.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Midranks of a single row, aligned with the input positions. */
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

function makeCells(data: number[][], ranks: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < data.length; row += 1) {
        for (let col = 0; col < (data[row]?.length ?? 0); col += 1) {
            const shown = row < revealed;
            const state: EntityState = shown ? "active" : row === revealed ? "comparing" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? (ranks[row] as number[])[col]?.toFixed(1) ?? "-" : "-",
                value: (data[row] as number[])[col] as number,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, rank: shown ? (ranks[row] as number[])[col] ?? 0 : 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[][] } | null) ?? {};
    const fallback = [
        [7, 4, 5],
        [8, 4, 6],
        [9, 5, 7],
        [6, 3, 4],
        [7, 5, 6],
    ];
    const data = Array.isArray(task.data) && task.data.length > 0 && task.data.every((r) => Array.isArray(r) && r.length >= 3)
        ? task.data.map((r) => r.map(Number))
        : fallback;
    const n = data.length;
    const k = (data[0] as number[]).length;
    const ranks = data.map((row) => midranks(row));
    const rankSums = new Array<number>(k).fill(0);
    for (let col = 0; col < k; col += 1) {
        for (let row = 0; row < n; row += 1) rankSums[col] = (rankSums[col] as number) + ((ranks[row] as number[])[col] as number);
    }
    let tieTerm = 0;
    for (let row = 0; row < n; row += 1) {
        const counts = new Map<number, number>();
        for (const value of data[row] as number[]) counts.set(value, (counts.get(value) ?? 0) + 1);
        for (const size of counts.values()) tieTerm += size ** 3 - size;
    }
    const correction = 1 - tieTerm / (n * k * (k * k - 1));
    let q = 0;
    for (const sum of rankSums) q += sum * sum;
    q = ((12 / (n * k * (k + 1))) * q - 3 * n * (k + 1)) / (correction > 0 ? correction : 1);

    yield {
        stepNumber: 0,
        entities: makeCells(data, ranks, 0),
        edges: [],
        description: `Rank the ${k} treatments within each of ${n} subjects, then combine the rank sums.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: k, n, k, rankSums: new Array<number>(k).fill(0), q: 0, correction },
    };
    let step = 1;
    for (let row = 0; row < n; row += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(data, ranks, row + 1),
            edges: [],
            description: `Subject ${row + 1}: ranks are ${(ranks[row] as number[]).map((r) => r.toFixed(1)).join(", ")}; column sums are being accumulated.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: n, cols: k, n, k, rankSums: new Array<number>(k).fill(0), q: 0, correction },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(data, ranks, n),
        edges: [],
        description: `Rank sums ${rankSums.map((s) => s.toFixed(1)).join(", ")} give Friedman Q = ${q.toFixed(4)} with ${k - 1} degrees of freedom.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: k, n, k, rankSums, q, correction },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When the same people try several treatments, comparing raw scores is noisy because some people score high everywhere. Rank the treatments inside each person instead. If the treatments are equally effective, their within-person ranks should average out; a treatment that repeatedly lands near the top accumulates a large rank sum.",
        invariants: [
            "The ranks within each block are a permutation of 1 through k, with midranks for ties.",
            "The rank sums over all treatments add to n times k times (k+1) over two.",
            "The tie correction equals one when no block has ties.",
        ],
        correctness:
            "Under the null of identical treatment distributions, the rank vector in each block is uniform over all k! permutations and independent across blocks. The rank sums therefore have a known covariance structure, and the quadratic form Q follows a chi-square distribution with k-1 degrees of freedom in the limit. The correction rescales the statistic so tied ranks do not inflate its variance.",
        complexityRationale:
            "Each of the n blocks sorts k values, costing O(k log k), so ranking is O(n k log k). Storing the rank matrix uses O(n k) space.",
        uses: [
            "Comparing several algorithms on the same benchmark instances",
            "Analyzing repeated-measures experiments in psychology and medicine",
            "A nonparametric alternative to repeated-measures ANOVA",
        ],
        references: [
            "Friedman, The Use of Ranks to Avoid the Assumption of Normality, 1937",
            "Conover, Practical Nonparametric Statistics, Chapter 6",
        ],
        workedExample:
            "With three treatments and no ties, each subject contributes ranks 1, 2, 3, so the three column sums add to 6n. If one treatment is ranked first in every subject its sum is n and another last its sum is 3n, producing a large Q and evidence of a treatment effect.",
    },
    id: "friedman-test",
    name: "Friedman Test",
    category: "statistics-probability",
    complexity: { time: "O(n k log k)", space: "O(n k)" },
    defaultInput: {
        data: [
            [7, 4, 5],
            [8, 4, 6],
            [9, 5, 7],
            [6, 3, 4],
            [7, 5, 6],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each subject rank its k treatment values",
        "sum the ranks obtained by each treatment",
        "accumulate the tie correction from tied values",
        "form the chi-square statistic from squared rank sums",
        "divide the statistic by the tie correction",
        "compare with chi-square using k minus one degrees of freedom",
        "report the Friedman Q statistic",
    ],
};

export default module;
