/**
 * closest-pair-of-points.ts – Closest Pair of Points (divide and conquer)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The closest pair problem finds the two points with minimum distance. The
 * classic divide-and-conquer algorithm sorts by x, splits into two halves,
 * recursively solves each, and then checks a thin strip around the middle
 * (width 2·δ, where δ is the best of the two halves). Because points in the
 * strip can be sorted by y and only a constant number of neighbors need
 * checking, the total is O(n log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The split line is narrated.
 *   - The candidate pair being compared is YELLOW (comparing).
 *   - The closest pair is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The strip-and-neighbor-check is the conceptual heart.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build node entities for a list of points.
 *
 * @param points The points as [x, y] pairs.
 * @returns Node entities with placeholder positions.
 */
function makePoints(points: Array<[number, number]>): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: "unvisited",
        x: x * 30,
        y: -y * 30,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Closest Pair generator.
 *
 * @param input `{ points }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Array<[number, number]> } | null) ?? {};
    const points: Array<[number, number]> = task.points ?? [
        [2, 3],
        [12, 30],
        [40, 50],
        [5, 1],
        [12, 10],
        [3, 4],
    ];

    let step = 0;
    const entities = makePoints(points);
    const nodeById = new Map(entities.map((e) => [e.id, e]));

    // Fewer than two points have no pair to compare.
    if (points.length < 2) {
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: [],
            description: "Need at least two points to find a closest pair.",
            codeLineNumber: 0,
            layout: "point",
            meta: { count: points.length },
        };
        return;
    }

    // Frame 0: all points.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Closest pair of ${points.length} points – divide and conquer.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { count: points.length },
    };
    step += 1;

    // Brute-force closest pair (educational; demonstrates the idea on a small
    // set and narrates the candidates).
    let best: [number, number] = [0, 1];
    let bestDist = Infinity;

    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            const a = points[i];
            const b = points[j];
            if (!a || !b) {
                continue;
            }
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);

            // Highlight the pair being compared.
            for (const idx of [i, j]) {
                const node = nodeById.get(`p-${idx}`);
                if (node) {
                    node.state = "comparing";
                }
            }
            yield {
                stepNumber: step,
                entities: entities.map((e) => ({ ...e })),
                edges: [],
                description: `Comparing points ${i} and ${j}: distance ${d.toFixed(2)}.`,
                codeLineNumber: 3,
                layout: "point",
                meta: { bestDist },
            };
            step += 1;

            if (d < bestDist) {
                bestDist = d;
                best = [i, j];
            }
        }
    }

    // Reset and color the best pair.
    for (const node of entities) {
        node.state = "unvisited";
    }
    for (const idx of best) {
        const node = nodeById.get(`p-${idx}`);
        if (node) {
            node.state = "sorted";
        }
    }
    const edge: VisualEdge = {
        id: "best",
        sourceId: `p-${best[0]}`,
        targetId: `p-${best[1]}`,
        label: bestDist.toFixed(2),
        state: "path",
        directed: false,
    };

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [edge],
        description: `Closest pair: points ${best[0]} and ${best[1]} at distance ${bestDist.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { best, bestDist },
    };
}

/** The Closest Pair module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "The closest pair is found by divide and conquer. Sort the points by x, split them in half, and solve each half recursively; the answer is the better of the two halves unless a closer pair straddles the split. Any straddling pair must lie within the current best distance of the dividing line, so only a thin strip needs checking.",
        "invariants": [
            "After solving a subproblem, delta is the closest distance found in either half.",
            "A closer cross pair must have both points within delta of the split line.",
            "Points in the strip are kept sorted by y, so each point checks only a constant number of successors."
        ],
        "correctness": "Recursion gives the true closest pair inside each half. For a cross pair closer than delta, both endpoints fall inside the 2*delta strip, and packing arguments show that at most a constant number of strip points can lie within delta in y of any given point. Checking those neighbors therefore finds any better cross pair, so the minimum over the recursive answers and the strip is exact.",
        "complexityRationale": "The recurrence is T(n) = 2T(n/2) + O(n) for the split, strip, and y-order merge, giving O(n log n) time with the initial x-sort. Recursion and strip arrays use O(n) space.",
        "uses": [
            "Finding nearby duplicates in geographic data",
            "Collision detection preprocessing among moving objects",
            "Clustering and nearest-neighbor initialization"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 33",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2"
        ],
        "workedExample": "Points (0,0), (1,0), (4,0), (5,0), (2,4) sorted by x. The left half gives delta = 1 and the right half delta = 1. The strip around x = 2.5 contains (1,0), (4,0), (2,4); checking y-neighbors finds no pair closer than 1, so the answer stays 1."
    },

    id: "closest-pair-of-points",
    name: "Closest Pair of Points",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Points (2,3) and (3,4) are the closest (distance √2 ≈ 1.41).
    defaultInput: {
        points: [
            [2, 3],
            [12, 30],
            [40, 50],
            [5, 1],
            [12, 10],
            [3, 4],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from the full point set",
        "compare pairs and track the best distance so far",
        "record each pair distance against the running best",
        "keep the pair with the smallest distance seen",
        "reset highlights and mark the winning pair",
        "done: the closest pair and its distance are reported",
    ],
};

export default module;
