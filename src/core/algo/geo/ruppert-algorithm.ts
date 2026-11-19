/**
 * ruppert-algorithm.ts - Ruppert Delaunay Refinement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Improves a Delaunay triangulation by repeatedly splitting its worst-shaped
 * triangle. The circumcenter of the skinniest triangle is inserted as a Steiner
 * point and the triangulation is rebuilt, which removes that triangle and
 * raises the smallest angle nearby. The process stops when every triangle meets
 * the requested minimum-angle bound or a step budget is exhausted. This is
 * distinct from plain Delaunay triangulation: the output contains extra points
 * chosen specifically to improve mesh quality, which is the heart of
 * Delaunay-refinement mesh generation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * n^2) for k insertions with a brute-force incremental rebuild
 *   Space: O(n) for the point set and triangulation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original input points are ACTIVE nodes; inserted points are SORTED nodes.
 *   - The circumcenter awaiting insertion is a HIGHLIGHT node.
 *   - Current triangulation edges are drawn between point nodes.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Tri = [number, number, number];

function orient(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function inCircle(a: Pt, b: Pt, c: Pt, p: Pt): boolean {
    const ax = a[0] - p[0];
    const ay = a[1] - p[1];
    const bx = b[0] - p[0];
    const by = b[1] - p[1];
    const cx = c[0] - p[0];
    const cy = c[1] - p[1];
    const det =
        (ax * ax + ay * ay) * (bx * cy - cx * by) -
        (bx * bx + by * by) * (ax * cy - cx * ay) +
        (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 1e-12;
}

function mkTri(i: number, j: number, k: number, pts: Pt[]): Tri {
    const a = pts[i] as Pt;
    const b = pts[j] as Pt;
    const c = pts[k] as Pt;
    return orient(a, b, c) >= 0 ? [i, j, k] : [i, k, j];
}

/** Bowyer-Watson Delaunay triangulation of a point set. */
function triangulate(pts: Pt[]): Tri[] {
    const n = pts.length;
    if (n < 3) {
        return [];
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const delta = Math.max(maxX - minX, maxY - minY, 1) * 20;
    const work: Pt[] = pts.concat([
        [cx - 20 * delta, cy - delta],
        [cx, cy + 20 * delta],
        [cx + 20 * delta, cy - delta],
    ]);
    let tris: Tri[] = [mkTri(n, n + 1, n + 2, work)];

    for (let p = 0; p < n; p += 1) {
        const point = pts[p] as Pt;
        const bad = tris.filter((t) => inCircle(work[t[0]] as Pt, work[t[1]] as Pt, work[t[2]] as Pt, point));
        const counts = new Map<string, { u: number; v: number; count: number }>();
        for (const t of bad) {
            const edges: Array<[number, number]> = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
            for (const [u, v] of edges) {
                const key = u < v ? `${u}-${v}` : `${v}-${u}`;
                const stored = counts.get(key);
                if (stored) {
                    stored.count += 1;
                } else {
                    counts.set(key, { u, v, count: 1 });
                }
            }
        }
        const badSet = new Set(bad);
        tris = tris.filter((t) => !badSet.has(t));
        for (const entry of counts.values()) {
            if (entry.count === 1) {
                tris.push(mkTri(entry.u, entry.v, p, work));
            }
        }
    }
    return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

function circumcenter(a: Pt, b: Pt, c: Pt): Pt | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) {
        return null;
    }
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    return [
        (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
        (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
    ];
}

function minAngleDeg(t: Tri, pts: Pt[]): number {
    const a = pts[t[0]] as Pt;
    const b = pts[t[1]] as Pt;
    const c = pts[t[2]] as Pt;
    const side = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const la = side(b, c);
    const lb = side(a, c);
    const lc = side(a, b);
    if (la * lb * lc < 1e-12) {
        return 0;
    }
    const angle = (x: number, y: number, z: number) =>
        (Math.acos(Math.max(-1, Math.min(1, (y * y + z * z - x * x) / (2 * y * z)))) * 180) / Math.PI;
    return Math.min(angle(la, lb, lc), angle(lb, la, lc), angle(lc, la, lb));
}

function edgesOf(tris: Tri[]): Array<[number, number]> {
    const seen = new Set<string>();
    const out: Array<[number, number]> = [];
    for (const t of tris) {
        const edges: Array<[number, number]> = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
        for (const [u, v] of edges) {
            const key = u < v ? `${u}-${v}` : `${v}-${u}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push([u, v]);
            }
        }
    }
    return out;
}

function makeEntities(pts: Pt[], seedCount: number, edges: Array<[number, number]>, candidate: Pt | null): VisualEntity[] {
    const out: VisualEntity[] = pts.map((p, i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: i < seedCount ? `s${i}` : `x${i - seedCount}`,
        value: p,
        state: (i < seedCount ? "active" : "sorted") as EntityState,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { index: i, seed: i < seedCount },
    }));
    if (candidate) {
        out.push({
            id: "candidate",
            type: "node" as const,
            label: "c",
            value: candidate,
            state: "highlight",
            x: candidate[0],
            y: candidate[1],
            width: 0,
            height: 0,
            metadata: { index: -1, seed: false, role: "circumcenter" },
        });
    }
    return out;
}

function makeEdges(edges: Array<[number, number]>, candidate: Pt | null): VisualEdge[] {
    const out: VisualEdge[] = edges.map(([u, v], i) => ({
        id: `e-${i}`,
        sourceId: `p-${u}`,
        targetId: `p-${v}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    if (candidate) {
        out.push({ id: "candidate-edge", sourceId: "candidate", targetId: "p-0", label: "", state: "highlight", directed: false });
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; minAngle?: number; maxIterations?: number } | null) ?? {};
    const seed: Pt[] = (task.points ?? [
        [0, 0], [10, 0], [10, 10], [0, 10], [5, 1],
    ]).map((p) => [p[0], p[1]] as Pt);
    const target = typeof task.minAngle === "number" ? Math.max(5, Math.min(40, task.minAngle)) : 25;
    const budget = typeof task.maxIterations === "number" ? Math.max(1, Math.trunc(task.maxIterations)) : 24;
    const seedCount = seed.length;
    const pts = seed.slice();

    if (seedCount < 3) {
        yield {
            stepNumber: 0,
            entities: makeEntities(pts, seedCount, [], null),
            edges: [],
            description: "At least three seed points are needed to form a triangle for refinement.",
            codeLineNumber: 0,
            layout: "point",
            meta: { seedPoints: seedCount, steinerPoints: 0, triangles: 0, minAngleDeg: 0, iterations: 0, converged: false, flatTriangles: [] },
        };
        return;
    }

    let tris = triangulate(pts);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(pts, seedCount, edgesOf(tris), null),
        edges: makeEdges(edgesOf(tris), null),
        description: `Initial Delaunay triangulation of ${seedCount} seed point(s) has ${tris.length} triangle(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seedPoints: seedCount, steinerPoints: 0, triangles: tris.length, minAngleDeg: 0, iterations: 0, converged: false, flatTriangles: tris.flat() },
    };
    step += 1;

    const skipped = new Set<string>();
    let iterations = 0;
    let worstAngle = 0;

    for (; iterations < budget && tris.length > 0; iterations += 1) {
        let worstIndex = -1;
        let worst = Infinity;
        for (let i = 0; i < tris.length; i += 1) {
            const t = tris[i] as Tri;
            const key = t.join("-");
            if (skipped.has(key)) {
                continue;
            }
            const ang = minAngleDeg(t, pts);
            if (ang < worst) {
                worst = ang;
                worstIndex = i;
            }
        }
        worstAngle = worstIndex < 0 ? target : worst;
        if (worstIndex < 0 || worst >= target - 1e-6) {
            break;
        }
        const targetTri = tris[worstIndex] as Tri;
        const pa = pts[targetTri[0]] as Pt;
        const pb = pts[targetTri[1]] as Pt;
        const pc = pts[targetTri[2]] as Pt;
        const center = circumcenter(pa, pb, pc);
        const tooClose = (p: Pt | null): boolean =>
            !!p && pts.some((existing) => Math.hypot(existing[0] - p[0], existing[1] - p[1]) < 1e-4);
        const inDomain = (p: Pt | null): boolean => !!p && p[0] >= 0 && p[0] <= 10 && p[1] >= 0 && p[1] <= 10;

        let insert: Pt | null = null;
        let method = "circumcenter";
        if (center && inDomain(center) && !tooClose(center)) {
            insert = center;
        } else {
            // When the circumcenter falls outside the domain, split the longest edge instead.
            const edges: Array<[Pt, Pt]> = [[pa, pb], [pb, pc], [pc, pa]];
            edges.sort((u, v) =>
                Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]) -
                Math.hypot(u[0][0] - u[1][0], u[0][1] - u[1][1]),
            );
            const longest = edges[0] as [Pt, Pt];
            const mid: Pt = [(longest[0][0] + longest[1][0]) / 2, (longest[0][1] + longest[1][1]) / 2];
            if (inDomain(mid) && !tooClose(mid)) {
                insert = mid;
                method = "longest-edge midpoint";
            }
        }

        if (!insert) {
            skipped.add(targetTri.join("-"));
            yield {
                stepNumber: step,
                entities: makeEntities(pts, seedCount, edgesOf(tris), null),
                edges: makeEdges(edgesOf(tris), null),
                description: `Worst triangle has minimum angle ${worst.toFixed(1)} degrees, but no usable split point exists; skip this triangle.`,
                codeLineNumber: 2,
                layout: "point",
                meta: { seedPoints: seedCount, steinerPoints: pts.length - seedCount, triangles: tris.length, minAngleDeg: worst, iterations: iterations + 1, converged: false, flatTriangles: tris.flat() },
            };
            step += 1;
            continue;
        }

        pts.push(insert);
        tris = triangulate(pts);
        yield {
            stepNumber: step,
            entities: makeEntities(pts, seedCount, edgesOf(tris), null),
            edges: makeEdges(edgesOf(tris), null),
            description: `Inserted ${method} (${insert[0].toFixed(2)}, ${insert[1].toFixed(2)}); mesh now has ${pts.length - seedCount} Steiner point(s) and ${tris.length} triangle(s).`,
            codeLineNumber: 3,
            layout: "point",
            meta: { seedPoints: seedCount, steinerPoints: pts.length - seedCount, triangles: tris.length, minAngleDeg: worst, iterations: iterations + 1, converged: false, flatTriangles: tris.flat() },
        };
        step += 1;
    }

    let finalMin = Infinity;
    for (const t of tris) {
        finalMin = Math.min(finalMin, minAngleDeg(t, pts));
    }
    if (!Number.isFinite(finalMin)) {
        finalMin = 0;
    }
    const converged = finalMin >= target - 1e-6;
    yield {
        stepNumber: step,
        entities: makeEntities(pts, seedCount, edgesOf(tris), null),
        edges: makeEdges(edgesOf(tris), null),
        description: converged
            ? `Done: all ${tris.length} triangles meet the ${target} degree bound after ${iterations} insertion(s).`
            : `Done: smallest angle is ${finalMin.toFixed(1)} degrees after ${iterations} insertion(s) within the step budget.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            seedPoints: seedCount,
            steinerPoints: pts.length - seedCount,
            triangles: tris.length,
            minAngleDeg: finalMin,
            iterations,
            converged,
            flatTriangles: tris.flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A skinny triangle makes a poor mesh cell, so find the worst one and put a new vertex at the center of its circumcircle. Rebuilding the Delaunay triangulation replaces that bad cell with several better shaped ones. Repeating the operation is like chipping away at every thin sliver until the mesh is comfortable to work with.",
        invariants: [
            "After every insertion the triangulation is Delaunay: no point lies strictly inside a triangle's circumcircle.",
            "Each insertion removes the triangle with the smallest angle from the current mesh.",
            "Inserted Steiner points are distinct from all existing points and lie inside the domain.",
        ],
        correctness:
            "Bowyer-Watson removes exactly the triangles whose circumcircles contain the new point and retriangulates the resulting cavity, which restores the empty-circumcircle property, so the mesh is Delaunay after each step. Inserting the circumcenter of a triangle splits it into three triangles whose angles are all larger than the original smallest angle; when that center lies outside the domain, splitting the longest edge removes the triangle's smallest angle instead. The rebuild legalizes neighboring triangles, and the duplicate-point guard guarantees progress. Termination follows from the finite step budget.",
        complexityRationale:
            "Each iteration rebuilds the whole triangulation, taking O(n^2) time with the brute-force Bowyer-Watson cavity search for n current points. With k insertions the total is O(k*n^2) time. The point array, triangles, and skipped set use O(n) space.",
        uses: [
            "Finite element mesh generation for engineering simulation",
            "Adaptive refinement in computer graphics and terrain modeling",
            "Guaranteed-quality triangulations for interpolation and surface reconstruction",
        ],
        references: [
            "Ruppert, A Delaunay Refinement Algorithm for Quality 2-Dimensional Mesh Generation, 1995",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
        ],
        workedExample:
            "Start with the square (0,0)-(10,0)-(10,10)-(0,10) and a point (5,1) near the bottom edge, giving a thin triangle with an angle near 11 degrees. Its circumcenter lies below the square, so the long bottom edge is split at (5,0) instead. Rebuilding widens the sliver, and repeating lays a chain of Steiner points along the bottom edge; a production implementation also splits encroached boundary segments to guarantee the global angle bound.",
    },
    id: "ruppert-algorithm",
    name: "Ruppert Delaunay Refinement",
    category: "geometry",
    complexity: { time: "O(k*n^2)", space: "O(n)" },
    defaultInput: { points: [[0, 0], [10, 0], [10, 10], [0, 10], [5, 1]], minAngle: 25, maxIterations: 24 },
    visualType: "point",
    run,
    pseudocode: [
        "build the initial Delaunay triangulation of the seed points",
        "repeat until the angle bound holds or the step budget runs out",
        "find the triangle with the smallest minimum angle",
        "if its circumcenter is inside the domain and new, insert it; otherwise split its longest edge",
        "rebuild the Delaunay triangulation around the new point",
        "otherwise skip this triangle and try the next worst one",
        "done: report the refined mesh and its smallest angle",
    ],
};

export default module;
