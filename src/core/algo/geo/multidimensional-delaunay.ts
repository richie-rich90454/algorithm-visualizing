/**
 * multidimensional-delaunay.ts - Delaunay Triangulation in Arbitrary Dimension
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given n points in d dimensions, this builds the Delaunay triangulation: the
 * decomposition into d-simplices whose circumspheres contain no other input
 * point in their interior. The same incremental Bowyer-Watson construction
 * works for any fixed d: surround the points with one large super-simplex, then
 * insert points one at a time, delete the simplices whose circumsphere swallows
 * the new point, and seal the resulting cavity with fresh simplices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(1 + ceil(d/2))) expected for fixed dimension d
 *   Space: O(n^ceil(d/2)) simplices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input points are nodes, positioned by their first two coordinates.
 *   - Each d-simplex contributes an edge between every pair of its vertices.
 *   - The current point is RED, inserted points GREEN, the rest idle.
 *   - Edges of newly created simplices glow ACTIVE for one step.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];
type Simplex = number[];

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function solveLinear(rows: number[][], rhs: number[]): Vec | null {
    const n = rhs.length;
    const m = rows.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) {
            return null;
        }
        const tmp = m[col] as number[];
        m[col] = m[pivot] as number[];
        m[pivot] = tmp;
        const pv = m[col][col] as number;
        for (let c = col; c <= n; c += 1) {
            m[col][c] = (m[col][c] as number) / pv;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = m[r]?.[col] ?? 0;
            if (factor === 0) {
                continue;
            }
            for (let c = col; c <= n; c += 1) {
                m[r][c] = (m[r][c] as number) - factor * (m[col][c] as number);
            }
        }
    }
    return m.map((row) => row[n] as number);
}

/** Circumcenter and squared radius of a simplex, or null when it is degenerate. */
function circumcircle(pts: Vec[], simplex: Simplex): { center: Vec; r2: number } | null {
    const d = simplex.length - 1;
    if (d < 1) {
        return null;
    }
    const p0 = pts[simplex[0] as number] as Vec;
    const rows: number[][] = [];
    const rhs: number[] = [];
    for (let i = 1; i <= d; i += 1) {
        const pi = pts[simplex[i] as number] as Vec;
        const row: number[] = [];
        for (let k = 0; k < d; k += 1) {
            row.push(2 * ((pi[k] as number) - (p0[k] as number)));
        }
        rows.push(row);
        let diff = 0;
        for (let k = 0; k < d; k += 1) {
            diff += (pi[k] as number) ** 2 - (p0[k] as number) ** 2;
        }
        rhs.push(diff);
    }
    const center = solveLinear(rows, rhs);
    if (!center) {
        return null;
    }
    let r2 = 0;
    for (let k = 0; k < d; k += 1) {
        r2 += ((center[k] as number) - (p0[k] as number)) ** 2;
    }
    return { center, r2 };
}

/** True when q lies strictly inside the circumsphere of the simplex. */
function inSphere(pts: Vec[], simplex: Simplex, q: Vec): boolean {
    const cc = circumcircle(pts, simplex);
    if (!cc) {
        return false;
    }
    let dist2 = 0;
    for (let k = 0; k < q.length; k += 1) {
        dist2 += ((q[k] as number) - (cc.center[k] as number)) ** 2;
    }
    return dist2 < cc.r2 - 1e-9;
}

/** Build the single super-simplex that strictly contains every input point. */
function makeSuperSimplex(points: Vec[], d: number): Vec[] {
    const center = new Array<number>(d).fill(0);
    for (const p of points) {
        for (let k = 0; k < d; k += 1) {
            center[k] = (center[k] as number) + (p[k] as number);
        }
    }
    for (let k = 0; k < d; k += 1) {
        center[k] = (center[k] as number) / points.length;
    }
    let span = 0;
    for (const p of points) {
        for (let k = 0; k < d; k += 1) {
            span = Math.max(span, Math.abs((p[k] as number) - (center[k] as number)));
        }
    }
    const radius = (span || 1) * 10 + 1;
    const first = center.map((c) => c - radius);
    const vertices: Vec[] = [first];
    for (let k = 0; k < d; k += 1) {
        const v = center.map((c) => c - radius);
        v[k] = (center[k] as number) + d * radius;
        vertices.push(v);
    }
    return vertices;
}

function sameSimplex(a: Simplex, b: Simplex): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sortSimplex(s: Simplex): Simplex {
    return [...s].sort((a, b) => a - b);
}

interface MeshResult {
    simplices: Simplex[];
    history: Array<{ point: number; added: Simplex[]; bad: number }>;
}

/** Incremental Bowyer-Watson Delaunay triangulation in dimension d. */
function triangulate(points: Vec[], d: number): MeshResult {
    const n = points.length;
    const superVerts = makeSuperSimplex(points, d);
    const all = [...points, ...superVerts];
    let simplices: Simplex[] = [sortSimplex(Array.from({ length: d + 1 }, (_, i) => n + i))];
    const history: MeshResult["history"] = [];

    for (let i = 0; i < n; i += 1) {
        const badIndices: number[] = [];
        for (let s = 0; s < simplices.length; s += 1) {
            if (inSphere(all, simplices[s] as Simplex, all[i] as Vec)) {
                badIndices.push(s);
            }
        }
        if (badIndices.length === 0) {
            history.push({ point: i, added: [], bad: 0 });
            continue;
        }

        const facets = new Map<string, { facet: Simplex; count: number }>();
        for (const s of badIndices) {
            const sim = simplices[s] as Simplex;
            for (let v = 0; v < sim.length; v += 1) {
                const facet = sim.filter((_, j) => j !== v);
                const key = facet.join(",");
                const entry = facets.get(key);
                if (entry) {
                    entry.count += 1;
                } else {
                    facets.set(key, { facet, count: 1 });
                }
            }
        }

        const badSet = new Set(badIndices);
        simplices = simplices.filter((_, s) => !badSet.has(s));

        const added: Simplex[] = [];
        for (const { facet, count } of facets.values()) {
            if (count !== 1) {
                continue;
            }
            const next = sortSimplex([...facet, i]);
            if (!circumcircle(all, next)) {
                continue;
            }
            if (simplices.some((existing) => sameSimplex(existing, next))) {
                continue;
            }
            simplices.push(next);
            added.push(next);
        }
        history.push({ point: i, added, bad: badIndices.length });
    }

    const seen = new Set<string>();
    const real: Simplex[] = [];
    for (const sim of simplices) {
        if (!sim.every((idx) => idx < n)) {
            continue;
        }
        const key = sim.join(",");
        if (!seen.has(key)) {
            seen.add(key);
            real.push(sim);
        }
    }
    return { simplices: real, history };
}

/** Point nodes positioned by their first two coordinates. */
function makeNodes(points: Vec[], dimension: number, inserted: number, current: number): VisualEntity[] {
    return points.map((p, i) => {
        const state: EntityState =
            i === current ? "active" : i < inserted ? "sorted" : "unvisited";
        return {
            id: `point-${i}`,
            type: "node" as const,
            label: String(i),
            value: dimension === 2 ? [p[0] as number, p[1] as number] : [...p],
            state,
            x: p[0] as number,
            y: p[1] as number,
            width: 0,
            height: 0,
            metadata: { index: i, dimension, z: dimension > 2 ? (p[2] as number) : 0 },
        };
    });
}

/** One edge per unordered vertex pair, with newly created simplices highlighted. */
function makeEdges(simplices: Simplex[], highlight: Set<string>): VisualEdge[] {
    const seen = new Set<string>();
    const edges: VisualEdge[] = [];
    for (const sim of simplices) {
        const hot = highlight.has(sim.join(","));
        for (let a = 0; a < sim.length; a += 1) {
            for (let b = a + 1; b < sim.length; b += 1) {
                const u = sim[a] as number;
                const v = sim[b] as number;
                const key = `${u}-${v}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                edges.push({
                    id: `edge-${key}`,
                    sourceId: `point-${u}`,
                    targetId: `point-${v}`,
                    label: "",
                    state: hot ? "active" : "idle",
                    directed: false,
                });
            }
        }
    }
    return edges;
}

/** The multidimensional Delaunay generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Vec[]; dimension?: number } | null) ?? {};
    const raw: Vec[] = task.points ?? [
        [0, 0, 0],
        [3, 0, 1],
        [0, 4, 0],
        [4, 4, 2],
        [1, 1, 3],
        [5, 2, 1],
        [2, 5, 4],
        [6, 6, 0],
    ];
    const inferred = raw[0]?.length ?? 2;
    const dimension = Math.max(2, Math.min(4, Math.round(task.dimension ?? inferred)));
    const points: Vec[] = raw.map((p) =>
        Array.from({ length: dimension }, (_, k) => (p[k] as number | undefined) ?? 0),
    );
    const n = points.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(points, dimension, 0, -1),
        edges: [],
        description: `Start with ${n} points in ${dimension} dimensions; Delaunay simplices have empty circumspheres.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { dimension, pointCount: n, simplexCount: 0, simplexKeys: [] },
    };
    step += 1;

    if (n < dimension + 1) {
        yield {
            stepNumber: step,
            entities: makeNodes(points, dimension, n, -1),
            edges: [],
            description: `Need at least ${dimension + 1} points to form a ${dimension}-simplex.`,
            codeLineNumber: 8,
            layout: "point",
            meta: { dimension, pointCount: n, simplexCount: 0, simplexKeys: [] },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(points, dimension, 0, -1),
        edges: [],
        description: `Wrap all points in one super-simplex that is known to contain them.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { dimension, pointCount: n, simplexCount: 0, simplexKeys: [] },
    };
    step += 1;

    const { simplices, history } = triangulate(points, dimension);
    let mesh: Simplex[] = [];
    for (const event of history) {
        const highlight = new Set(event.added.map((s) => s.join(",")));
        mesh = [...mesh.filter((s) => !event.added.some((a) => sameSimplex(a, s))), ...event.added];
        yield {
            stepNumber: step,
            entities: makeNodes(points, dimension, event.point + 1, event.point),
            edges: makeEdges(mesh.filter((s) => s.every((idx) => idx < n)), highlight),
            description: `Insert point ${event.point}: ${event.bad} simplex(es) failed the circumsphere test; sealed the cavity with ${event.added.length} new simplex(es).`,
            codeLineNumber: event.bad === 0 ? 3 : 7,
            layout: "point",
            meta: { dimension, pointCount: n, simplexCount: mesh.length, current: event.point, removed: event.bad, added: event.added.length },
        };
        step += 1;
    }

    const finalEdges = makeEdges(simplices, new Set()).map((e) => ({
        ...e,
        state: "path" as EntityState,
    }));
    yield {
        stepNumber: step,
        entities: makeNodes(points, dimension, n, -1),
        edges: finalEdges,
        description: `Delaunay mesh complete: ${simplices.length} simplex(es), each with an empty circumsphere.`,
        codeLineNumber: 8,
        layout: "point",
        meta: {
            dimension,
            pointCount: n,
            simplexCount: simplices.length,
            simplexKeys: simplices.map((s) => s.join(",")),
        },
    };
}

/** The multidimensional Delaunay module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Lift every point onto a paraboloid one dimension higher; the Delaunay triangulation is the shadow of the lower faces of that lifted hull. The incremental version never builds the hull explicitly: a new point simply eats every simplex whose circumsphere contains it, and the hole is patched by joining the point to the cavity boundary.",
        invariants: [
            "After each insertion the mesh covers every point already inserted.",
            "Every simplex currently in the mesh has an empty circumsphere with respect to the inserted points.",
            "The boundary of the cavity is exactly the set of facets belonging to one deleted simplex only.",
        ],
        correctness:
            "When point p is inserted, a Delaunay simplex is destroyed precisely when p lies inside its circumsphere, so the union of those bad simplices is the region whose Delaunay property p violates. Facets shared by two bad simplices are interior to that region and vanish with it; facets with a single bad simplex lie on its boundary, and joining p to each one rebuilds a mesh whose simplices again have empty circumspheres. Removing the super-simplex leaves the Delaunay triangulation of the real points.",
        complexityRationale:
            "For fixed dimension d the expected number of simplices created over all insertions is O(n^ceil(d/2)), and each insertion scans the current mesh, giving expected total O(n^(1 + ceil(d/2))) time and O(n^ceil(d/2)) space. The circumsphere solve is a constant-size linear system once d is fixed.",
        uses: [
            "Finite-element mesh generation in two and three dimensions",
            "Nearest-neighbor and interpolation on scattered multidimensional data",
            "Computing the convex hull and alpha shapes of point clouds",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
            "Bowyer, Computing Dirichlet Tessellations, Computer Journal, 1981",
            "Watson, Computing the n-Dimensional Delaunay Tessellation, 1981",
        ],
        workedExample:
            "For the square corners (0,0), (1,0), (1,1), (0,1) plus a center point, the first four points form two triangles across one diagonal. Inserting the center makes both circumcircles fail, so both triangles are deleted and four thin triangles connect the center to the four boundary edges.",
    },
    id: "multidimensional-delaunay",
    name: "Multidimensional Delaunay Triangulation",
    category: "geometry",
    complexity: { time: "O(n^(1 + ceil(d/2)))", space: "O(n^ceil(d/2))" },
    defaultInput: {
        points: [
            [0, 0, 0],
            [3, 0, 1],
            [0, 4, 0],
            [4, 4, 2],
            [1, 1, 3],
            [5, 2, 1],
            [2, 5, 4],
            [6, 6, 0],
        ],
        dimension: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the input points and the dimension d",
        "build one super-simplex strictly containing every point",
        "initialize the mesh with that single super-simplex",
        "for each input point p in insertion order",
        "collect all simplices whose circumsphere contains p",
        "find cavity boundary facets owned by exactly one bad simplex",
        "delete the bad simplices from the mesh",
        "join p to each boundary facet to create new simplices",
        "drop simplices touching the super-simplex and report the mesh",
    ],
};

export default module;
