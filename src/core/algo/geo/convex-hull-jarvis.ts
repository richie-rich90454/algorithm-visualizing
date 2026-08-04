/**
 * convex-hull-jarvis.ts – Convex Hull (Jarvis march / gift wrapping)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jarvis march (gift wrapping) finds the convex hull by walking along its
 * boundary. Starting from the leftmost point, it repeatedly picks the next
 * hull vertex as the point that makes the smallest counter-clockwise turn from
 * the current edge – exactly like wrapping string around the point set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·h) where h is the number of hull vertices
 *   Space: O(h)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current hull vertex is YELLOW (comparing).
 *   - The candidate with the smallest turn is PINK (highlight).
 *   - Finished hull edges are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal when the hull is small (h << n).
 *   - The "choose the most left-turning point" step is the heart.
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
 * The Convex Hull (Jarvis) generator.
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

    // Frame 0: all points.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: "Jarvis march – wrapping the hull around the point set.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Start from the leftmost (then lowest) point.
    let start = 0;
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i];
        const b = points[start];
        if (!a || !b) {
            continue;
        }
        if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) {
            start = i;
        }
    }

    const hull: number[] = [start];
    let current = start;

    // Gift wrapping loop.
    for (;;) {
        let next = (current + 1) % points.length;
        // Find the point with the smallest counter-clockwise turn.
        for (let i = 0; i < points.length; i += 1) {
            const a = points[current];
            const b = points[next];
            const c = points[i];
            if (!a || !b || !c) {
                continue;
            }
            // If i is strictly more counter-clockwise than next, use i.
            const cr = cross(a, b, c);
            if (cr > 0 || (cr === 0 && dist2(a, c) > dist2(a, b))) {
                next = i;
            }
        }

        // Highlight the chosen vertex.
        for (const idx of hull) {
            const node = nodeById.get(`p-${idx}`);
            if (node) {
                node.state = "sorted";
            }
        }
        const nextNode = nodeById.get(`p-${next}`);
        if (nextNode) {
            nextNode.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: [],
            description: `Marching: from ${current} to ${next}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {},
        };
        step += 1;

        if (next === start) {
            break;
        }
        hull.push(next);
        current = next;

        // Safety valve for degenerate inputs.
        if (hull.length > points.length + 1) {
            break;
        }
    }

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

/** Squared distance between two points. */
function dist2(a: [number, number], b: [number, number]): number {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** The Convex Hull (Jarvis) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "convex-hull-jarvis",
    name: "Convex Hull (Jarvis)",
    category: "geometry",
    complexity: { time: "O(n·h)", space: "O(h)" },
    // Same point set as the other hull algorithms for comparison.
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
