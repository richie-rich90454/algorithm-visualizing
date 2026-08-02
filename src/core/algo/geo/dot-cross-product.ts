/**
 * dot-cross-product.ts – Dot and Cross Products
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The dot and cross products are the fundamental operations of computational
 * geometry. For vectors u = (u1, u2) and v = (v1, v2):
 *
 *   u·v   = u1·v1 + u2·v2            (scalar – sign tells angle < or > 90°)
 *   u×v   = u1·v2 − u2·v1            (signed area of the parallelogram)
 *
 * The sign of the cross product is the standard "orientation" test: whether v
 * is a clockwise or counter-clockwise turn from u. This visualisation draws
 * two vectors and computes both products.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Vector u is drawn BLUE (active).
 *   - Vector v is drawn PINK (highlight).
 *   - The scalar results are narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Cross-product sign = orientation test used everywhere in geometry.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Dot/Cross Product generator.
 *
 * @param input `{ u, v }` – two vectors as [x, y] pairs.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { u?: [number, number]; v?: [number, number] } | null) ?? {};
    const u = task.u ?? [3, 2];
    const v = task.v ?? [1, 4];

    let step = 0;

    // Three points: origin, u tip, v tip.
    const entities: VisualEntity[] = [
        { id: "origin", label: "O", x: 0, y: 0 },
        { id: "u", label: "u", x: u[0] * 30, y: -u[1] * 30 },
        { id: "v", label: "v", x: v[0] * 30, y: -v[1] * 30 },
    ].map((p, index) => ({
        id: p.id,
        type: "node" as const,
        label: p.label,
        value: [p.x, p.y],
        state: "unvisited",
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        metadata: { index },
    }));

    const edges: VisualEdge[] = [
        {
            id: "edge-u",
            sourceId: "origin",
            targetId: "u",
            label: "u",
            state: "active",
            directed: false,
        },
        {
            id: "edge-v",
            sourceId: "origin",
            targetId: "v",
            label: "v",
            state: "highlight",
            directed: false,
        },
    ];

    const dot = u[0] * v[0] + u[1] * v[1];
    const cross = u[0] * v[1] - u[1] * v[0];

    // Frame 0: the two vectors.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Vectors u=${u.join(", ")} and v=${v.join(", ")}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `u·v = ${u[0]}·${v[0]} + ${u[1]}·${v[1]} = ${dot}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { dot },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `u×v = ${u[0]}·${v[1]} − ${u[1]}·${v[0]} = ${cross} (${cross > 0 ? "counter-clockwise" : cross < 0 ? "clockwise" : "collinear"}).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { dot, cross },
    };
}

/** The Dot/Cross Product module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dot-cross-product",
    name: "Dot & Cross Product",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    // u = (3,2), v = (1,4): cross = 3·4 − 2·1 = 10 (counter-clockwise).
    defaultInput: { u: [3, 2], v: [1, 4] },
    visualType: "graph",
    run,
};

export default module;
