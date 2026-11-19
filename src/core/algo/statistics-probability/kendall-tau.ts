/**
 * kendall-tau.ts - Kendall's Rank Correlation (tau-b)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kendall's tau measures agreement between two rankings by looking at every
 * pair of observations. A pair is concordant when the two coordinates move in
 * the same direction and discordant when they move in opposite directions.
 * tau-b subtracts discordant from concordant pairs and normalizes by the
 * number of untied pairs in each coordinate, so ties are handled correctly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for one pass over all pairs
 *   Space: O(n) for the displayed scatter points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each (x, y) pair is a point.
 *   - The two points of the current pair are highlighted while compared.
 *   - The final frame is green and reports tau-b.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function makePoints(points: Point[], a = -1, b = -1, done = false): VisualEntity[] {
    return points.map(([x, y], index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === a || index === b) {
            state = "comparing";
        }
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: `(${x}, ${y})`,
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, x, y },
        };
    });
}

/** Count the sizes of equal-value groups, then convert to pair counts. */
function tiePairs(values: number[]): number {
    const counts = new Map<number, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let total = 0;
    for (const size of counts.values()) {
        total += (size * (size - 1)) / 2;
    }
    return total;
}

/** Compute Kendall's tau-b with one frame per compared pair. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const points: Point[] = Array.isArray(task.points)
        ? task.points.map((p) => [p[0], p[1]] as Point)
        : [
              [1, 2],
              [2, 3],
              [3, 5],
              [4, 4],
              [5, 7],
              [6, 6],
          ];
    const n = points.length;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n0 = (n * (n - 1)) / 2;
    const n1 = tiePairs(xs);
    const n2 = tiePairs(ys);
    let concordant = 0;
    let discordant = 0;
    let tieCount = 0;

    yield {
        stepNumber: 0,
        entities: makePoints(points, -1, -1, false),
        edges: [],
        description: `Comparing all ${n0} pair(s) of ${n} observations for Kendall's tau.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, concordant: 0, discordant: 0, tiePairs: 0, tau: 0 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const pi = points[i];
            const pj = points[j];
            const product = (pi[0] - pj[0]) * (pi[1] - pj[1]);
            if (product > 0) {
                concordant += 1;
            } else if (product < 0) {
                discordant += 1;
            } else {
                tieCount += 1;
            }
            const verdict = product > 0 ? "concordant" : product < 0 ? "discordant" : "tied";
            yield {
                stepNumber: step,
                entities: makePoints(points, i, j, false),
                edges: [],
                description: `Pair (${i}, ${j}) is ${verdict}: concordant ${concordant}, discordant ${discordant}.`,
                codeLineNumber: 3,
                layout: "point",
                meta: { n, concordant, discordant, tiePairs: tieCount, tau: 0 },
            };
            step += 1;
        }
    }

    const denominator = Math.sqrt((n0 - n1) * (n0 - n2));
    const tau = denominator === 0 ? 0 : (concordant - discordant) / denominator;
    yield {
        stepNumber: step,
        entities: makePoints(points, -1, -1, true),
        edges: [],
        description: `Kendall's tau-b = ${tau.toFixed(6)} from ${concordant} concordant and ${discordant} discordant pair(s).`,
        codeLineNumber: 7,
        layout: "point",
        meta: { n, concordant, discordant, tiePairs: tieCount, tau },
    };
}

/** The Kendall tau module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of measuring the distance of points from a line, Kendall's tau asks a simpler question: for every pair of observations, do the two variables agree on which one is larger? Counting agreements minus disagreements gives a number between minus one and one that describes how consistent the two rankings are.",
        invariants: [
            "Every unordered pair of distinct observations is examined exactly once.",
            "A pair contributes positively only when both coordinates move the same way.",
            "Pairs tied in either coordinate are excluded from both counts, and tau-b adjusts the denominator for them.",
        ],
        correctness:
            "Each pair is classified by the sign of the product of its coordinate differences, so concordant, discordant, and tied pairs partition all pairs. tau-b divides the net agreement by the geometric mean of the counts of pairs untied in x and in y; this is the standard Kendall tau-b estimator and it equals plus or minus one only for perfectly ordered data.",
        complexityRationale:
            "There are n(n-1)/2 pairs and each is classified in constant time, giving O(n^2) time. The group-counting pass uses a map, but only O(n) space is needed for the scatter points and tally groups.",
        uses: [
            "Comparing rankings from two judges or search engines",
            "Robust correlation when data are ordinal or contain outliers",
            "Reporting agreement in sentiment and preference studies",
        ],
        references: [
            "Kendall, A New Measure of Rank Correlation, 1938",
            "Agresti, Analysis of Categorical Data, Chapter 8",
        ],
        workedExample:
            "For points (1,2), (2,3), (3,5), (4,4), (5,7), (6,6), most pairs rise together and only a few cross, so tau-b is about 0.87. If the y values were exactly reversed the count would flip sign and tau-b would be minus one.",
    },
    id: "kendall-tau",
    name: "Kendall Tau",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2],
            [2, 3],
            [3, 5],
            [4, 4],
            [5, 7],
            [6, 6],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the paired observations and count n",
        "count pairs tied in x and pairs tied in y",
        "set concordant and discordant counters to zero",
        "for every pair i less than j compare coordinate signs",
        "increase concordant when the signs agree, discordant otherwise",
        "ignore pairs tied in either coordinate",
        "divide the net count by the untied-pair normalization",
        "done: report Kendall's tau-b",
    ],
};

export default module;
