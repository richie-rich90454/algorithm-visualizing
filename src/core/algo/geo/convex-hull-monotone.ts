/**
 * convex-hull-monotone.ts – Convex Hull (Monotone chain / Andrew's algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Andrew's monotone chain builds the convex hull by sorting points by
 * (x, y) and constructing the lower and upper hulls separately with the same
 * stack-based right-turn test as Graham's scan, but without needing an angular
 * sort. It is simpler and more numerically robust than Graham's scan.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) – dominated by the coordinate sort
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The lower hull is built first (BLUE / active).
 *   - The upper hull is added next (GREEN / sorted).
 *   - Popped points are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Two passes, one for each half of the hull.
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

/** Cross product sign of (a, b, c). */
function cross(a: [number, number], b: [number, number], c: [number, number]): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * The Convex Hull (Monotone chain) generator.
 *
 * @param input `{ points }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Array<[number, number]> } | null) ?? {};
    const points: Array<[number, number]> = task.points ?? [
        [0, 3],
        [1, 1],
        [2, 2],
        [4, 4],
        [0, 0],
        [1, 2],
        [3, 1],
        [3, 3],
        [2, 4],
    ];

    let step = 0;
    const entities = makePoints(points);
    const nodeById = new Map(entities.map((e) => [e.id, e]));

    // Degenerate inputs are their own hull.
    if (points.length <= 1) {
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: [],
            description:
                points.length === 0
                    ? "No points – the hull is empty."
                    : "A single point is its own convex hull.",
            codeLineNumber: 0,
            layout: "point",
            meta: { hull: points.map((_, i) => i) },
        };
        return;
    }

    // Frame 0: all points.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: "Monotone chain – sorting points by (x, y).",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Sort by (x, y).
    const sorted = points
        .map((p, index) => ({ p, index }))
        .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1])
        .map((entry) => entry.index);

    // The cross-product-based hull builder.
    const build = (indices: number[]): number[] => {
        const hull: number[] = [];
        for (const idx of indices) {
            while (hull.length >= 2) {
                const top = hull[hull.length - 1] ?? 0;
                const next = hull[hull.length - 2] ?? 0;
                const a = points[next] ?? [0, 0];
                const b = points[top] ?? [0, 0];
                const c = points[idx] ?? [0, 0];
                if (cross(a, b, c) <= 0) {
                    const popped = hull.pop();
                    const poppedNode = nodeById.get(`p-${popped}`);
                    if (poppedNode) {
                        poppedNode.state = "swapped";
                    }
                } else {
                    break;
                }
            }
            hull.push(idx);
        }
        return hull;
    };

    // Lower hull.
    const lower = build(sorted);
    for (const idx of lower) {
        const node = nodeById.get(`p-${idx}`);
        if (node) {
            node.state = "active";
        }
    }
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Lower hull: [${lower.join(", ")}].`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Upper hull (reverse order).
    const reversed = [...sorted].reverse();
    const upper = build(reversed);

    // Combine (drop duplicated endpoints).
    const hull = [...lower, ...upper.slice(1, upper.length - 1)];
    for (const idx of hull) {
        const node = nodeById.get(`p-${idx}`);
        if (node) {
            node.state = "sorted";
        }
    }
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Upper hull built – combined hull: [${hull.join(", ")}].`,
        codeLineNumber: 3,
        layout: "point",
        meta: {},
    };
    step += 1;

    const edges: VisualEdge[] = [];
    for (let i = 0; i < hull.length; i += 1) {
        const from = hull[i];
        const to = hull[(i + 1) % hull.length];
        if (from !== undefined && to !== undefined) {
            edges.push({
                id: `hull-${from}-${to}`,
                sourceId: `p-${from}`,
                targetId: `p-${to}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges,
        description: `Convex hull: ${hull.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { hull },
    };
}

/** The Convex Hull (Monotone chain) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "convex-hull-monotone",
    name: "Convex Hull (Monotone Chain)",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Same point set as the Graham version for comparison.
    defaultInput: {
        points: [
            [0, 3],
            [1, 1],
            [2, 2],
            [4, 4],
            [0, 0],
            [1, 2],
            [3, 1],
            [3, 3],
            [2, 4],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
