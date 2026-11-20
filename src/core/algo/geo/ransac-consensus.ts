/**
 * ransac-consensus.ts - RANSAC Consensus Line Fitting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RANSAC (random sample consensus) fits a model to data that contains
 * outliers. For a line it repeatedly draws two random points, forms the line
 * through them, and counts how many points lie within a distance threshold of
 * that line. The sample with the largest consensus set wins, and the final
 * model is refit to those inliers. Unlike least squares, a minority of wild
 * points cannot pull the answer away from the dominant structure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for consensus counting
 *   Space: O(n) for the point and inlier buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input points are POINT nodes; inliers are PATH, outliers are IDLE.
 *   - The current random pair is HIGHLIGHT.
 *   - The winning line is drawn as an edge between two computed endpoints.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Line = { a: number; b: number; c: number };

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Normalized line through two distinct points. */
function lineThrough(p: Pt, q: Pt): Line {
    const a = -(q[1] - p[1]);
    const b = q[0] - p[0];
    const norm = Math.hypot(a, b);
    if (norm < 1e-12) return { a: 0, b: 1, c: -p[1] };
    const na = a / norm;
    const nb = b / norm;
    return { a: na, b: nb, c: -(na * p[0] + nb * p[1]) };
}

function inliers(line: Line, points: Pt[], threshold: number): boolean[] {
    return points.map((p) => Math.abs(line.a * p[0] + line.b * p[1] + line.c) <= threshold);
}

function pointNodes(points: Pt[], mask: boolean[], pair: [number, number] | null): VisualEntity[] {
    return points.map((p, i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: `p${i}`,
        value: [p[0], p[1]],
        state: (pair && (i === pair[0] || i === pair[1])
            ? "highlight"
            : mask[i] ? "path" : "idle") as EntityState,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { x: p[0], y: p[1], index: i },
    }));
}

/** Sample lines, keep the largest consensus, then refit to its inliers. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        points?: Pt[]; iterations?: number; threshold?: number; seed?: number;
    } | null) ?? {};
    const points: Pt[] = task.points && task.points.length >= 2
        ? task.points
        : [
            [0, 1], [1, 1.5], [2, 2], [3, 2.5], [4, 3], [5, 3.5],
            [6, 4], [7, 4.5], [1, 8], [4, -2], [6, 9],
        ];
    const iterations = Math.max(1, Math.floor(task.iterations ?? 60));
    const threshold = Math.max(1e-9, task.threshold ?? 0.4);
    const rng = makeRng(typeof task.seed === "number" ? task.seed : 7);

    let step = 0;
    yield {
        stepNumber: step,
        entities: pointNodes(points, points.map(() => false), null),
        edges: [],
        description: `Fit a line to ${points.length} points with RANSAC using ${iterations} random samples.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: points.length, iterations, threshold, bestCount: 0 },
    };
    step += 1;

    let bestLine: Line = lineThrough(points[0]!, points[1]!);
    let bestMask = inliers(bestLine, points, threshold);
    let bestCount = bestMask.filter(Boolean).length;
    const displayStride = Math.max(1, Math.ceil(iterations / 40));

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        let i = Math.floor(rng() * points.length);
        let j = Math.floor(rng() * points.length);
        if (i === j) {
            j = (j + 1) % points.length;
        }
        const candidate = lineThrough(points[i]!, points[j]!);
        const mask = inliers(candidate, points, threshold);
        const count = mask.filter(Boolean).length;
        if (count > bestCount) {
            bestCount = count;
            bestLine = candidate;
            bestMask = mask;
        }
        if (iteration % displayStride === 0 || iteration === iterations - 1) {
            yield {
                stepNumber: step,
                entities: pointNodes(points, bestMask, [i, j]),
                edges: [],
                description: `Sample ${iteration + 1}: pair (${i}, ${j}) gives ${count} inliers; best so far ${bestCount}.`,
                codeLineNumber: 2,
                layout: "point",
                meta: { n: points.length, iteration: iteration + 1, sampled: [i, j], count, bestCount },
            };
            step += 1;
        }
    }

    const xs = bestMask.map((keep, i) => (keep ? points[i]![0] : null)).filter((x): x is number => x !== null);
    const ys = bestMask.map((keep, i) => (keep ? points[i]![1] : null)).filter((y): y is number => y !== null);
    let model = bestLine;
    let slope: number | null = null;
    let intercept: number | null = null;
    if (xs.length >= 2) {
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const my = ys.reduce((a, b) => a + b, 0) / ys.length;
        let denom = 0;
        let numer = 0;
        for (let i = 0; i < points.length; i += 1) {
            if (bestMask[i]) {
                numer += (points[i]![0] - mx) * (points[i]![1] - my);
                denom += (points[i]![0] - mx) ** 2;
            }
        }
        if (denom > 1e-12) {
            slope = numer / denom;
            intercept = my - slope * mx;
            model = lineThrough([xs[0]!, slope * xs[0]! + intercept], [xs[0]! + 1, slope * (xs[0]! + 1) + intercept]);
        }
    }

    const finalMask = inliers(model, points, threshold);
    const minX = Math.min(...points.map((p) => p[0]));
    const maxX = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));
    const lineEnds: [Pt, Pt] = Math.abs(model.b) >= Math.abs(model.a)
        ? [[minX, -(model.a * minX + model.c) / model.b], [maxX, -(model.a * maxX + model.c) / model.b]]
        : [[-(model.b * minY + model.c) / model.a, minY], [-(model.b * maxY + model.c) / model.a, maxY]];

    const endpoints: VisualEntity[] = [
        { id: "line-a", type: "node", label: "fit a", value: lineEnds[0], state: "path", x: lineEnds[0][0], y: lineEnds[0][1], width: 0, height: 0, metadata: {} },
        { id: "line-b", type: "node", label: "fit b", value: lineEnds[1], state: "path", x: lineEnds[1][0], y: lineEnds[1][1], width: 0, height: 0, metadata: {} },
    ];
    yield {
        stepNumber: step,
        entities: [...pointNodes(points, finalMask, null), ...endpoints],
        edges: [{ id: "fit-line", sourceId: "line-a", targetId: "line-b", label: "", state: "path", directed: false }],
        description: `RANSAC fit: ${bestCount} consensus points, refit accepts ${finalMask.filter(Boolean).length} inliers.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            n: points.length,
            iterations,
            threshold,
            bestCount,
            finalCount: finalMask.filter(Boolean).length,
            slope: slope ?? 0,
            intercept: intercept ?? 0,
        },
    };
}

/** The RANSAC consensus module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Least squares assumes every observation is trustworthy, so one gross error can ruin the fit. RANSAC instead bets that a random small sample is clean: two points define a candidate line, and the rest of the data votes on it. The line with the most votes wins, and only those voters are used for the final fit. The randomness is a search strategy, not a change to the answer.",
        invariants: [
            "A candidate model is defined by exactly two distinct sampled points.",
            "A point is an inlier exactly when its perpendicular distance is below the threshold.",
            "The best consensus count is nondecreasing across samples.",
        ],
        correctness:
            "If any pair of inliers is sampled, the resulting candidate is arbitrarily close to the true line, so its consensus set contains all genuine inliers and no outliers beyond the threshold. The search keeps the largest such set. Because the true inlier set is the largest structure by assumption, maximizing consensus recovers it, and least squares refit on that set gives an unbiased line.",
        complexityRationale:
            "Each of the iterations samples two points and scans all n points once to count inliers, giving O(iterations * n) time. Only the point array, masks, and a few scalar models are stored, so space is O(n).",
        uses: [
            "Estimating lines and planes from noisy sensor data",
            "Feature matching and homography estimation in computer vision",
            "Fitting motion models when tracking contains dropouts",
        ],
        references: [
            "Fischler and Bolles, Random Sample Consensus: A Paradigm for Model Fitting, 1981",
            "Hartley and Zisserman, Multiple View Geometry in Computer Vision",
        ],
        workedExample:
            "Given eight points near y = 0.5x + 1 and three scattered outliers, a sample drawn from two of the eight near-collinear points yields a line within the threshold of all eight. Outlier-heavy samples collect at most two votes, so the consensus of eight wins and the refit line recovers the original slope.",
    },
    id: "ransac-consensus",
    name: "RANSAC Consensus",
    category: "geometry",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 1], [1, 1.5], [2, 2], [3, 2.5], [4, 3], [5, 3.5],
            [6, 4], [7, 4.5], [1, 8], [4, -2], [6, 9],
        ],
        iterations: 60,
        threshold: 0.4,
        seed: 7,
    },
    visualType: "point",
    run,
    pseudocode: [
        "choose a distance threshold and an iteration budget",
        "for each iteration pick two distinct random points",
        "form the line through the pair and count inliers within the threshold",
        "keep the model with the largest consensus set",
        "refit a least squares line to the winning inliers",
        "done: report the fitted line and its inlier count",
    ],
};

export default module;
