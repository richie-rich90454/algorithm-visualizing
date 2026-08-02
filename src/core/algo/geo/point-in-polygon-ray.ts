/**
 * point-in-polygon-ray.ts – Point in Polygon (ray casting)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The ray-casting algorithm decides whether a point lies inside a polygon by
 * shooting a horizontal ray to the right and counting how many edges it
 * crosses. If the count is odd the point is inside; if even, outside. This
 * works for both convex and non-convex (simple) polygons.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – one pass over the polygon edges
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The polygon is drawn as a closed polyline.
 *   - The query point is YELLOW (comparing).
 *   - Edges crossed by the ray are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Edge cases (vertex hits, collinear edges) are handled with care.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Point in Polygon (ray) generator.
 *
 * @param input `{ polygon, point }` – a list of vertices and a query point.
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

    // Frame 0: the polygon and the point.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Is (${point[0]}, ${point[1]}) inside the polygon?`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Ray casting: count edge crossings of the ray y = point.y going right.
    let crossings = 0;

    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i] ?? [0, 0];
        const b = polygon[(i + 1) % polygon.length] ?? [0, 0];

        // Standard half-open rule: count when the edge straddles point.y.
        const straddles = a[1] > point[1] !== b[1] > point[1];
        if (straddles) {
            // x at which the ray crosses this edge.
            const xIntersect = a[0] + ((point[1] - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
            if (xIntersect > point[0]) {
                crossings += 1;
                const edge = edges[i];
                if (edge) {
                    edge.state = "sorted";
                }
                yield {
                    stepNumber: step,
                    entities: entities.map((e) => ({ ...e })),
                    edges: edges.map((e) => ({ ...e })),
                    description: `Ray crosses edge ${i} at x=${xIntersect.toFixed(1)} → crossings=${crossings}.`,
                    codeLineNumber: 2,
                    layout: "graph",
                    meta: { crossings },
                };
                step += 1;
            }
        }
    }

    const inside = crossings % 2 === 1;

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Ray crossed ${crossings} edge(s) → point is ${inside ? "INSIDE" : "OUTSIDE"}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { crossings, inside },
    };
}

/** The Point in Polygon (ray) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "point-in-polygon-ray",
    name: "Point in Polygon (Ray)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    // A concave polygon with the query point inside.
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
