/**
 * delaunay-edge-flip.ts - Lawson's edge-flip Delaunay triangulation.
 *
 * First an arbitrary triangulation of the sites is built by incremental
 * insertion. Then every interior edge shared by two triangles is tested with
 * the in-circle predicate: if the opposite vertex lies inside the other
 * triangle's circumcircle the edge is illegal and is flipped to the other
 * diagonal of the quadrilateral. Flipping strictly improves the triangulation
 * and terminates at the Delaunay triangulation.
 *
 * Time: O(n^2) flips worst case for n sites with brute-force adjacency scans.
 * Space: O(n) for the triangles and hull.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Tri = [number, number, number];
type Edge = [number, number];

function orient(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    // Valid when a, b, c are counter-clockwise.
    const ax = a[0] - d[0];
    const ay = a[1] - d[1];
    const bx = b[0] - d[0];
    const by = b[1] - d[1];
    const cx = c[0] - d[0];
    const cy = c[1] - d[1];
    const det =
        (ax * ax + ay * ay) * (bx * cy - cx * by) -
        (bx * bx + by * by) * (ax * cy - cx * ay) +
        (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 1e-10;
}

function key(u: number, v: number): string {
    return `${Math.min(u, v)}-${Math.max(u, v)}`;
}

function makeTri(a: number, b: number, c: number, pts: Pt[]): Tri {
    return orient(pts[a] as Pt, pts[b] as Pt, pts[c] as Pt) >= 0 ? [a, b, c] : [a, c, b];
}

function inTriangle(p: Pt, tri: Tri, pts: Pt[]): boolean {
    const a = pts[tri[0]] as Pt;
    const b = pts[tri[1]] as Pt;
    const c = pts[tri[2]] as Pt;
    return (
        orient(a, b, p) >= -1e-9 &&
        orient(b, c, p) >= -1e-9 &&
        orient(c, a, p) >= -1e-9
    );
}

function initialTriangulation(pts: Pt[]): { triangles: Tri[]; steps: number } {
    if (pts.length < 3) return { triangles: [], steps: 0 };
    let seed: Tri | null = null;
    for (let i = 0; i < pts.length && !seed; i += 1) {
        for (let j = i + 1; j < pts.length && !seed; j += 1) {
            for (let k = j + 1; k < pts.length; k += 1) {
                if (Math.abs(orient(pts[i] as Pt, pts[j] as Pt, pts[k] as Pt)) > 1e-9) {
                    seed = [i, j, k];
                    break;
                }
            }
        }
    }
    if (!seed) return { triangles: [], steps: 0 };
    const triangles: Tri[] = [makeTri(seed[0], seed[1], seed[2], pts)];
    let hull: number[] = triangles[0] as number[];
    let steps = 0;

    for (let p = 0; p < pts.length; p += 1) {
        if (seed.includes(p)) continue;
        const containing = triangles.findIndex((tri) => inTriangle(pts[p] as Pt, tri, pts));
        if (containing >= 0) {
            const tri = triangles[containing] as Tri;
            triangles.splice(containing, 1);
            triangles.push(makeTri(p, tri[1], tri[2], pts));
            triangles.push(makeTri(tri[0], p, tri[2], pts));
            triangles.push(makeTri(tri[0], tri[1], p, pts));
        } else {
            const m = hull.length;
            let s = -1;
            let e = -1;
            for (let start = 0; start < m; start += 1) {
                const u = hull[start] as number;
                const v = hull[(start + 1) % m] as number;
                const visible = orient(pts[u] as Pt, pts[v] as Pt, pts[p] as Pt) < 0;
                if (!visible) continue;
                let end = start;
                while (
                    end < start + m - 1 &&
                    orient(
                        pts[hull[(end + 1) % m] as number] as Pt,
                        pts[hull[(end + 2) % m] as number] as Pt,
                        pts[p] as Pt,
                    ) < 0
                ) {
                    end += 1;
                }
                if (s === -1 || end - start > e - s) {
                    s = start;
                    e = end;
                }
            }
            if (s !== -1 && e !== -1) {
                const A = hull[s % m] as number;
                const B = hull[(e + 1) % m] as number;
                for (let t = s; t <= e; t += 1) {
                    triangles.push(makeTri(hull[t % m] as number, hull[(t + 1) % m] as number, p, pts));
                }
                const newHull: number[] = [A, p];
                for (let t = e + 1; t < s + m; t += 1) newHull.push(hull[t % m] as number);
                hull = newHull;
            }
        }
        steps += 1;
    }
    return { triangles, steps };
}

function findIllegal(triangles: Tri[], pts: Pt[]): { edgeIndex: number; triA: number; triB: number; u: number; v: number; w: number; z: number } | null {
    const map = new Map<string, number[]>();
    triangles.forEach((tri, index) => {
        for (const [u, v] of [
            [tri[0], tri[1]],
            [tri[1], tri[2]],
            [tri[2], tri[0]],
        ] as Edge[]) {
            const k = key(u, v);
            const list = map.get(k) ?? [];
            list.push(index);
            map.set(k, list);
        }
    });
    for (const [k, owners] of map) {
        if (owners.length !== 2) continue;
        const [u, v] = k.split("-").map(Number) as [number, number];
        const triA = owners[0] as number;
        const triB = owners[1] as number;
        const ta = triangles[triA] as Tri;
        const tb = triangles[triB] as Tri;
        const w = ta.find((x) => x !== u && x !== v) as number;
        const z = tb.find((x) => x !== u && x !== v) as number;
        // Flipping is only legal when the two triangles form a convex quad.
        if (orient(pts[w] as Pt, pts[z] as Pt, pts[u] as Pt) * orient(pts[w] as Pt, pts[z] as Pt, pts[v] as Pt) >= 0) {
            continue;
        }
        if (
            inCircle(
                pts[ta[0] as number] as Pt,
                pts[ta[1] as number] as Pt,
                pts[ta[2] as number] as Pt,
                pts[z] as Pt,
            )
        ) {
            return { edgeIndex: -1, triA, triB, u, v, w, z };
        }
    }
    return null;
}

function flip(triangles: Tri[], illegal: NonNullable<ReturnType<typeof findIllegal>>, pts: Pt[]): void {
    const { triA, triB, u, v, w, z } = illegal;
    const high = Math.max(triA, triB);
    const low = Math.min(triA, triB);
    triangles.splice(high, 1);
    triangles.splice(low, 1);
    triangles.push(makeTri(w, z, u, pts));
    triangles.push(makeTri(w, z, v, pts));
}

function triangleEdges(triangles: Tri[]): Edge[] {
    const seen = new Set<string>();
    const edges: Edge[] = [];
    for (const tri of triangles) {
        for (const [u, v] of [
            [tri[0], tri[1]],
            [tri[1], tri[2]],
            [tri[2], tri[0]],
        ] as Edge[]) {
            const k = key(u, v);
            if (seen.has(k)) continue;
            seen.add(k);
            edges.push([u < v ? u : v, u < v ? v : u]);
        }
    }
    return edges;
}

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4.3, 3],
        [0.2, 3.2],
        [1.6, 1.4],
    ];
    let step = 0;
    const entities = (states: Map<number, EntityState>) =>
        pts.map((p, i) => node(`p-${i}`, p, states.get(i) ?? "unvisited", String(i)));
    const edgesFor = (triangles: Tri[], highlight: Edge | null): VisualEdge[] =>
        triangleEdges(triangles).map(([u, v]) => ({
            id: `e-${u}-${v}`,
            sourceId: `p-${u}`,
            targetId: `p-${v}`,
            label: "",
            state: highlight && highlight[0] === u && highlight[1] === v ? ("active" as EntityState) : ("path" as EntityState),
            directed: false,
        }));

    yield {
        stepNumber: step,
        entities: entities(new Map()),
        edges: [],
        description: `Starting Lawson edge flips on ${pts.length} sites.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { triangles: [], flips: 0 },
    };
    step += 1;

    if (pts.length < 3) {
        yield {
            stepNumber: step,
            entities: entities(new Map()),
            edges: [],
            description: "Fewer than three sites cannot form a triangle.",
            codeLineNumber: 7,
            layout: "point",
            meta: { triangles: [], flips: 0 },
        };
        return;
    }

    const initial = initialTriangulation(pts);
    yield {
        stepNumber: step,
        entities: entities(new Map()),
        edges: edgesFor(initial.triangles, null),
        description: `Built an arbitrary triangulation with ${initial.triangles.length} triangle(s).`,
        codeLineNumber: 1,
        layout: "point",
        meta: { triangles: initial.triangles.flat(), flips: 0 },
    };
    step += 1;

    let flips = 0;
    for (let guard = 0; guard < 500; guard += 1) {
        const illegal = findIllegal(initial.triangles, pts);
        if (!illegal) break;
        const highlight: Edge = [Math.min(illegal.u, illegal.v), Math.max(illegal.u, illegal.v)];
        yield {
            stepNumber: step,
            entities: entities(new Map([[illegal.z, "highlight" as EntityState]])),
            edges: edgesFor(initial.triangles, highlight),
            description: `Flip ${flips + 1}: edge ${illegal.u}-${illegal.v} violates the in-circle test.`,
            codeLineNumber: 4,
            layout: "point",
            meta: { triangles: initial.triangles.flat(), flips, flipEdge: highlight },
        };
        step += 1;
        flip(initial.triangles, illegal, pts);
        flips += 1;
    }

    yield {
        stepNumber: step,
        entities: entities(new Map(pts.map((_, i) => [i, "sorted" as EntityState]))),
        edges: edgesFor(initial.triangles, null),
        description: `Done: Delaunay triangulation after ${flips} flip(s).`,
        codeLineNumber: 7,
        layout: "point",
        meta: { triangles: initial.triangles.flat(), flips },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Any triangulation of a point set can be improved locally. If two triangles sharing an edge have opposite corners that lie inside each other's circumcircles, swapping the shared diagonal makes the pair more Delaunay. Lawson's algorithm keeps flipping such illegal edges until none remain, and the result is the Delaunay triangulation.",
        invariants: [
            "Every flip replaces one diagonal of a convex quadrilateral with the other.",
            "The triangle count and covered domain stay unchanged after a flip.",
            "An edge is illegal only when the opposite vertex is strictly inside the adjacent circumcircle.",
        ],
        correctness:
            "For a convex quadrilateral, exactly one of the two diagonals is Delaunay. Flipping an illegal edge raises the minimum angle of the affected triangles, a quantity that can improve only finitely many times on a fixed point set, so the process terminates. At termination no interior edge is illegal, which is exactly the empty-circumcircle condition characterizing a Delaunay triangulation.",
        complexityRationale:
            "Each flip scans all edges to find an illegal one and rebuilds adjacency, costing O(n) for a constant-size triangulation, and up to O(n^2) flips occur in the worst case. The triangle and hull lists use O(n) space.",
        uses: [
            "Producing well-shaped meshes for finite element analysis",
            "Building terrain and interpolation meshes in geographic systems",
            "Computing the dual Voronoi diagram of a site set",
        ],
        references: [
            "Lawson, Generation of a Triangulation with Prescribed Boundary, Computational Geometry, 1986",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
        ],
        workedExample:
            "Four sites forming a square plus its center start as a fan of skinny triangles. The edge from the center toward a corner is illegal because the opposite center-adjacent vertex falls inside the circumcircle; flipping it widens the triangles and the process ends with the Delaunay mesh.",
    },
    id: "delaunay-edge-flip",
    name: "Delaunay Edge Flip",
    category: "geometry",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4.3, 3],
            [0.2, 3.2],
            [1.6, 1.4],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "build an arbitrary triangulation of the sites",
        "for every interior edge shared by two triangles",
        "test the opposite vertex against the other circumcircle",
        "if it lies inside, mark the edge illegal",
        "replace the shared diagonal with the other diagonal",
        "repeat until no illegal edge remains",
        "collect the final triangle list",
        "done: return the Delaunay triangulation",
    ],
};

export default module;
