/**
 * cdt-constrained-delaunay.ts - Constrained Delaunay Triangulation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A constrained Delaunay triangulation respects a set of mandatory edges:
 * every constraint either appears as a triangulation edge or is composed of
 * collinear edges. The module first builds an ordinary Delaunay triangulation
 * with Bowyer-Watson insertion, then forces each constraint by repeatedly
 * flipping the triangulation edges that cross it. Flipping a crossing edge of
 * a convex quadrilateral removes one crossing, so the loop terminates. The
 * result stays as close to Delaunay as the constraints allow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 + k * n) for n points and k constraint-induced flips
 *   Space: O(n) for the triangle and edge sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input points are POINT nodes at their true coordinates.
 *   - Triangulation edges are IDLE; constraint edges are HIGHLIGHT.
 *   - An edge about to be flipped is shown in ERROR for that frame.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Tri = [number, number, number];

function orient(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function orientTri(pts: Pt[], tri: Tri): Tri {
    return orient(pts[tri[0]]!, pts[tri[1]]!, pts[tri[2]]!) < 0
        ? [tri[0], tri[2], tri[1]]
        : tri;
}

/** Positive when p lies inside the circumcircle of counterclockwise a,b,c. */
function inCircle(a: Pt, b: Pt, c: Pt, p: Pt): number {
    const ax = a[0] - p[0];
    const ay = a[1] - p[1];
    const bx = b[0] - p[0];
    const by = b[1] - p[1];
    const cx = c[0] - p[0];
    const cy = c[1] - p[1];
    return ((ax * ax + ay * ay) * (bx * cy - cx * by)
        - (bx * bx + by * by) * (ax * cy - cx * ay)
        + (cx * cx + cy * cy) * (ax * by - bx * ay));
}

function edgeKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Bowyer-Watson Delaunay triangulation of the given points. */
function delaunay(points: Pt[]): Tri[] {
    const n = points.length;
    if (n < 3) return [];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const all: Pt[] = [
        ...points,
        [midX - 20 * span, midY - span],
        [midX, midY + 20 * span],
        [midX + 20 * span, midY - span],
    ];
    let tris: Tri[] = [orientTri(all, [n, n + 1, n + 2])];
    for (let i = 0; i < n; i += 1) {
        const bad = tris.filter((t) =>
            inCircle(all[t[0]]!, all[t[1]]!, all[t[2]]!, all[i]!) > 1e-9);
        if (bad.length === 0) continue;
        const counts = new Map<string, { a: number; b: number; count: number }>();
        for (const t of bad) {
            for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]] as Array<[number, number]>) {
                const key = edgeKey(a, b);
                const existing = counts.get(key);
                if (existing) {
                    existing.count += 1;
                } else {
                    counts.set(key, { a, b, count: 1 });
                }
            }
        }
        tris = tris.filter((t) => !bad.includes(t));
        for (const value of counts.values()) {
            if (value.count === 1) {
                tris.push(orientTri(all, [value.a, value.b, i]));
            }
        }
    }
    return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

function uniqueEdges(tris: Tri[]): Array<[number, number]> {
    const seen = new Map<string, [number, number]>();
    for (const t of tris) {
        for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]] as Array<[number, number]>) {
            seen.set(edgeKey(a, b), a < b ? [a, b] : [b, a]);
        }
    }
    return [...seen.values()];
}

/** True when closed segment ab properly crosses cd (endpoints strictly opposite). */
function crosses(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    const eps = 1e-9;
    if (Math.abs(o1) < eps || Math.abs(o2) < eps || Math.abs(o3) < eps || Math.abs(o4) < eps) return false;
    return o1 * o2 < 0 && o3 * o4 < 0;
}

function pointNode(p: Pt, i: number, state: EntityState): VisualEntity {
    return {
        id: `p-${i}`,
        type: "node",
        label: `p${i}`,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { x: p[0], y: p[1], index: i },
    };
}

function edgeEntity(a: number, b: number, state: EntityState): VisualEdge {
    return {
        id: `e-${edgeKey(a, b)}`,
        sourceId: `p-${a}`,
        targetId: `p-${b}`,
        label: "",
        state,
        directed: false,
    };
}

/** Build the Delaunay base, then flip crossing edges until constraints appear. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; constraints?: Array<[number, number]> } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [0, 0], [4, 0], [4, 3], [0, 1],
    ];
    const constraints: Array<[number, number]> = (task.constraints ?? [[0, 2]])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < points.length && b < points.length && a !== b);

    let step = 0;
    yield {
        stepNumber: step,
        entities: points.map((p, i) => pointNode(p, i, "idle")),
        edges: constraints.map(([a, b]) => edgeEntity(a, b, "highlight")),
        description: `Constrain ${constraints.length} mandatory edges in a triangulation of ${points.length} points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: points.length, constraints: constraints.length, flips: 0 },
    };
    step += 1;

    let tris = delaunay(points);
    yield {
        stepNumber: step,
        entities: points.map((p, i) => pointNode(p, i, "idle")),
        edges: [
            ...uniqueEdges(tris).map(([a, b]) => edgeEntity(a, b, "idle")),
            ...constraints.map(([a, b]) => edgeEntity(a, b, "highlight")),
        ],
        description: `Initial Delaunay triangulation has ${tris.length} triangles and ${uniqueEdges(tris).length} edges.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { n: points.length, triangles: tris.length, flips: 0 },
    };
    step += 1;

    const constraintKeys = new Set(constraints.map(([a, b]) => edgeKey(a, b)));
    let flips = 0;
    for (const [u, v] of constraints) {
        yield {
            stepNumber: step,
            entities: points.map((p, i) =>
                pointNode(p, i, i === u || i === v ? "highlight" : "idle")),
            edges: [
                ...uniqueEdges(tris).map(([a, b]) => edgeEntity(a, b, "idle")),
                ...constraints.map(([a, b]) => edgeEntity(a, b, "highlight")),
            ],
            description: `Force constraint (${u}, ${v}) by flipping edges that cross it.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n: points.length, constraint: [u, v], flips },
        };
        step += 1;

        for (let guard = 0; guard < 4 * points.length; guard += 1) {
            const crossing = uniqueEdges(tris).find(([a, b]) =>
                crosses(points[u]!, points[v]!, points[a]!, points[b]!));
            if (!crossing) break;
            const [a, b] = crossing;
            const adjacent = tris.filter((t) => t.includes(a) && t.includes(b));
            if (adjacent.length !== 2) break;
            const c = adjacent[0]!.find((x) => x !== a && x !== b);
            const d = adjacent[1]!.find((x) => x !== a && x !== b);
            if (c === undefined || d === undefined) break;
            const eps = 1e-9;
            const o1 = orient(points[a]!, points[c]!, points[b]!);
            const o2 = orient(points[c]!, points[b]!, points[d]!);
            const o3 = orient(points[b]!, points[d]!, points[a]!);
            const o4 = orient(points[d]!, points[a]!, points[c]!);
            const convex = (o1 > eps && o2 > eps && o3 > eps && o4 > eps)
                || (o1 < -eps && o2 < -eps && o3 < -eps && o4 < -eps);
            if (!convex) break;

            tris = tris.filter((t) => !adjacent.includes(t));
            tris.push(orientTri(points, [a, c, d]));
            tris.push(orientTri(points, [b, c, d]));
            flips += 1;
            yield {
                stepNumber: step,
                entities: points.map((p, i) =>
                    pointNode(p, i, i === a || i === b ? "error" : i === u || i === v ? "highlight" : "idle")),
                edges: [
                    ...uniqueEdges(tris).map(([x, y]) => edgeEntity(x, y, "idle")),
                    ...constraints.map(([x, y]) => edgeEntity(x, y, "highlight")),
                    edgeEntity(c, d, "path"),
                ],
                description: `Flip edge (${a}, ${b}) to (${c}, ${d}), removing one crossing of constraint (${u}, ${v}).`,
                codeLineNumber: 3,
                layout: "point",
                meta: { n: points.length, flipped: [a, b], added: [c, d], flips },
            };
            step += 1;
        }
    }

    const finalEdges = uniqueEdges(tris);
    const satisfied = constraints.every(([a, b]) => constraintKeys.has(edgeKey(a, b)) && finalEdges.some(([x, y]) => edgeKey(x, y) === edgeKey(a, b)));
    yield {
        stepNumber: step,
        entities: points.map((p, i) => pointNode(p, i, "path")),
        edges: [
            ...finalEdges.map(([a, b]) => edgeEntity(a, b, "idle")),
            ...constraints.map(([a, b]) => edgeEntity(a, b, "highlight")),
        ],
        description: satisfied
            ? `Constrained Delaunay triangulation complete with ${finalEdges.length} edges after ${flips} flip(s).`
            : `Triangulation complete but ${constraints.length - finalEdges.filter(([a, b]) => constraintKeys.has(edgeKey(a, b))).length} constraint(s) are not explicit edges.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            n: points.length,
            triangles: tris.length,
            edges: finalEdges.length,
            constraints: constraints.length,
            satisfied,
            flips,
        },
    };
}

/** The constrained Delaunay triangulation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An ordinary Delaunay triangulation maximizes angles everywhere, but it may omit an edge that the application requires, such as a road or a boundary of a region. A constrained Delaunay triangulation inserts those mandatory edges first in spirit by flipping any Delaunay diagonal that crosses them. Each flip of a convex quadrilateral removes exactly one crossing, and the constraints themselves are never crossed.",
        invariants: [
            "Every intermediate state is a valid triangulation of the same point set.",
            "A flip only replaces the diagonal of a convex quadrilateral, preserving coverage.",
            "The number of proper crossings between constraints and triangulation edges decreases with each flip.",
        ],
        correctness:
            "Bowyer-Watson produces a valid Delaunay triangulation by the empty circumcircle property. For a constraint edge, any triangulation edge that properly crosses it is the diagonal of a convex quadrilateral whose other diagonal lies along the constraint corridor; flipping replaces it and reduces the crossing count by one. Repeating until no crossing remains leaves the constraint as an edge. Since flips never cross a constraint, all constraints coexist, and the final mesh is Delaunay wherever constraints permit.",
        complexityRationale:
            "Bowyer-Watson inserts n points into a triangle list in expected O(n^2) with a naive search. Each scan of the edge set is O(n) and the number of flips is linear in the number of crossed edges, giving O(n^2 + k*n) total time. The triangle and edge sets are linear in n.",
        uses: [
            "Finite element meshes that must respect domain boundaries",
            "Terrain models with ridges and breaklines",
            "GIS networks where roads and rivers must be preserved",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
            "Chew, Constrained Delaunay Triangulations, Algorithmica, 1989",
        ],
        workedExample:
            "Four points form a convex quadrilateral whose Delaunay diagonal is (1,3). If (0,2) is declared a constraint, that diagonal crosses it. Flipping the single convex quadrilateral replaces (1,3) with (0,2), and the resulting two triangles form the constrained Delaunay triangulation.",
    },
    id: "cdt-constrained-delaunay",
    name: "Constrained Delaunay Triangulation",
    category: "geometry",
    complexity: { time: "O(n^2 + k*n)", space: "O(n)" },
    defaultInput: {
        points: [[0, 0], [4, 0], [4, 3], [0, 1]],
        constraints: [[0, 2]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "build an initial Delaunay triangulation with Bowyer-Watson",
        "for each constraint edge in the input list",
        "find a triangulation edge that properly crosses it",
        "identify the two triangles sharing that edge",
        "if their quadrilateral is convex, replace the crossing diagonal",
        "repeat until the constraint has no crossing",
        "done: report the triangulation and the satisfied constraints",
    ],
};

export default module;
