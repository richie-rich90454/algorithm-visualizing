/**
 * mood-test.ts - Mood's Median Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mood's median test asks whether several groups have the same median. It pools
 * all observations, finds the grand median, and counts in each group how many
 * values fall above it and how many fall at or below it. Those counts form a
 * contingency table, and a chi-square statistic tests whether the above/below
 * proportions are the same across groups.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) to find the pooled median
 *   Space: O(k) for the two counts per group
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one column per group and two rows: above and at/below.
 *   - The column being counted is highlighted.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function grandMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] as number : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function makeCells(above: number[], below: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < above.length; col += 1) {
            const state: EntityState = col < revealed ? "active" : col === revealed ? "comparing" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: col < revealed ? String(row === 0 ? above[col] : below[col]) : "-",
                value: row === 0 ? above[col] as number : below[col] as number,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { groups?: number[][] } | null) ?? {};
    const fallback = [
        [12, 14, 15, 13, 16],
        [9, 11, 10, 8, 12],
        [14, 17, 16, 15, 18],
    ];
    const groups = Array.isArray(task.groups) && task.groups.length >= 2 && task.groups.every((g) => Array.isArray(g) && g.length > 0)
        ? task.groups.map((g) => g.map(Number))
        : fallback;
    const k = groups.length;
    const all = groups.flat();
    const N = all.length;
    const med = grandMedian(all);
    const above = groups.map((g) => g.filter((v) => v > med).length);
    const below = groups.map((g, i) => (g.length ?? 0) - (above[i] as number));
    const totalAbove = above.reduce((sum, v) => sum + v, 0);
    const totalBelow = below.reduce((sum, v) => sum + v, 0);
    let chi2 = 0;
    for (let i = 0; i < k; i += 1) {
        const rowTotal = (above[i] as number) + (below[i] as number);
        const cells: Array<[number, number]> = [[above[i] as number, totalAbove], [below[i] as number, totalBelow]];
        for (const [observed, colTotal] of cells) {
            const expected = (rowTotal * colTotal) / N;
            if (expected > 0) chi2 += (observed - expected) ** 2 / expected;
        }
    }
    const df = k - 1;

    yield {
        stepNumber: 0,
        entities: makeCells(above, below, 0),
        edges: [],
        description: `Pool ${N} observations, find the grand median ${med.toFixed(3)}, then count above and at-below values per group.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: k, k, N, median: med, above, below, chi2: 0, df },
    };
    let step = 1;
    for (let col = 0; col < k; col += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(above, below, col + 1),
            edges: [],
            description: `Group ${col + 1}: ${above[col]} above the median and ${below[col]} at or below it.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 2, cols: k, k, N, median: med, above, below, chi2: 0, df },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(above, below, k),
        edges: [],
        description: `Mood's median test chi-square = ${chi2.toFixed(4)} with ${df} degrees of freedom.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: k, k, N, median: med, above, below, chi2, df },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing group means, compare how often each group lands above the overall middle value. If all groups share the same median, roughly half of each group should sit above it. Turn those counts into a contingency table and a chi-square test tells you whether any group deviates from that balance.",
        invariants: [
            "The cut point is the median of all pooled observations.",
            "Counts above and at-or-below in a group add to that group's size.",
            "The chi-square uses expected counts from the marginal totals.",
        ],
        correctness:
            "Under the null of equal medians each observation is equally likely to fall above or below the pooled median, and the chance does not depend on group. The two-by-k count table therefore has expected entries given by row total times column total over the grand total. The Pearson chi-square statistic asymptotically follows a chi-square distribution with k-1 degrees of freedom, providing the test of equal medians.",
        complexityRationale:
            "Finding the pooled median requires sorting N values, O(N log N). Counting and the chi-square sum scan the data linearly and use O(k) space for the contingency counts.",
        uses: [
            "Comparing group medians when the data are skewed or ordinal",
            "A robust alternative to one-way ANOVA on ranks",
            "Quick screening of several treatments for location differences",
        ],
        references: [
            "Mood, Introduction to the Theory of Statistics, 1950",
            "Conover, Practical Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "For groups (12,14,15,13,16), (9,11,10,8,12) and (14,17,16,15,18) the pooled median is 14. The second group contributes almost no values above 14 while the third contributes almost all, so the contingency table is unbalanced and the chi-square statistic is large.",
    },
    id: "mood-test",
    name: "Mood's Median Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N)", space: "O(k)" },
    defaultInput: {
        groups: [
            [12, 14, 15, 13, 16],
            [9, 11, 10, 8, 12],
            [14, 17, 16, 15, 18],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "pool the observations and find the grand median",
        "for each group count values above the median",
        "count values at or below the median in each group",
        "compute expected counts from row and column totals",
        "sum squared differences over expected counts",
        "set degrees of freedom to k minus one",
        "report the chi-square statistic",
    ],
};

export default module;
