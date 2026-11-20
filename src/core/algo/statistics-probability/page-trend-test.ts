/**
 * page-trend-test.ts - Page's Trend Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Page's L test looks for a monotone increasing trend across ordered treatments
 * measured on the same subjects. Treat the columns as a fixed order, rank the
 * values within each subject, weight the column rank sums by their column
 * number, and sum. A value far above its null expectation is evidence of an
 * increasing trend; a standardized z score is reported.
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
 *   - A grid whose rows are subjects and columns are ordered treatments.
 *   - Each cell shows its within-subject rank; the active block is highlighted.
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

function makeCells(data: number[][], ranks: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < data.length; row += 1) {
        for (let col = 0; col < (data[row]?.length ?? 0); col += 1) {
            const shown = row < revealed;
            const state: EntityState = shown ? "sorted" : row === revealed ? "comparing" : "idle";
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
        [3, 5, 7, 9],
        [2, 4, 6, 8],
        [4, 4, 7, 10],
        [1, 3, 5, 7],
        [5, 6, 8, 9],
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
    let lStat = 0;
    for (let col = 0; col < k; col += 1) lStat += (col + 1) * (rankSums[col] as number);
    const expectedL = (n * k * (k + 1) * (k + 1)) / 4;
    const varianceL = (n * k * k * (k + 1) * (k * k - 1)) / 144;
    const z = varianceL > 0 ? (lStat - expectedL) / Math.sqrt(varianceL) : 0;

    yield {
        stepNumber: 0,
        entities: makeCells(data, ranks, 0),
        edges: [],
        description: `Columns are an ordered sequence of ${k} treatments across ${n} subjects; rank each row and weight by column position.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: k, n, k, rankSums: new Array<number>(k).fill(0), lStat: 0, expectedL, varianceL, z: 0 },
    };
    let step = 1;
    for (let row = 0; row < n; row += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(data, ranks, row + 1),
            edges: [],
            description: `Subject ${row + 1} ranks ${(ranks[row] as number[]).map((r) => r.toFixed(1)).join(", ")}; weighted column contributions are accumulating.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: n, cols: k, n, k, rankSums: new Array<number>(k).fill(0), lStat: 0, expectedL, varianceL, z: 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(data, ranks, n),
        edges: [],
        description: `Weighted rank sum L = ${lStat.toFixed(1)} versus expected ${expectedL.toFixed(1)}; standardized z = ${z.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: k, n, k, rankSums, lStat, expectedL, varianceL, z },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Friedman's test asks whether treatments differ at all; Page's test asks a sharper question: do they improve in a known order? Rank each subject's treatments, multiply each column's rank sum by its position, and add. A strong increasing trend makes later columns collect the high ranks and drives L upward.",
        invariants: [
            "Within each subject ranks are 1 through k, with midranks for ties.",
            "Column weights are the fixed positions 1 through k.",
            "Under no trend the expected value of L is n k (k+1) squared over four.",
        ],
        correctness:
            "Under the null the rank vector in each subject is a uniformly random permutation, independent across subjects. Because L is a linear combination of the column rank sums, its mean and variance follow from the permutation covariance structure: E[L] = n k(k+1)^2/4 and Var[L] = n k^2(k+1)(k^2-1)/144. Standardizing gives a statistic that is asymptotically standard normal and monotone in the strength of the trend.",
        complexityRationale:
            "Ranking k values in each of n subjects costs O(n k log k), and forming the weighted sum is O(n k). The rank matrix takes O(n k) space.",
        uses: [
            "Testing whether performance improves across successive algorithm versions",
            "Detecting dose-response trends in ordered treatment groups",
            "Analyzing Likert items expected to increase with training",
        ],
        references: [
            "Page, Ordered Alternatives for the Two-Way Classification, 1963",
            "Conover, Practical Nonparametric Statistics, Chapter 6",
        ],
        workedExample:
            "With k = 4 ordered doses and n = 5 subjects, the null expectation is 5 * 4 * 25 / 4 = 125. If every subject ranks the doses 1, 2, 3, 4, the rank sums are 5, 10, 15, 20 and L = 1*5 + 2*10 + 3*15 + 4*20 = 150, above expectation and signaling an increasing trend.",
    },
    id: "page-trend-test",
    name: "Page's Trend Test",
    category: "statistics-probability",
    complexity: { time: "O(n k log k)", space: "O(n k)" },
    defaultInput: {
        data: [
            [3, 5, 7, 9],
            [2, 4, 6, 8],
            [4, 4, 7, 10],
            [1, 3, 5, 7],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "rank the k ordered treatments within each subject",
        "sum ranks per treatment column",
        "multiply each column sum by its column number",
        "add the weighted sums to obtain L",
        "compute expected L under no trend",
        "compute the null variance of L",
        "standardize L into a z statistic and report it",
    ],
};

export default module;
