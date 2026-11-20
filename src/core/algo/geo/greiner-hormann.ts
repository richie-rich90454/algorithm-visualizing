/**
 * greiner-hormann.ts - Greiner-Hormann Polygon Clipping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Greiner-Hormann algorithm clips one simple polygon against another by
 * computing every edge-edge intersection, splitting both boundaries at those
 * points, and linking paired intersections with cross references. Traversal
 * then walks the subject boundary until an intersection is reached, hops to
 * the paired intersection on the clip boundary, and continues, alternating
 * polygons so the walk follows the region common to both. This computes the
 * polygon intersection (and, with the opposite entry rule, the union). It is
 * distinct from Sutherland-Hodgman, which clips against half-planes one at a
 * time and cannot preserve arbitrary concave clip boundaries.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n*m + k log k) for n, m edges and k intersections
 *   Space: O(n + m + k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Subject vertices are GREEN nodes; clip vertices are BLUE (sorted).
 *   - Intersection points are highlighted as the traversal discovers them.
 *   - The clipped output boundary is drawn as a path of edges.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type V = {
    p: Point;
    inter: boolean;
    neighbor: number;
    visited: boolean;
    inside: boolean;
    role: "subject" | "clip";
};

/** Where segments ab and cd meet, as parameters t on ab and u on cd. */
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
function insidePolygon(p: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i] as Point;
        const b = poly[j] as Point;
        if ((a[1] > p[1]) !== (b[1] > p[1])) {
            const x = a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
            if (p[0] < x) {
                inside = !inside;
            }
        }
    }
    return inside;
}

/** Build output entities for the two boundaries and the current result. */
function makeEntities(
    subject: Point[],
    clip: Point[],
    intersections: Point[],
    result: Point[],
): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    subject.forEach((p, i) => nodes.push({
        id: `s-${i}`,
        type: "node",
        label: "",
        value: p,
        state: "active",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { role: "subject", index: i },
    }));
    clip.forEach((p, i) => nodes.push({
        id: `c-${i}`,
        type: "node",
        label: "",
        value: p,
        state: "sorted",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { role: "clip", index: i },
    }));
    intersections.forEach((p, i) => nodes.push({
        id: `x-${i}`,
        type: "node",
        label: "x",
        value: p,
        state: "highlight",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { role: "intersection", index: i },
    }));
    result.forEach((p, i) => nodes.push({
        id: `o-${i}`,
        type: "node",
        label: "",
        value: p,
        state: "path",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { role: "output", index: i },
    }));
    return nodes;
}

/** Polygon outline edges, drawn idle, plus the result boundary highlighted. */
function makeEdges(subject: Point[], clip: Point[], result: Point[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const add = (poly: Point[], prefix: string, state: EntityState): void => {
        for (let i = 0; i < poly.length; i += 1) {
            edges.push({
                id: `${prefix}-${i}`,
                sourceId: prefix === "s" ? `s-${i}` : prefix === "c" ? `c-${i}` : `o-${i}`,
                targetId: prefix === "s" ? `s-${(i + 1) % poly.length}` : prefix === "c" ? `c-${(i + 1) % poly.length}` : `o-${(i + 1) % poly.length}`,
                label: "",
                state,
                directed: false,
            });
        }
    };
    add(subject, "s", "idle");
    add(clip, "c", "idle");
    if (result.length > 1) {
        add(result, "o", "path");
    }
    return edges;
}

/** Compute the intersection polygon of two simple polygons. */
function clipPolygons(subject: Point[], clip: Point[]): { result: Point[]; intersections: Point[] } {
    type Hit = { ip: Point; si: number; ci: number; t: number; u: number };
    const hits: Hit[] = [];
    for (let i = 0; i < subject.length; i += 1) {
        const a = subject[i] as Point;
        const b = subject[(i + 1) % subject.length] as Point;
        for (let j = 0; j < clip.length; j += 1) {
            const c = clip[j] as Point;
            const d = clip[(j + 1) % clip.length] as Point;
            const hit = intersect(a, b, c, d);
            if (!hit) {
                continue;
            }
            const t = hit[0];
            const ip: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
            hits.push({ ip, si: i, ci: j, t, u: hit[1] });
        }
    }
    const intersectionPoints = hits.map((h) => h.ip);

    const S: V[] = [];
    for (let i = 0; i < subject.length; i += 1) {
        S.push({ p: subject[i] as Point, inter: false, neighbor: -1, visited: false, inside: false, role: "subject" });
        const onEdge = hits.filter((h) => h.si === i).sort((x, y) => x.t - y.t);
        for (const h of onEdge) {
            S.push({ p: h.ip, inter: true, neighbor: -1, visited: false, inside: false, role: "subject" });
        }
    }
    const C: V[] = [];
    for (let j = 0; j < clip.length; j += 1) {
        C.push({ p: clip[j] as Point, inter: false, neighbor: -1, visited: false, inside: false, role: "clip" });
        const onEdge = hits.filter((h) => h.ci === j).sort((x, y) => (x.u - y.u) || (x.si - y.si));
        for (const h of onEdge) {
            C.push({ p: h.ip, inter: true, neighbor: -1, visited: false, inside: false, role: "clip" });
        }
    }
    for (const h of hits) {
        const si = S.findIndex((v) => v.inter && v.p === h.ip);
        const ci = C.findIndex((v) => v.inter && v.p === h.ip);
        if (si >= 0 && ci >= 0) {
            (S[si] as V).neighbor = ci;
            (C[ci] as V).neighbor = si;
        }
    }

    for (const v of S) {
        v.inside = insidePolygon(v.p, clip);
    }
    for (const v of C) {
        v.inside = insidePolygon(v.p, subject);
    }

    const result: Point[] = [];
    let start = -1;
    for (let i = 0; i < S.length; i += 1) {
        const v = S[i] as V;
        const prev = S[(i - 1 + S.length) % S.length] as V;
        if (v.inter && !prev.inside && v.inside) {
            start = i;
            break;
        }
    }
    if (start < 0) {
        return { result: [], intersections: intersectionPoints };
    }

    let poly: V[] = S;
    let other: V[] = C;
    let idx = start;
    const startVertex = S[start] as V;
    const limit = (S.length + C.length) * 2;

    for (let guard = 0; guard < limit; guard += 1) {
        const current = poly[idx] as V;
        current.visited = true;
        result.push(current.p);
        if (current !== startVertex && result.length > 1 && current.p[0] === startVertex.p[0] && current.p[1] === startVertex.p[1]) {
            break;
        }
        if (result.length > 1 && current === startVertex) {
            break;
        }
        const nextIndex = (idx + 1) % poly.length;
        const next = poly[nextIndex] as V;
        if (next.inter && next.neighbor >= 0) {
            const swap = poly;
            poly = other;
            other = swap;
            idx = next.neighbor;
        } else {
            idx = nextIndex;
        }
        if (idx === start && poly === S && result.length > 1) {
            break;
        }
    }

    return { result, intersections: intersectionPoints };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { subject?: Point[]; clip?: Point[] } | null) ?? {};
    const subject: Point[] = (task.subject ?? [[0, 0], [4, 0], [4, 4], [0, 4]]).map((p) => [p[0], p[1]] as Point);
    const clip: Point[] = (task.clip ?? [[2, 2], [6, 2], [6, 6], [2, 6]]).map((p) => [p[0], p[1]] as Point);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(subject, clip, [], []),
        edges: makeEdges(subject, clip, []),
        description: `Clipping a ${subject.length}-edge subject against a ${clip.length}-edge clip polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { intersections: 0, phase: "start" },
    };
    step += 1;

    const { result, intersections } = clipPolygons(subject, clip);
    for (let i = 0; i < intersections.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeEntities(subject, clip, intersections.slice(0, i + 1), []),
            edges: makeEdges(subject, clip, []),
            description: `Found edge intersection ${i + 1} of ${intersections.length}; split both boundaries.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { intersections: i + 1, phase: "intersections" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(subject, clip, intersections, result),
        edges: makeEdges(subject, clip, result),
        description: result.length > 0
            ? `Clip complete: the intersection polygon has ${result.length} vertices.`
            : "The polygons do not overlap; the intersection is empty.",
        codeLineNumber: 6,
        layout: "point",
        meta: { intersections: intersections.length, outputVertices: result.length, complete: true, output: JSON.stringify(result) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Clip one polygon against another by first marking every place where their boundaries cross. At each crossing, split both edges and remember which point on one polygon pairs with the point on the other. Then start where the subject enters the clip region and walk: follow the current boundary until a crossing, jump to the paired crossing on the other boundary, and keep going. The walk traces exactly the common region.",
        invariants: [
            "Every intersection is inserted into both boundary lists at the same geometric point.",
            "Cross references pair each subject intersection with exactly one clip intersection.",
            "A vertex is inside the other polygon exactly when it lies in the region being clipped.",
        ],
        correctness:
            "Between crossings a boundary segment lies entirely inside or entirely outside the other polygon, so classifying one point decides the whole segment. The entry crossing is where the subject goes from outside to inside. Following subject edges while inside and clip edges while outside keeps the walk on the boundary of the common region; because the paired crossings are shared endpoints, the walk closes into a simple cycle whose interior is precisely the polygon intersection.",
        complexityRationale:
            "Testing all n by m edge pairs for intersections costs O(n*m). Splitting edges and sorting the k intersection positions adds O(k log k). The final traversal visits each of the n plus m plus 2k vertices at most once, so the total space and traversal time are linear in the augmented boundary size.",
        uses: [
            "Boolean operations in computer-aided design and vector graphics editors",
            "Computing overlaps of geographic polygons in geographic information systems",
            "Visibility and shadow computation in 2D game engines",
        ],
        references: [
            "Greiner and Hormann, Efficient Clipping of Arbitrary Polygons, 1998",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
        ],
        workedExample:
            "Clipping the square (0,0)-(4,0)-(4,4)-(0,4) against the square (2,2)-(6,2)-(6,6)-(2,6) yields intersections (4,2) and (2,4). Starting at (4,2), the walk follows the subject to (2,4), jumps to the clip boundary, and closes at (4,2), producing the four-vertex intersection square of area four.",
    },
    id: "greiner-hormann",
    name: "Greiner-Hormann Polygon Clipping",
    category: "geometry",
    complexity: { time: "O(n*m + k log k)", space: "O(n + m + k)" },
    defaultInput: {
        subject: [[0, 0], [4, 0], [4, 4], [0, 4]],
        clip: [[2, 2], [6, 2], [6, 6], [2, 6]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "for every subject edge and every clip edge",
        "compute their proper intersection and split both boundaries there",
        "link each pair of matching intersections with cross references",
        "classify every vertex as inside or outside the other polygon",
        "start where the subject boundary enters the clip polygon",
        "walk forward until an intersection is reached",
        "hop to the paired intersection on the other boundary and continue",
        "stop on returning to the start and report the clipped polygon",
    ],
};

export default module;
