/**
 * doubly-connected-edge-list.ts – Doubly Connected Edge List
 *
 * Planar subdivisions as twin half-edges: each half-edge knows its
 * origin, twin, next edge around the face, and incident face. Walking
 * next pointers traces the inner face boundary.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[] } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C"];
    let step = 0;

    const halfEdges = [
        { id: "AB", from: "A", twin: "BA", next: "BC", face: "inner" },
        { id: "BC", from: "B", twin: "CB", next: "CA", face: "inner" },
        { id: "CA", from: "C", twin: "AC", next: "AB", face: "inner" },
        { id: "BA", from: "B", twin: "AB", next: "AC", face: "outer" },
        { id: "CB", from: "C", twin: "BC", next: "BA", face: "outer" },
        { id: "AC", from: "A", twin: "CA", next: "CB", face: "outer" },
    ];
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: halfEdges.map((h, i) => ({
            id: `he-${h.id}`,
            type: "cell" as const,
            label: `${h.id}|${h.face === "inner" ? "in" : "out"}`,
            value: h.id,
            state: (hot.has(h.id) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: h.face === "inner" ? 0 : 1, col: i % 3 },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { vertices: vertices.length, halfEdges: halfEdges.length },
    });

    yield snap(new Set(), `Triangle on ${vertices.join(",")} – building 6 half-edges.`, 0);
    step += 1;
    for (const h of halfEdges.slice(0, 3)) {
        yield snap(
            new Set([h.id, h.twin]),
            `Half-edge ${h.id} from ${h.from}, twin ${h.twin}, next ${h.next}.`,
            1,
        );
        step += 1;
    }
    const boundary: string[] = [];
    let cur: (typeof halfEdges)[number] | undefined = halfEdges[0];
    for (let i = 0; i < 3 && cur !== undefined; i += 1) {
        boundary.push(cur.id);
        cur = halfEdges.find((h) => h.id === cur?.next);
    }
    yield snap(
        new Set(boundary),
        `Walking next pointers traces the inner face: ${boundary.join(" -> ")}.`,
        2,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A doubly connected edge list represents a planar subdivision with half-edges. Each directed edge knows its origin, its twin in the opposite direction, the next half-edge around its face, and its incident face. Walking next pointers traces face boundaries, which is what makes planar queries efficient.",
        "invariants": [
            "Every undirected edge has exactly two twin half-edges.",
            "Following next from a half-edge stays on the same face.",
            "Around each vertex, half-edges are ordered by angle."
        ],
        "correctness": "Because each half-edge is assigned to one face and next links within that face, traversing next returns to the start after visiting the full boundary. Twins encode both sides of every edge, so no incidence is lost. Counting vertices, edges, and faces then satisfies Euler's formula for a connected planar graph.",
        "complexityRationale": "Each half-edge stores a constant number of pointers, so space is O(E). Traversing one face takes time proportional to its boundary length; looking up an incident edge is O(1) given a half-edge.",
        "uses": [
            "GIS and map overlay operations",
            "Planar graph algorithms and face traversal",
            "Computational geometry and mesh processing"
        ],
        "references": [
            "M. de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
            "F. P. Preparata and M. I. Shamos, Computational Geometry: An Introduction"
        ],
        "workedExample": "A triangle with vertices A, B, C has six half-edges: A->B, B->C, C->A bound the inner face, and their twins bound the outer face. Starting at A->B and following next visits B->C then C->A and returns to A->B, tracing the triangle once."
    },
    id: "doubly-connected-edge-list",
    name: "Doubly Connected Edge List",
    category: "data-structures",
    complexity: { time: "O(1) per link", space: "O(edges)" },
    defaultInput: { vertices: ["A", "B", "C"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty DCEL with vertex and half-edge records",
        "insert edge as twin half-edges with next pointers",
        "compare angles to sort edges around each vertex",
        "traverse face by following next pointers in cycle",
        "count vertices edges and faces for Euler check",
        "query incident edges of a vertex",
        "done: DCEL stores subdivision with face traversal answer",
    ],
};

export default module;
