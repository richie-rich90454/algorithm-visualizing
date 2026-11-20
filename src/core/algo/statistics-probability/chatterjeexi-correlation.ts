/**
 * chatterjeexi-correlation.ts - Chatterjee's Rank Correlation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chatterjee's xi measures how strongly y is a function of x. It sorts the
 * pairs by x, ranks the corresponding y values, and sums the absolute jumps
 * between consecutive ranks. Tangled y values give large jumps and a small xi;
 * a monotone relationship gives small jumps and an xi near one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sorts
 *   Space: O(n) for the sorted pairs and ranks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each (x, y) pair is a point colored by the current rank jump.
 *   - The final frame is green and reports xi.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makePoints(xs: number[], ys: number[], active: number, done: boolean): VisualEntity[] {
    return xs.map((x, i) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (i === active || i === active + 1) state = "comparing";
        return {
            id: `point-${i}`,
            type: "node" as const,
            label: `(${x.toFixed(2)}, ${(ys[i] ?? 0).toFixed(2)})`,
            value: [x, ys[i] ?? 0],
            state,
            x,
            y: ys[i] ?? 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[] } | null) ?? {};
    const sourceX = Array.isArray(task.x) ? task.x : [1, 2, 3, 4, 5, 6, 7, 8];
    const sourceY = Array.isArray(task.y) ? task.y : [2, 1, 4, 3, 6, 5, 8, 7];
    const n = Math.min(sourceX.length, sourceY.length);
    const xs = sourceX.slice(0, n).map((v) => Number(v) || 0);
    const ys = sourceY.slice(0, n).map((v) => Number(v) || 0);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a]! - xs[b]! || ys[a]! - ys[b]!);
    const yOrder = Array.from({ length: n }, (_, i) => i).sort((a, b) => ys[a]! - ys[b]! || xs[a]! - xs[b]!);
    const rankOf = new Array<number>(n).fill(0);
    yOrder.forEach((index, rank) => { rankOf[index] = rank + 1; });
    const ranks = order.map((index) => rankOf[index] ?? 0);
    const diffs: number[] = [];
    for (let i = 0; i + 1 < n; i += 1) diffs.push(Math.abs((ranks[i + 1] ?? 0) - (ranks[i] ?? 0)));
    const sumDiffs = diffs.reduce((s, d) => s + d, 0);
    const xi = n >= 3 ? 1 - (3 * sumDiffs) / (n * n - 1) : 0;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makePoints(xs, ys, -1, false),
        edges: [],
        description: `Measuring rank dependence for ${n} pairs with Chatterjee's xi.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, xi, sumDiffs, diffs, ranks },
    };
    for (let i = 0; i < diffs.length; i += 1) {
        yield {
            stepNumber: step++,
            entities: makePoints(xs, ys, i, false),
            edges: [],
            description: `Consecutive sorted ranks ${ranks[i]} and ${ranks[i + 1]} differ by ${diffs[i]}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, xi, sumDiffs, diffs, ranks, current: i },
        };
    }
    yield {
        stepNumber: step,
        entities: makePoints(xs, ys, -1, true),
        edges: [],
        description: `Chatterjee's xi = ${xi.toFixed(4)} from a rank-jump sum of ${sumDiffs}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { n, xi, sumDiffs, diffs, ranks },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Correlation based only on ranks can detect any functional relationship, not just a straight line. After sorting pairs by x, a smooth relationship makes the y ranks move only a little from one point to the next. Summing those small jumps and subtracting from one gives a score that reaches one for a monotone increasing function.",
        invariants: [
            "Sorting by x never changes the multiset of y ranks.",
            "Each absolute rank difference is nonnegative.",
            "The score lies between minus one and one and approaches one as n grows for a strictly increasing function.",
        ],
        correctness:
            "For a strictly increasing relationship the sorted y ranks are consecutive, their jumps sum to n-1, and xi equals 1-3/(n+1), which tends to one. For a strictly decreasing relationship the jumps sum to (n-1)^2 and xi tends to minus one. Independent or heavily oscillating y values produce much larger jumps. The normalization by n^2-1 keeps the statistic in a fixed range for every sample size.",
        complexityRationale:
            "Sorting the pairs by x and the values by y costs O(n log n), and the single pass over consecutive ranks costs O(n). The sorted orders, ranks, and jump list require O(n) space.",
        uses: [
            "Detecting monotone dependence without assuming linearity",
            "Feature screening in high-dimensional data",
            "Measuring how well one variable determines another in simulations",
        ],
        references: [
            "Chatterjee, A New Coefficient of Correlation, 2021",
            "Chatterjee and Diaconis, Estimating a monotone function from non-parametric data, 2022",
        ],
        workedExample:
            "For x = 1..5 and y = 1..5 the sorted y ranks are 1,2,3,4,5, so the jumps sum to 4 and xi = 1 - 12/24 = 0.5. For y = 5,4,3,2,1 the jumps sum to 16 and xi = 1 - 48/24 = -1.",
    },
    id: "chatterjeexi-correlation",
    name: "Chatterjee Rank Correlation",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { x: [1, 2, 3, 4, 5, 6, 7, 8], y: [2, 1, 4, 3, 6, 5, 8, 7] },
    visualType: "point",
    run,
    pseudocode: [
        "sort the pairs by the x value",
        "assign each y value its rank among all y values",
        "read the ranks in x-sorted order",
        "sum absolute differences of consecutive ranks",
        "multiply the sum by three over n squared minus one",
        "set xi to one minus that quantity",
        "done: report the rank correlation xi",
    ],
};

export default module;
