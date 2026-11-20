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
 * is a clockwise or counterclockwise turn from u. This visualization draws
 * two vectors and computes both products.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
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
        meta: { u, v },
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
        description: `u×v = ${u[0]}·${v[1]} − ${u[1]}·${v[0]} = ${cross} (${cross > 0 ? "counterclockwise" : cross < 0 ? "clockwise" : "collinear"}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { dot, cross },
    };
}

/** The Dot/Cross Product module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "The dot product and cross product are the two basic ways to combine planar vectors. The dot product measures how much two vectors point the same way and its sign tells whether the angle is acute or obtuse. The cross product gives the signed area of the parallelogram they span and its sign is the standard left-or-right turn test.",
        "invariants": [
            "dot(u,v) equals |u| times |v| times the cosine of the angle between them.",
            "cross(u,v) equals |u| times |v| times the sine of the signed angle.",
            "cross(u,v) is positive exactly when v is counterclockwise from u."
        ],
        "correctness": "Expanding the vectors in coordinates gives dot(u,v) = u1*v1 + u2*v2 and cross(u,v) = u1*v2 - u2*v1, which are the algebraic forms of the cosine and sine relations. The sign of the dot follows the cosine, so it classifies acute versus obtuse angles. The sign of the cross follows the sine, so it classifies left versus right turns and zero indicates collinearity.",
        "complexityRationale": "Each product uses a fixed number of multiplications and additions, so time is O(1). No arrays are allocated, so space is O(1).",
        "uses": [
            "Orientation tests in convex hulls and segment intersection",
            "Projection and similarity scoring in graphics and machine learning",
            "Computing areas and angles in physics simulations"
        ],
        "references": [
            "Strang, Linear Algebra and Its Applications, Chapter 1",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1"
        ],
        "workedExample": "For u = (3,1) and v = (2,4), dot = 3*2 + 1*4 = 10, which is positive so the angle is acute. Cross = 3*4 - 1*2 = 10, also positive, so v is a counterclockwise turn from u."
    },

    id: "dot-cross-product",
    name: "Dot & Cross Product",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    // u = (3,2), v = (1,4): cross = 3·4 − 2·1 = 10 (counterclockwise).
    defaultInput: { u: [3, 2], v: [1, 4] },
    visualType: "graph",
    run,
    pseudocode: [
        "start from vectors u and v at the origin",
        "multiply matching parts and add for the dot product",
        "cross-multiply and subtract for the cross product",
        "read the sign: counterclockwise, clockwise, or collinear",
        "done: dot measures alignment and cross measures turning",
    ],
};

export default module;
