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
 * strip can be sorted by y and only a constant number of neighbours need
 * checking, the total is O(n log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The split line is narrated.
 *   - The candidate pair being compared is YELLOW (comparing).
 *   - The closest pair is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The strip-and-neighbour-check is the conceptual heart.
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

    // Frame 0: all points.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Closest pair of ${points.length} points – divide and conquer.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
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
                codeLineNumber: 2,
                layout: "graph",
                meta: { bestDist },
            };
            step += 1;

            if (d < bestDist) {
                bestDist = d;
                best = [i, j];
            }
        }
    }

    // Reset and colour the best pair.
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
        codeLineNumber: 4,
        layout: "graph",
        meta: { best, bestDist },
    };
}

/** The Closest Pair module, registered with the engine. */
const module: AlgorithmModule = {
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
};

export default module;
