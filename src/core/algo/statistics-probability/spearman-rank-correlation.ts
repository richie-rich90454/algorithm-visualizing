/**
 * spearman-rank-correlation.ts - Spearman Rank Correlation Coefficient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Spearman's rho is a nonparametric measure of monotone association. It is the
 * ordinary Pearson correlation of the rank-transformed data: replace each
 * value by its rank (averaging ranks for ties), then correlate the two rank
 * vectors. Rho ranges from -1 for a perfectly decreasing relationship to +1
 * for a perfectly increasing one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort each column, then O(n) for the correlation
 *   Space: O(n) for the ranks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each paired observation is a node scattered at (x, y).
 *   - The pair being ranked is yellow; finished pairs are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Average ranks for a column, with ties receiving the mean of their ranks. */
function rankColumn(values: number[]): number[] {
    const n = values.length;
    const order = values.map((_, i) => i).sort((a, b) => (values[a] as number) - (values[b] as number));
    const ranks = new Array<number>(n).fill(0);
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && values[order[j + 1] as number] === values[order[i] as number]) j += 1;
        const average = (i + 1 + j + 1) / 2;
        for (let k = i; k <= j; k += 1) ranks[order[k] as number] = average;
        i = j + 1;
    }
    return ranks;
}

/** Pearson correlation between two equally sized vectors. */
function pearson(a: number[], b: number[]): number {
    const n = a.length;
    if (n === 0) return 0;
    const meanA = a.reduce((x, y) => x + y, 0) / n;
    const meanB = b.reduce((x, y) => x + y, 0) / n;
    let covariance = 0;
    let varA = 0;
    let varB = 0;
    for (let i = 0; i < n; i += 1) {
        const da = (a[i] as number) - meanA;
        const db = (b[i] as number) - meanB;
        covariance += da * db;
        varA += da * da;
        varB += db * db;
    }
    const denominator = Math.sqrt(varA * varB);
    return denominator === 0 ? 0 : covariance / denominator;
}

/** Build one scatter node per pair. */
function makeNodes(x: number[], y: number[], current: number, done: boolean): VisualEntity[] {
    return x.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) state = "sorted";
        else if (index === current) state = "comparing";
        return {
            id: `pair-${index}`,
            type: "node" as const,
            label: `(${value}, ${y[index]})`,
            value: [value, y[index] ?? 0],
            state,
            x: value,
            y: y[index] ?? 0,
            width: 0,
            height: 0,
            metadata: { index, x: value, y: y[index] ?? 0 },
        };
    });
}

/** The Spearman rank correlation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[] } | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length > 0 ? task.x.map(Number) : [1, 2, 3, 4, 5, 6];
    const y = Array.isArray(task.y) && task.y.length === x.length
        ? task.y.map(Number)
        : [...x].reverse();
    const n = x.length;
    const rankX = rankColumn(x);
    const rankY = rankColumn(y);

    yield {
        stepNumber: 0,
        entities: makeNodes(x, y, -1, false),
        edges: [],
        description: `Ranking ${n} paired observations before correlating their ranks.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, rho: 0, dSquaredSum: 0, rankX, rankY },
    };
    let step = 1;
    let dSquaredSum = 0;

    for (let i = 0; i < n; i += 1) {
        const d = (rankX[i] as number) - (rankY[i] as number);
        dSquaredSum += d * d;
        yield {
            stepNumber: step,
            entities: makeNodes(x, y, i, false),
            edges: [],
            description: `Pair ${i}: ranks ${rankX[i]} and ${rankY[i]}, rank difference ${d}, squared ${d * d}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, rho: pearson(rankX.slice(0, i + 1), rankY.slice(0, i + 1)), dSquaredSum, rankX, rankY },
        };
        step += 1;
    }

    const rho = pearson(rankX, rankY);
    yield {
        stepNumber: step,
        entities: makeNodes(x, y, n, true),
        edges: [],
        description: `Spearman rho = ${rho.toFixed(4)} from summed squared rank differences ${dSquaredSum}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { n, rho, dSquaredSum, rankX, rankY },
    };
}

/** The Spearman rank correlation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of asking whether two variables follow a straight line, ask whether they move together in the same order. Replace each column by its ranks, so the actual values no longer matter, then apply the ordinary correlation formula. Ties share the average of the ranks they would have occupied.",
        invariants: [
            "Ranks run from one to n, with tied values sharing an average rank.",
            "The summed squared rank differences are nonnegative.",
            "Rho always lies between minus one and one.",
        ],
        correctness:
            "Pearson correlation is invariant under any strictly increasing linear transform of either variable, and ranking is a monotone transform, so applying Pearson to ranks measures monotone association. When there are no ties, the rank sums are fixed and the formula reduces to 1 minus 6 times the summed squared differences over n times (n squared minus 1). Averaging ranks for ties makes the general Pearson form correct in the presence of ties too.",
        complexityRationale:
            "Sorting each column of n values costs O(n log n), and forming ranks and the correlation are linear scans, so time is O(n log n). The rank arrays use O(n) space.",
        uses: [
            "Correlating ordinal survey responses",
            "Robust association when data are not normally distributed",
            "Comparing ranked search or recommendation results",
        ],
        references: [
            "Spearman, The Proof and Measurement of Association Between Two Things, 1904",
            "Conover, Practical Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "For x = 1, 2, 3 and y = 10, 30, 20, the ranks are 1, 2, 3 and 1, 3, 2. The rank differences are 0, -1, 1, so the squared sum is 2 and rho is 1 minus 6 times 2 over 3 times 8, which is 0.5.",
    },
    id: "spearman-rank-correlation",
    name: "Spearman Rank Correlation",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { x: [1, 2, 3, 4, 5, 6, 7, 8], y: [3, 1, 4, 5, 2, 8, 7, 6] },
    visualType: "point",
    run,
    pseudocode: [
        "rank the first column, averaging ranks for ties",
        "rank the second column the same way",
        "for each pair compute the squared difference of ranks",
        "accumulate the squared rank differences",
        "correlate the two rank vectors with Pearson's formula",
        "done: report Spearman's rho and the summed differences",
    ],
};

export default module;
