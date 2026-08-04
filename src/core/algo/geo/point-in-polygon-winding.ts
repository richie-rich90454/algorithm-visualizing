/**
 * point-in-polygon-winding.ts – Point in Polygon (winding number)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The winding-number algorithm computes the total signed angle subtended by
 * the polygon around the query point. The winding number is the number of
 * times the polygon winds counterclockwise around the point; it is non-zero
 * exactly when the point is inside. Unlike ray casting, the winding number
 * also distinguishes "interior" correctly for self-touching polygons.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The polygon is drawn as a closed polyline.
 *   - The query point is YELLOW (comparing).
 *   - The winding contribution of each edge is narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The winding number is an integer, giving robust inside/outside.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Point in Polygon (winding) generator.
 *
 * @param input `{ polygon, point }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { polygon?: Array<[number, number]>; point?: [number, number] } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [2, 5],
        [0, 3],
    ];
    const point = task.point ?? [2, 1];

    const scale = 30;
    let step = 0;

    const entities: VisualEntity[] = polygon.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: "",
        value: [x * scale, -y * scale],
        state: "unvisited",
        x: x * scale,
        y: -y * scale,
        width: 0,
        height: 0,
        metadata: { index },
    }));
    entities.push({
        id: "query",
        type: "node" as const,
        label: "?",
        value: [point[0] * scale, -point[1] * scale],
        state: "comparing",
        x: point[0] * scale,
        y: -point[1] * scale,
        width: 0,
        height: 0,
        metadata: { index: polygon.length },
    });

    const edges: VisualEdge[] = [];
    for (let i = 0; i < polygon.length; i += 1) {
        edges.push({
            id: `e-${i}`,
            sourceId: `p-${i}`,
            targetId: `p-${(i + 1) % polygon.length}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Winding number of (${point[0]}, ${point[1]}) around the polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Winding number: sum signed crossing contributions.
    let winding = 0;

    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i] ?? [0, 0];
        const b = polygon[(i + 1) % polygon.length] ?? [0, 0];

        // Standard winding algorithm (integer arithmetic).
        if (a[1] <= point[1]) {
            if (b[1] > point[1]) {
                // Upward crossing.
                const cross = (b[0] - a[0]) * (point[1] - a[1]) - (point[0] - a[0]) * (b[1] - a[1]);
                if (cross > 0) {
                    winding += 1;
                }
            }
        } else if (b[1] <= point[1]) {
            // Downward crossing.
            const cross = (b[0] - a[0]) * (point[1] - a[1]) - (point[0] - a[0]) * (b[1] - a[1]);
            if (cross < 0) {
                winding -= 1;
            }
        }

        const edge = edges[i];
        if (edge) {
            edge.state = "highlight";
        }
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: edges.map((e) => ({ ...e })),
            description: `Edge ${i} contribution → winding = ${winding}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { winding },
        };
        step += 1;
    }

    const inside = winding !== 0;

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Winding number = ${winding} → point is ${inside ? "INSIDE" : "OUTSIDE"}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { winding, inside },
    };
}

/** The Point in Polygon (winding) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "point-in-polygon-winding",
    name: "Point in Polygon (Winding)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    // Same polygon and point as the ray version for comparison.
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [2, 5],
            [0, 3],
        ],
        point: [2, 1],
    },
    visualType: "graph",
    run,
};

export default module;
