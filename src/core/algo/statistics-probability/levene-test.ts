/**
 * levene-test.ts - Levene Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Levene's test checks whether several groups have equal variances. Each
 * observation is replaced by its absolute deviation from its own group center
 * (the group median here, the Brown-Forsythe version), and an ordinary one-way
 * analysis of variance is run on those deviations. A large F statistic means
 * some groups are much more spread out than others. Using the median makes the
 * test robust to non-normal data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) to compute deviations plus O(N log N) for the group medians
 *   Space: O(N) for the deviation values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one column per observation, grouped by color.
 *   - Rows show the group, the value, its deviation, and its group mean.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] as number : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function makeCells(
    groups: number[][],
    deviations: number[][],
    groupMeans: number[],
    revealed: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    let index = 0;
    const rows: Array<(g: number, j: number) => { label: string; value: number }> = [
        (g) => ({ label: `G${g + 1}`, value: g }),
        (g, j) => ({ label: String(groups[g]![j]), value: groups[g]![j]! }),
        (g, j) => ({ label: deviations[g]![j]!.toFixed(2), value: deviations[g]![j]! }),
        (g) => ({ label: groupMeans[g]!.toFixed(2), value: groupMeans[g]! }),
    ];
    for (let row = 0; row < rows.length; row += 1) {
        index = 0;
        for (let g = 0; g < groups.length; g += 1) {
            for (let j = 0; j < (groups[g]?.length ?? 0); j += 1) {
                const shown = index < revealed;
                const cell = shown ? rows[row]!(g, j) : { label: "-", value: 0 };
                const state: EntityState = row === 0 ? (g % 2 === 0 ? "active" : "visited") : shown ? "comparing" : "idle";
                entities.push({
                    id: `cell-${row}-${index}`,
                    type: "cell" as const,
                    label: cell.label,
                    value: cell.value,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col: index, group: g },
                });
                index += 1;
            }
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { groups?: number[][] } | null) ?? {};
    const fallback = [
        [8, 9, 10, 11, 12],
        [7, 9, 10, 11, 13],
        [4, 7, 10, 13, 16],
    ];
    const groups = Array.isArray(task.groups) && task.groups.length >= 2 && task.groups.every((g) => Array.isArray(g) && g.length > 1)
        ? task.groups.map((g) => g.map(Number))
        : fallback;
    const k = groups.length;
    const sizes = groups.map((g) => g.length);
    const N = sizes.reduce((sum, s) => sum + s, 0);
    const medians = groups.map((g) => median(g));
    const deviations = groups.map((g, i) => g.map((value) => Math.abs(value - medians[i]!)));
    const groupMeans = deviations.map((d) => mean(d));
    const allDeviations = deviations.flat();
    const grandMean = mean(allDeviations);
    let between = 0;
    for (let i = 0; i < k; i += 1) between += sizes[i]! * (groupMeans[i]! - grandMean) ** 2;
    let within = 0;
    for (let i = 0; i < k; i += 1) {
        for (const d of deviations[i]!) within += (d - groupMeans[i]!) ** 2;
    }
    const w = within > 0 ? ((N - k) * between) / ((k - 1) * within) : 0;

    yield {
        stepNumber: 0,
        entities: makeCells(groups, deviations, groupMeans, 0),
        edges: [],
        description: `Replace each value by its distance from its group median, then compare group means of those distances across ${k} groups.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: N, k, N, medians, groupMeans, grandMean, w: 0 },
    };
    let step = 1;
    for (let g = 0; g < k; g += 1) {
        for (let j = 0; j < sizes[g]!; j += 1) {
            const revealed = groups.slice(0, g).reduce((sum, group) => sum + group.length, 0) + j + 1;
            yield {
                stepNumber: step,
                entities: makeCells(groups, deviations, groupMeans, revealed),
                edges: [],
                description: `Group ${g + 1}, value ${groups[g]![j]}: distance from median ${medians[g]!.toFixed(2)} is ${deviations[g]![j]!.toFixed(2)}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { rows: 4, cols: N, k, N, medians, groupMeans, grandMean, w: 0 },
            };
            step += 1;
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells(groups, deviations, groupMeans, N),
        edges: [],
        description: `Levene F statistic = ${w.toFixed(4)} from between-group ${between.toFixed(3)} and within-group ${within.toFixed(3)} variation.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 4, cols: N, k, N, medians, groupMeans, grandMean, between, within, w },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Comparing variances directly is sensitive to outliers and non-normality. Instead, replace every observation by how far it sits from the center of its own group. Groups that are widely spread will have large distances on average. Running a regular ANOVA on those distances tests whether the average distance differs across groups.",
        invariants: [
            "Each deviation is the absolute distance from the observation to its group median.",
            "The group means and grand mean are means of those deviations.",
            "The F statistic is a ratio of between-group to within-group variation of the deviations.",
        ],
        correctness:
            "Under the null of equal variances the transformed deviations have the same distribution in every group, so an ordinary one-way ANOVA on them is valid asymptotically. The F statistic compares the variance of the group means of deviations to the pooled variance inside groups. The median centering (Brown-Forsythe) keeps the statistic robust when the underlying data are skewed, while retaining the ANOVA null reference.",
        complexityRationale:
            "Finding each group median costs O(n_i log n_i), and computing deviations and the ANOVA sums is linear in the observations. Total time is O(N log N) dominated by sorting, with O(N) space for the deviations.",
        uses: [
            "Checking the equal-variance assumption before an ANOVA or t-test",
            "Comparing measurement variability across laboratories or machines",
            "A robust homogeneity test for skewed data using group medians",
        ],
        references: [
            "Levene, Robust Tests for Equality of Variances, 1960",
            "Brown and Forsythe, Robust Tests for the Equality of Variances, 1974",
        ],
        workedExample:
            "For groups (8,9,10,11,12), (7,9,10,11,13) and (4,7,10,13,16), the medians are all 10. The deviations in the third group reach 6 while the first stays within 2, so its mean deviation is larger and Levene's F grows, signaling unequal spread.",
    },
    id: "levene-test",
    name: "Levene Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: {
        groups: [
            [8, 9, 10, 11, 12],
            [7, 9, 10, 11, 13],
            [4, 7, 10, 13, 16],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each group compute its median",
        "replace each value by its distance from that median",
        "compute the mean deviation in each group and overall",
        "sum squared group-mean gaps weighted by group size",
        "sum squared deviations within each group",
        "form F from the between and within sums",
        "report the Levene F statistic",
    ],
};

export default module;
