/**
 * polygon-area-shoelace.ts – Polygon Area (shoelace formula)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The shoelace formula computes the signed area of a polygon from its vertex
 * coordinates:
 *
 *   Area = ½ · | Σ (x_i·y_{i+1} − x_{i+1}·y_i) |
 *
 * The sum is over consecutive vertices (cyclically). The name comes from the
 * criss-cross pattern of the multiplied terms.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The polygon is drawn as a closed polyline.
 *   - The edge contributing the current term is YELLOW (comparing).
 *   - The final area is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The signed area reveals vertex orientation (CW vs CCW).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build node entities for a polygon.
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
 * The Polygon Area (shoelace) generator.
 *
 * @param input `{ polygon }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Array<[number, number]> } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
    ];

    const n = polygon.length;
    let step = 0;

    const entities = makePoints(polygon);
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
        description: `Shoelace area of a ${n}-vertex polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Shoelace summation.
    let sum = 0;
    const terms: number[] = [];

    for (let i = 0; i < n; i += 1) {
        const a = polygon[i] ?? [0, 0];
        const b = polygon[(i + 1) % n] ?? [0, 0];
        const term = a[0] * b[1] - b[0] * a[1];
        sum += term;
        terms.push(term);

        // Highlight the edge.
        const edge = edges[i];
        if (edge) {
            edge.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: edges.map((e) => ({ ...e })),
            description: `Term ${i}: ${a[0]}·${b[1]} − ${b[0]}·${a[1]} = ${term} (running sum ${sum}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { sum },
        };
        step += 1;
    }

    const area = Math.abs(sum) / 2;
    const orientation = sum > 0 ? "counter-clockwise" : sum < 0 ? "clockwise" : "degenerate";

    for (const edge of edges) {
        edge.state = "sorted";
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Area = |${sum}| / 2 = ${area} (${orientation}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { area, orientation },
    };
}

/** The Polygon Area (shoelace) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "polygon-area-shoelace",
    name: "Polygon Area (Shoelace)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    // A 4×3 rectangle has area 12.
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
