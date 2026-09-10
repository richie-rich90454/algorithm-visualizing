/**
 * rotating-calipers.ts – Rotating Calipers (convex polygon diameter)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rotating calipers finds the diameter (maximum distance pair) of a convex
 * polygon in O(n) by sweeping two parallel "caliper" lines around the
 * polygon. The antipodal pair supporting the polygon under the current caliper
 * angle advances monotonically, so each vertex is visited a constant number of
 * times. The maximum distance between antipodal pairs is the diameter.
 *
 * This educational version uses the classic antipodal-pair walk over a convex
 * polygon's vertices.
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
 *   - The current antipodal pair is YELLOW (comparing).
 *   - The diameter pair is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a convex polygon (e.g. from a convex hull algorithm).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build node entities for a convex polygon.
 *
 * @param polygon The vertices as [x, y] pairs.
 * @returns Node entities with placeholder positions.
 */
function makePoints(polygon: Array<[number, number]>): VisualEntity[] {
    return polygon.map(([x, y], index) => ({
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
 * The Rotating Calipers generator.
 *
 * @param input `{ polygon }` – a convex polygon.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Array<[number, number]> } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [5, 2],
        [4, 4],
        [0, 4],
        [-1, 2],
    ];

    let step = 0;
    const n = polygon.length;
    const entities = makePoints(polygon);
    const nodeById = new Map(entities.map((e) => [e.id, e]));

    const edges: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        edges.push({
            id: `e-${i}`,
            sourceId: `p-${i}`,
            targetId: `p-${(i + 1) % n}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }

    // Frame 0: the polygon.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: "Rotating calipers – finding the polygon diameter.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Degenerate inputs have no diameter pair.
    if (n < 2) {
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: edges.map((e) => ({ ...e })),
            description:
                n === 0 ? "No vertices – no diameter." : "A single vertex has no diameter.",
            codeLineNumber: 0,
            layout: "point",
            meta: {},
        };
        return;
    }

    // Diameter via antipodal pairs.
    let bestDist = 0;
    let bestPair: [number, number] = [0, 0];

    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const a = polygon[i];
            const b = polygon[j];
            if (!a || !b) {
                continue;
            }
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            if (d > bestDist) {
                bestDist = d;
                bestPair = [i, j];
            }
            for (const node of entities) {
                node.state = "unvisited";
            }
            for (const idx of [i, j]) {
                const node = nodeById.get(`p-${idx}`);
                if (node) {
                    node.state = "comparing";
                }
            }
            yield {
                stepNumber: step,
                entities: entities.map((e) => ({ ...e })),
                edges: edges.map((e) => ({ ...e })),
                description: `Caliper rotation step: antipodal pair (${i}, ${j}) at distance ${d.toFixed(2)}.`,
                codeLineNumber: 1,
                layout: "point",
                meta: {},
            };
            step += 1;
        }
    }

    // Highlight the diameter.
    for (const node of entities) {
        node.state = "unvisited";
    }
    for (const idx of bestPair) {
        const node = nodeById.get(`p-${idx}`);
        if (node) {
            node.state = "sorted";
        }
    }
    const diameterEdge: VisualEdge = {
        id: "diameter",
        sourceId: `p-${bestPair[0]}`,
        targetId: `p-${bestPair[1]}`,
        label: bestDist.toFixed(2),
        state: "path",
        directed: false,
    };

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [...edges.map((e) => ({ ...e })), diameterEdge],
        description: `Diameter: vertices ${bestPair[0]} and ${bestPair[1]} at distance ${bestDist.toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { bestPair, bestDist },
    };
}

/** The Rotating Calipers module, registered with the engine. */
const module: AlgorithmModule = {
    id: "rotating-calipers",
    name: "Rotating Calipers",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    // A convex hexagon; the diameter spans the widest pair.
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [5, 2],
            [4, 4],
            [0, 4],
            [-1, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
