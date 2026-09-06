/**
 * convex-hull-graham.ts – Convex Hull (Graham scan)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The convex hull of a point set is the smallest convex polygon containing all
 * points. Graham's scan sorts the points by angle around the lowest point,
 * then walks them once, maintaining a stack of hull vertices and popping any
 * vertex that makes a right turn (a clockwise turn breaks convexity).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) – dominated by the angular sort
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot (lowest point) is YELLOW (comparing).
 *   - The current hull stack is GREEN (sorted).
 *   - Points popped from the stack are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The right-turn test is the orientation cross product.
 *   - The stack discipline is the heart to teach.
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
 * The Convex Hull (Graham) generator.
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
        description: "Graham scan – computing the convex hull.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Find the pivot: the lowest (then leftmost) point.
    let pivotIndex = 0;
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i];
        const b = points[pivotIndex];
        if (!a || !b) {
            continue;
        }
        if (a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])) {
            pivotIndex = i;
        }
    }

    // Mark the pivot.
    const pivotNode = nodeById.get(`p-${pivotIndex}`);
    if (pivotNode) {
        pivotNode.state = "comparing";
    }
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Pivot is point ${pivotIndex} (${points[pivotIndex]?.join(", ")}).`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Sort the other points by polar angle around the pivot.
    const pivot = points[pivotIndex] ?? [0, 0];
    const order: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
        if (i !== pivotIndex) {
            order.push(i);
        }
    }
    order.sort((a, b) => {
        const pa = points[a] ?? [0, 0];
        const pb = points[b] ?? [0, 0];
        const cr = cross(pivot, pa, pb);
        if (cr !== 0) {
            return -cr; // counterclockwise first
        }
        // Ties: closer first.
        const da = (pa[0] - pivot[0]) ** 2 + (pa[1] - pivot[1]) ** 2;
        const db = (pb[0] - pivot[0]) ** 2 + (pb[1] - pivot[1]) ** 2;
        return da - db;
    });

    // Graham scan with a stack.
    const stack: number[] = [pivotIndex, order[0] ?? pivotIndex];

    for (let i = 1; i < order.length; i += 1) {
        const candidate = order[i];
        if (candidate === undefined) {
            continue;
        }

        // Pop while the last three make a non-left turn.
        while (stack.length >= 2) {
            const top = stack[stack.length - 1] ?? 0;
            const next = stack[stack.length - 2] ?? 0;
            const a = points[next] ?? [0, 0];
            const b = points[top] ?? [0, 0];
            const c = points[candidate] ?? [0, 0];
            if (cross(a, b, c) <= 0) {
                const popped = stack.pop();
                const poppedNode = nodeById.get(`p-${popped}`);
                if (poppedNode) {
                    poppedNode.state = "swapped";
                }
            } else {
                break;
            }
        }

        stack.push(candidate);

        // Highlight the current stack.
        for (const idx of stack) {
            const node = nodeById.get(`p-${idx}`);
            if (node) {
                node.state = "sorted";
            }
        }
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: [],
            description: `Hull stack after point ${candidate}: [${stack.join(", ")}].`,
            codeLineNumber: 3,
            layout: "point",
            meta: {},
        };
        step += 1;
    }

    // Build the hull edge entities.
    const edges: VisualEdge[] = [];
    for (let i = 0; i < stack.length; i += 1) {
        const from = stack[i];
        const to = stack[(i + 1) % stack.length];
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
        description: `Convex hull: ${stack.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { hull: stack },
    };
}

/** The Convex Hull (Graham) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "convex-hull-graham",
    name: "Convex Hull (Graham)",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // A point set with several interior points.
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
