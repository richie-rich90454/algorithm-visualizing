/**
 * slab-method-point-location.ts - Slab Decomposition for Planar Point Location.
 *
 * Vertical lines through every polygon vertex split the plane into vertical
 * slabs. Inside one slab the set of edges is fixed and their vertical order
 * never changes, so a query point can be located by finding its slab and then
 * comparing its height with the stored edge order. The parity of the edges
 * below the point decides whether it lies inside the polygon.
 *
 * Time:  O(n) preprocessing space, O(log n) slab search then O(k) scan
 * Space: O(n^2) worst case for the slab edge lists
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type Edge = { id: string; a: number; b: number; x1: number; y1: number; x2: number; y2: number };

const yAt = (edge: Edge, x: number): number => edge.y1 + ((edge.y2 - edge.y1) * (x - edge.x1)) / (edge.x2 - edge.x1 || 1);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Point[]; queries?: Point[] } | null) ?? {};
    const polygon: Point[] = task.polygon ?? [
        [0, 0], [6, 0], [6, 5], [3, 7], [0, 5],
    ];
    const queries: Point[] = task.queries ?? [
        [2, 2], [5, 6], [3, 4], [7, 3],
    ];

    const edges: Edge[] = polygon.map(([x1, y1], i) => {
        const [x2, y2] = polygon[(i + 1) % polygon.length] as Point;
        return { id: `edge-${i}`, a: i, b: (i + 1) % polygon.length, x1, y1, x2, y2 };
    });
    const boundaries = [...new Set(polygon.map((p) => p[0]))].sort((a, b) => a - b);
    const slabs = boundaries.slice(0, -1).map((left, i) => {
        const right = boundaries[i + 1] as number;
        const crossing = edges
            .filter((e) => Math.min(e.x1, e.x2) <= left && Math.max(e.x1, e.x2) >= right)
            .sort((e1, e2) => yAt(e1, (left + right) / 2) - yAt(e2, (left + right) / 2));
        return { left, right, crossing };
    });

    const baseEntities = (): VisualEntity[] => {
        const entities: VisualEntity[] = polygon.map(([x, y], i) => ({
            id: `v-${i}`,
            type: "node" as const,
            label: String(i),
            value: [x, y],
            state: "unvisited",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { role: "vertex" },
        }));
        queries.forEach(([x, y], i) => {
            entities.push({
                id: `q-${i}`,
                type: "node" as const,
                label: "Q",
                value: [x, y],
                state: "comparing",
                x,
                y,
                width: 0,
                height: 0,
                metadata: { role: "query" },
            });
        });
        return entities;
    };
    const polygonEdges = (states: Map<string, EntityState>): VisualEdge[] =>
        edges.map((e) => ({
            id: e.id,
            sourceId: `v-${e.a}`,
            targetId: `v-${e.b}`,
            label: "",
            state: states.get(e.id) ?? "idle",
            directed: false,
        }));

    let step = 0;
    const emit = (message: string, codeLine: number, edgeStates: Map<string, EntityState>, pointStates: Map<string, EntityState>, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities = baseEntities().map((e) => ({ ...e, state: pointStates.get(e.id) ?? e.state }));
        const frame: VisualFrame = {
            stepNumber: step,
            entities,
            edges: polygonEdges(edgeStates),
            description: message,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
        step += 1;
        return frame;
    };

    yield emit(`Polygon with ${polygon.length} vertices split into ${slabs.length} vertical slabs by vertex x-coordinates.`, 1, new Map(), new Map(), { vertices: polygon.length, slabs: slabs.length, queries: queries.length });

    for (let i = 0; i < slabs.length; i += 1) {
        const slab = slabs[i] as { left: number; right: number; crossing: Edge[] };
        const states = new Map<string, EntityState>();
        slab.crossing.forEach((e) => states.set(e.id, "active"));
        yield emit(
            `Slab ${i + 1} spans x in [${slab.left}, ${slab.right}] with ${slab.crossing.length} crossing edge(s) in fixed vertical order.`,
            3,
            states,
            new Map(),
            { slab: i + 1, crossing: slab.crossing.length },
        );
    }

    const inside: boolean[] = [];
    for (let qi = 0; qi < queries.length; qi += 1) {
        const [qx, qy] = queries[qi] as Point;
        let slabIndex = slabs.findIndex((s) => qx >= s.left && qx < s.right);
        const outsideX = qx < (boundaries[0] as number) || qx >= (boundaries[boundaries.length - 1] as number);
        if (slabIndex < 0 && !outsideX) slabIndex = 0;
        const slab = slabs[slabIndex];
        let below = 0;
        const states = new Map<string, EntityState>();
        if (slab && !outsideX) {
            for (const edge of slab.crossing) {
                const y = yAt(edge, qx);
                if (qy > y) below += 1;
                states.set(edge.id, qy > y ? "path" : "visited");
            }
        }
        const isInside = !outsideX && below % 2 === 1;
        inside.push(isInside);
        yield emit(
            `Query ${qi + 1} at (${qx}, ${qy}) lies ${isInside ? "inside" : "outside"}: ${below} edge(s) below it.`,
            isInside ? 6 : 5,
            states,
            new Map([[`q-${qi}`, isInside ? "sorted" : "error"]]),
            { query: qi, slab: slabIndex + 1, edgesBelow: below, inside: isInside },
        );
    }

    yield emit(`Done: ${inside.filter(Boolean).length} of ${queries.length} queries lie inside the polygon.`, 7, new Map(), new Map(), { inside: inside.map((value) => (value ? 1 : 0)), queries: queries.length });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Draw a vertical line through every corner of a polygon. Between neighboring lines the polygon edges do not cross or swap places, so their top-to-bottom order is fixed. To locate a point, find which vertical strip it is in, compare its height with the ordered edges in that strip, and count how many edges lie below it. An odd count means the point is inside.",
        invariants: [
            "Within one slab the vertical ordering of crossing edges never changes.",
            "Every polygon edge that spans a slab appears in that slab's ordered list.",
            "A point is inside exactly when an odd number of edges lie below it in its slab.",
        ],
        correctness:
            "Vertical lines through vertices are the only x-coordinates where edges can begin, end, or overtake one another, so between consecutive lines the crossing set and its order are constant. For a point in a slab, a downward ray crosses exactly the edges stored below it; the even-odd rule says the point is inside precisely when that crossing count is odd, which is the standard point-in-polygon criterion.",
        complexityRationale:
            "Preprocessing sorts vertex x-coordinates and assigns each edge to every slab it spans, which takes O(n log n) time and O(n^2) space in the worst case. A query finds its slab in O(log n) and scans that slab's edge list, so query time is O(log n + k) for a slab holding k edges.",
        uses: [
            "Determining which face of a subdivision contains a point",
            "Hit testing in vector graphics and map renderers",
            "Preprocessing steps for trapezoidal maps and visibility",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 6",
            "Dobkin, Kirkpatrick, and Snoeyink, Computing Subdivisions and Point Location, 1990",
        ],
        workedExample:
            "For a pentagon with vertex x-coordinates 0, 3, and 6, two slabs are formed. A query at (2, 2) falls in the slab from 0 to 3, where exactly one edge lies below it, so the odd count marks it inside. A query at (7, 3) lies outside every slab's polygon coverage and has zero edges below it, marking it outside.",
    },
    id: "slab-method-point-location",
    name: "Slab Method Point Location",
    category: "geometry",
    complexity: { time: "O(log n + k) query", space: "O(n^2)" },
    defaultInput: {
        polygon: [[0, 0], [6, 0], [6, 5], [3, 7], [0, 5]],
        queries: [[2, 2], [5, 6], [3, 4], [7, 3]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "list the distinct vertex x-coordinates as slab boundaries",
        "for each slab collect edges spanning its full width",
        "sort a slab's edges by height at its mid x-coordinate",
        "for a query find the slab containing its x-coordinate",
        "count the slab edges whose height at the query x is below the point",
        "declare the point inside when that count is odd",
        "record the inside and outside verdict for every query",
        "done: report all point-location verdicts",
    ],
};

export default module;
