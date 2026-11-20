/**
 * brunner-munzel-test.ts - Brunner-Munzel Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Brunner-Munzel test compares two independent samples without assuming
 * they have the same shape or spread, unlike the Mann-Whitney test. It ranks
 * the pooled data and the two samples separately, estimates a rank variance for
 * each sample from the difference between those two rankings, and forms a
 * Welch-style statistic on the two mean pooled ranks. A Welch-Satterthwaite
 * degrees-of-freedom value accompanies the statistic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) to rank the pooled and separate samples
 *   Space: O(N) for the rank vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid whose columns are the pooled observations sorted by value.
 *   - Rows show the value, pooled rank, and within-sample rank for each point.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Average ranks for ties, aligned with the input positions. */
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

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = 0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3 - 1.821255978 * t ** 4 + 1.330274429 * t ** 5;
    const upper = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI) * poly;
    return z >= 0 ? 1 - upper : upper;
}

function makeCells(ordered: Array<{ value: number; pooledRank: number; innerRank: number; group: string }>, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows: Array<(e: { value: number; pooledRank: number; innerRank: number; group: string }) => string> = [
        (e) => String(e.value),
        (e) => e.pooledRank.toFixed(1),
        (e) => e.innerRank.toFixed(1),
        (e) => e.group,
    ];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < ordered.length; col += 1) {
            const entry = ordered[col] as { value: number; pooledRank: number; innerRank: number; group: string };
            const shown = col < revealed;
            const state: EntityState = row === 3 ? (entry.group === "x" ? "active" : "visited") : shown ? "comparing" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? rows[row]!(entry) : "-",
                value: row === 0 ? entry.value : entry.group === "x" ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, pooledRank: entry.pooledRank, innerRank: entry.innerRank },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[] } | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length > 1 ? task.x.map(Number) : [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1];
    const y = Array.isArray(task.y) && task.y.length > 1 ? task.y.map(Number) : [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4];
    const nx = x.length;
    const ny = y.length;
    const pooledRanks = midranks([...x, ...y]);
    const rankCx = pooledRanks.slice(0, nx);
    const rankCy = pooledRanks.slice(nx);
    const innerX = midranks(x);
    const innerY = midranks(y);
    const rankXMean = mean(innerX);
    const rankYMean = mean(innerY);
    const rankCxMean = mean(rankCx);
    const rankCyMean = mean(rankCy);

    const tempX = rankCx.map((r, i) => r - (innerX[i] as number) - rankCxMean + rankXMean);
    const tempY = rankCy.map((r, i) => r - (innerY[i] as number) - rankCyMean + rankYMean);
    const sx = tempX.reduce((sum, v) => sum + v * v, 0) / (nx - 1);
    const sy = tempY.reduce((sum, v) => sum + v * v, 0) / (ny - 1);
    const nxSx = nx * sx;
    const nySy = ny * sy;
    const denominator = (nx + ny) * Math.sqrt(nxSx + nySy);
    const w = denominator > 0 ? (nx * ny * (rankCyMean - rankCxMean)) / denominator : 0;
    const dfNumerator = (nxSx + nySy) ** 2;
    const dfDenominator = (nxSx ** 2) / (nx - 1) + (nySy ** 2) / (ny - 1);
    const df = dfDenominator > 0 ? dfNumerator / dfDenominator : 1;
    const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(w))));
    const relativeEffect = (rankCxMean - (nx + 1) / 2) / ny + 0.5;

    const ordered = [...x.map((value, i) => ({ value, pooledRank: rankCx[i] as number, innerRank: innerX[i] as number, group: "x" })),
        ...y.map((value, i) => ({ value, pooledRank: rankCy[i] as number, innerRank: innerY[i] as number, group: "y" }))]
        .sort((a, b) => a.value - b.value);

    yield {
        stepNumber: 0,
        entities: makeCells(ordered, 0),
        edges: [],
        description: `Rank ${nx + ny} pooled observations and the two samples separately to compare mean ranks with unequal shapes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: nx + ny, nx, ny, w: 0, df, pValue: 1, relativeEffect: 0 },
    };
    let step = 1;
    for (let i = 0; i < ordered.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(ordered, i + 1),
            edges: [],
            description: `Value ${(ordered[i] as { value: number }).value}: pooled rank ${(ordered[i] as { pooledRank: number }).pooledRank.toFixed(1)} and within-group rank ${(ordered[i] as { innerRank: number }).innerRank.toFixed(1)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 4, cols: nx + ny, nx, ny, w: 0, df, pValue: 1, relativeEffect: 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(ordered, nx + ny),
        edges: [],
        description: `Brunner-Munzel W = ${w.toFixed(4)} with about ${df.toFixed(1)} degrees of freedom; two-sided p-value ${pValue.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 4, cols: nx + ny, nx, ny, w, df, pValue, relativeEffect },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Mann-Whitney assumes the two groups have the same shape, only shifted. Brunner-Munzel drops that assumption. It still ranks the combined data, but it estimates the uncertainty of each group's mean rank from that group alone using the gap between its pooled ranks and its internal ranks. The result is a Welch-style comparison that stays valid when one group is much more variable than the other.",
        invariants: [
            "Pooled and within-group ranks use averages for ties.",
            "Each group's rank variance is estimated from its own pooled minus internal rank deviations.",
            "The degrees of freedom follow the Welch-Satterthwaite formula.",
        ],
        correctness:
            "The null states that a random value from one group is equally likely to exceed or be exceeded by one from the other. Under this null the two mean pooled ranks have the same expectation. Brunner and Munzel showed that the difference, studentized by separate consistent variance estimates from the pooled and internal ranks, converges to a t or normal distribution, with degrees of freedom given by the Welch-Satterthwaite approximation. This remains valid without identical distribution shapes.",
        complexityRationale:
            "Ranking the pooled sample costs O(N log N) and each sample's internal ranking costs O(n log n) and O(m log m). Building the variance vectors and statistic is linear, so time is O(N log N) and space is O(N).",
        uses: [
            "Comparing two groups with unequal variances or distribution shapes",
            "A robust alternative to the Mann-Whitney U test",
            "Analyzing ordinal outcomes in unequal-size samples",
        ],
        references: [
            "Brunner and Munzel, The Nonparametric Behrens-Fisher Problem, 2000",
            "Neubert and Brunner, A Studentized Permutation Test for the Nonparametric Behrens-Fisher Problem, 2007",
        ],
        workedExample:
            "On the sample pair from the SciPy documentation, x = (1,2,1,1,1,1,1,1,1,1,2,4,1,1) and y = (3,3,4,3,1,2,3,1,1,5,4), the Brunner-Munzel W statistic is about 3.1375, indicating that values from y tend to be larger even though the two samples have very different shapes.",
    },
    id: "brunner-munzel-test",
    name: "Brunner-Munzel Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: {
        x: [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1],
        y: [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute midranks of the pooled sample and of each group",
        "find the mean pooled rank in each group",
        "form deviations of pooled ranks from internal ranks",
        "estimate a rank variance per group from those deviations",
        "studentize the mean-rank difference into W",
        "compute Welch-Satterthwaite degrees of freedom",
        "report W, its degrees of freedom, and the p-value",
    ],
};

export default module;
