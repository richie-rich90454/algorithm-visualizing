/**
 * polygon-union.ts - Union of Two Polygons by Boundary Splicing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The union of two simple polygons is bounded by the parts of each boundary
 * that lie outside the other polygon. This module finds every proper edge
 * intersection, splits both boundaries at those points, discards each edge
 * segment lying inside the other polygon, and splices the surviving directed
 * segments end to end into one or more closed boundary cycles. The operation
 * is a union rather than an intersection, so it is distinct from the cataloged
 * Greiner-Hormann clipping module even though both split boundaries at crossings.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n*m + k) for n, m edges and k intersections
 *   Space: O(n + m + k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input vertices are GREEN (first polygon) and BLUE (second).
 *   - Crossings are highlighted; surviving boundary segments are the union
 *     outline drawn in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Intersection parameters of segments ab and cd, or null when parallel. */
function intersect(a: Point, b: Point, c: Point, d: Point): [number, number] | null {
    const r: Point = [b[0] - a[0], b[1] - a[1]];
    const s: Point = [d[0] - c[0], d[1] - c[1]];
    const denom = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(denom) < 1e-12) {
        return null;
    }
    const qp: Point = [c[0] - a[0], c[1] - a[1]];
    const t = (qp[0] * s[1] - qp[1] * s[0]) / denom;
    const u = (qp[0] * r[1] - qp[1] * r[0]) / denom;
    const eps = 1e-9;
    if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) {
        return null;
    }
    return [t, u];
}

/** Even-odd point-in-polygon test. */
function inside(p: Point, poly: Point[]): boolean {
    let result = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i] as Point;
        const b = poly[j] as Point;
        if ((a[1] > p[1]) !== (b[1] > p[1])) {
            const x = a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
            if (p[0] < x) {
                result = !result;
            }
        }
    }
    return result;
}

/** Key used to join boundary segments at shared endpoints. */
function key(p: Point): string {
    return `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
}

/** Twice the signed area of a polygon. */
function twiceArea(poly: Point[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Point;
        const b = poly[(i + 1) % poly.length] as Point;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum);
}

/** Split each polygon into directed edges, then keep only those outside the other. */
function union(a: Point[], b: Point[]): { boundary: Point[]; intersections: Point[]; cycles: number } {
    const hits: Array<{ ip: Point; ai: number; bi: number; t: number; u: number }> = [];
    for (let i = 0; i < a.length; i += 1) {
        const p = a[i] as Point;
        const q = a[(i + 1) % a.length] as Point;
        for (let j = 0; j < b.length; j += 1) {
            const r = b[j] as Point;
            const s = b[(j + 1) % b.length] as Point;
            const hit = intersect(p, q, r, s);
            if (!hit) {
                continue;
            }
            const t = hit[0];
            hits.push({ ip: [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])], ai: i, bi: j, t, u: hit[1] });
        }
    }
    const intersections = hits.map((h) => h.ip);

    type Edge = { from: Point; to: Point };
    const edges: Edge[] = [];
    const buildEdges = (poly: Point[], other: Point[], side: "a" | "b"): void => {
        for (let i = 0; i < poly.length; i += 1) {
            const start = poly[i] as Point;
            const end = poly[(i + 1) % poly.length] as Point;
            const onEdge = hits
                .filter((h) => (side === "a" ? h.ai === i : h.bi === i))
                .sort((x, y) => x.t - y.t);
            const points = [start, ...onEdge.map((h) => h.ip), end];
            for (let k = 0; k < points.length - 1; k += 1) {
                const from = points[k] as Point;
                const to = points[k + 1] as Point;
                const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
                if (!inside(mid, other)) {
                    edges.push({ from, to });
                }
            }
        }
    };
    buildEdges(a, b, "a");
    buildEdges(b, a, "b");

    const outgoing = new Map<string, number[]>();
    edges.forEach((edge, index) => {
        const k = key(edge.from);
        const list = outgoing.get(k) ?? [];
        list.push(index);
        outgoing.set(k, list);
    });

    const used = new Array<boolean>(edges.length).fill(false);
    const cycles: Point[][] = [];
    for (let start = 0; start < edges.length; start += 1) {
        if (used[start]) {
            continue;
        }
        const cycle: Point[] = [];
        let current = start;
        for (let guard = 0; guard <= edges.length; guard += 1) {
            const edge = edges[current] as Edge;
            used[current] = true;
            cycle.push(edge.from);
            const candidates = outgoing.get(key(edge.to)) ?? [];
            const next = candidates.find((index) => !used[index]);
            if (next === undefined) {
                break;
            }
            current = next;
            if (current === start) {
                break;
            }
        }
        if (cycle.length >= 3) {
            cycles.push(cycle);
        }
    }
    cycles.sort((x, y) => twiceArea(y) - twiceArea(x));
    return { boundary: cycles[0] ?? [], intersections, cycles: cycles.length };
}

function makeEntities(a: Point[], b: Point[], intersections: Point[], boundary: Point[]): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    a.forEach((p, i) => nodes.push({
        id: `a-${i}`, type: "node", label: "", value: p, state: "active",
        x: p[0], y: p[1], width: 0, height: 0, metadata: { role: "a", index: i },
    }));
    b.forEach((p, i) => nodes.push({
        id: `b-${i}`, type: "node", label: "", value: p, state: "sorted",
        x: p[0], y: p[1], width: 0, height: 0, metadata: { role: "b", index: i },
    }));
    intersections.forEach((p, i) => nodes.push({
        id: `x-${i}`, type: "node", label: "x", value: p, state: "highlight",
        x: p[0], y: p[1], width: 0, height: 0, metadata: { role: "intersection", index: i },
    }));
    boundary.forEach((p, i) => nodes.push({
        id: `o-${i}`, type: "node", label: "", value: p, state: "path",
        x: p[0], y: p[1], width: 0, height: 0, metadata: { role: "output", index: i },
    }));
    return nodes;
}

function makeEdges(a: Point[], b: Point[], boundary: Point[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const outline = (poly: Point[], prefix: string): void => {
        for (let i = 0; i < poly.length; i += 1) {
            edges.push({
                id: `${prefix}-${i}`,
                sourceId: `${prefix}-${i}`,
                targetId: `${prefix}-${(i + 1) % poly.length}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
    };
    outline(a, "a");
    outline(b, "b");
    for (let i = 0; i < boundary.length; i += 1) {
        edges.push({
            id: `o-${i}`,
            sourceId: `o-${i}`,
            targetId: `o-${(i + 1) % boundary.length}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: Point[]; b?: Point[] } | null) ?? {};
    const a: Point[] = (task.a ?? [[0, 0], [4, 0], [4, 4], [0, 4]]).map((p) => [p[0], p[1]] as Point);
    const b: Point[] = (task.b ?? [[2, 2], [6, 2], [6, 6], [2, 6]]).map((p) => [p[0], p[1]] as Point);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(a, b, [], []),
        edges: makeEdges(a, b, []),
        description: `Computing the union of a ${a.length}-vertex and a ${b.length}-vertex polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { phase: "start", intersections: 0 },
    };
    step += 1;

    const result = union(a, b);
    for (let i = 0; i < result.intersections.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeEntities(a, b, result.intersections.slice(0, i + 1), []),
            edges: makeEdges(a, b, []),
            description: `Crossing ${i + 1} of ${result.intersections.length}: split both boundaries at the shared point.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { intersections: i + 1, phase: "intersections" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(a, b, result.intersections, result.boundary),
        edges: makeEdges(a, b, result.boundary),
        description: result.boundary.length > 0
            ? `Union complete: the outer boundary has ${result.boundary.length} vertices across ${result.cycles} cycle(s).`
            : "The union is empty.",
        codeLineNumber: 6,
        layout: "point",
        meta: {
            intersections: result.intersections.length,
            area: twiceArea(result.boundary) / 2,
            boundary: JSON.stringify(result.boundary),
            cycles: result.cycles,
            complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The outline of a union is made of the pieces of each polygon's boundary that are not covered by the other polygon. Mark where the two boundaries cross, cut them at those points, and throw away every segment whose midpoint lies inside the other polygon. What remains is a set of directed segments that meet end to end; following them assembles the union outline.",
        invariants: [
            "Each proper intersection is inserted into both polygon boundaries at the same location.",
            "A surviving segment is entirely outside the other polygon because crossings are its only possible transitions.",
            "Every surviving segment is used at most once when assembling boundary cycles.",
        ],
        correctness:
            "Splitting at crossings makes each elementary segment lie wholly inside or wholly outside the other polygon, so a midpoint test classifies it correctly. The outside pieces of both boundaries together form the boundary of the union: any point just inside an outside segment belongs to one polygon and not the other interior, while discarded segments are internal to the union. Joining segments at shared endpoints therefore traces complete union cycles, and the largest cycle is the outer boundary of a connected union.",
        complexityRationale:
            "There are n times m edge pairs to test for intersection. Splitting and classifying each elementary segment is linear in the number of segments, which is n plus m plus twice the number of crossings. Assembling cycles uses one map lookup per segment, so the total is O(n*m + k) time and O(n + m + k) space.",
        uses: [
            "Merging overlapping shapes in vector graphics and geographic information systems",
            "Computing the footprint of combined regions in computer-aided design",
            "Preprocessing planar subdivisions for area and boundary queries",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
            "O'Rourke, Computational Geometry in C, Chapter 2",
        ],
        workedExample:
            "Taking the union of squares (0,0)-(4,0)-(4,4)-(0,4) and (2,2)-(6,2)-(6,6)-(2,6), the crossings are (4,2) and (2,4). The pieces of the first square inside the second and vice versa are discarded. The remaining segments join into an L-shaped eight-vertex outline whose area is 28, matching sixteen plus sixteen minus the four-unit overlap.",
    },
    id: "polygon-union",
    name: "Polygon Union",
    category: "geometry",
    complexity: { time: "O(n*m + k)", space: "O(n + m + k)" },
    defaultInput: {
        a: [[0, 0], [4, 0], [4, 4], [0, 4]],
        b: [[2, 2], [6, 2], [6, 6], [2, 6]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "test every edge pair of the two polygons for proper crossing",
        "split both boundaries at the discovered crossing points",
        "for each elementary segment, test its midpoint in the other polygon",
        "keep the segments whose midpoints lie outside the other polygon",
        "index the kept segments by their starting endpoints",
        "walk from one segment to its matching successor until a cycle closes",
        "choose the largest cycle as the outer union boundary",
        "done: report the union outline and its area",
    ],
};

export default module;
