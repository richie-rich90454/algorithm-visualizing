/**
 * polygon-triangulation-dp.ts - Minimum Weight Polygon Triangulation by DP
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a convex polygon, a triangulation is a set of noncrossing diagonals that
 * split it into n-2 triangles. This module chooses the triangulation whose
 * total diagonal length is minimal. The dynamic program solves every
 * subpolygon (i, j) in increasing order of vertex span: the best triangle
 * incident to edge (i, j) has a third vertex k, and the remaining work splits
 * into the independent subpolygons (i, k) and (k, j).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) subproblems with O(n) choices each
 *   Space: O(n^2) for the dynamic programming and choice tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Polygon vertices are POINT nodes at their true coordinates.
 *   - Boundary edges stay IDLE; chosen diagonals are PATH.
 *   - Each DP span frame highlights the subpolygon currently being solved.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Andrew monotone chain; returns the convex hull in counterclockwise order. */
function convexHull(input: Pt[]): Pt[] {
    const points = [...input].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (points.length <= 2) return points;
    const lower: Pt[] = [];
    for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    const upper: Pt[] = [];
    for (let i = points.length - 1; i >= 0; i -= 1) {
        const p = points[i]!;
        while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function node(p: Pt, i: number, state: EntityState): VisualEntity {
    return {
        id: `v-${i}`,
        type: "node",
        label: `v${i}`,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { x: p[0], y: p[1], index: i },
    };
}

function segmentEdge(a: number, b: number, state: EntityState): VisualEdge {
    return {
        id: `e-${Math.min(a, b)}-${Math.max(a, b)}`,
        sourceId: `v-${a}`,
        targetId: `v-${b}`,
        label: "",
        state,
        directed: false,
    };
}

/** Solve subproblems by span, then reconstruct the optimal diagonal set. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const hull = convexHull(task.points ?? [
        [0, 0], [5, 0], [7, 3], [4, 6], [0, 4],
    ]);
    const n = hull.length;
    const dist = (i: number, j: number): number => Math.hypot(hull[i]![0] - hull[j]![0], hull[i]![1] - hull[j]![1]);
    const weight = (i: number, j: number): number => (j === i + 1 ? 0 : dist(i, j));

    let step = 0;
    const boundary: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        boundary.push(segmentEdge(i, (i + 1) % n, "idle"));
    }
    yield {
        stepNumber: step,
        entities: hull.map((p, i) => node(p, i, "idle")),
        edges: boundary,
        description: `Solve the minimum-weight triangulation of a convex ${n}-vertex polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, totalWeight: 0, triangles: 0 },
    };
    step += 1;

    if (n < 3) {
        yield {
            stepNumber: step,
            entities: hull.map((p, i) => node(p, i, "idle")),
            edges: boundary,
            description: "At least three noncollinear vertices are needed for a triangulation.",
            codeLineNumber: 1,
            layout: "point",
            meta: { n, totalWeight: 0, triangles: 0, valid: false },
        };
        return;
    }

    const dp: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => Infinity));
    const choice: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => -1));
    for (let i = 0; i + 1 < n; i += 1) {
        dp[i]![i + 1] = 0;
    }

    for (let span = 2; span < n; span += 1) {
        for (let i = 0; i + span < n; i += 1) {
            const j = i + span;
            let best = Infinity;
            let bestK = -1;
            for (let k = i + 1; k < j; k += 1) {
                const cost = dp[i]![k]! + dp[k]![j]! + weight(i, k) + weight(k, j);
                if (cost < best) {
                    best = cost;
                    bestK = k;
                }
            }
            dp[i]![j] = best;
            choice[i]![j] = bestK;
        }
        const states = new Map<number, EntityState>();
        for (let v = 0; v <= Math.min(n - 1, span + 1); v += 1) {
            states.set(v, "comparing");
        }
        yield {
            stepNumber: step,
            entities: hull.map((p, i) => node(p, i, states.get(i) ?? "idle")),
            edges: boundary,
            description: `Solved subpolygons of span ${span}; dp value for (0, ${span}) is ${dp[0]![span]!.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, span, dpValue: dp[0]![span] ?? 0 },
        };
        step += 1;
    }

    const diagonals: Array<[number, number]> = [];
    const triangles: Array<[number, number, number]> = [];
    const build = (i: number, j: number): void => {
        if (j - i < 2) return;
        const k = choice[i]![j]!;
        triangles.push([i, k, j]);
        if (k - i > 1) diagonals.push([i, k]);
        if (j - k > 1) diagonals.push([k, j]);
        build(i, k);
        build(k, j);
    };
    build(0, n - 1);

    const finalEdges = [
        ...boundary,
        ...diagonals.map(([a, b]) => segmentEdge(a, b, "path")),
    ];
    yield {
        stepNumber: step,
        entities: hull.map((p, i) => node(p, i, "path")),
        edges: finalEdges,
        description: `Optimal triangulation uses ${diagonals.length} diagonals with total weight ${dp[0]![n - 1]!.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            n,
            totalWeight: dp[0]![n - 1],
            triangles: triangles.length,
            diagonals: diagonals.length,
            valid: true,
        },
    };
}

/** The dynamic-programming triangulation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A polygon with n vertices has many triangulations, and they do not all cost the same if diagonals have length. Treat the polygon edge (i, j) as a base and try every possible third vertex k. That choice creates two smaller independent subpolygons, so once the smaller spans are solved the best k for the larger span follows from a table lookup.",
        invariants: [
            "A subproblem (i, j) only uses vertices strictly between i and j.",
            "Every subpolygon is solved before any subproblem that depends on it because spans increase.",
            "A chosen diagonal lies inside the convex polygon and never crosses another chosen diagonal.",
        ],
        correctness:
            "Every triangulation of subpolygon (i, j) contains exactly one triangle incident to edge (i, j), whose third vertex is some k. Removing that triangle leaves the independent subpolygons (i, k) and (k, j). By induction the table holds their optimal costs, so minimizing over k yields the optimum for (i, j). The full polygon is the subproblem (0, n-1), and backtracking the choice table reconstructs an optimal set of n-3 diagonals and n-2 triangles.",
        complexityRationale:
            "There are O(n^2) subproblems, each trying O(n) values of k, so the time bound is O(n^3). The cost and choice tables each hold n squared entries, giving O(n^2) space.",
        uses: [
            "Mesh generation where short interior edges reduce distortion",
            "Minimum-cost subdivision in computer-aided design",
            "Teaching dynamic programming over intervals",
        ],
        references: [
            "CLRS, Introduction to Algorithms, chapter on dynamic programming",
            "de Berg et al., Computational Geometry: Algorithms and Applications, triangulation chapter",
        ],
        workedExample:
            "For a convex quadrilateral with vertices 0,1,2,3 the only two options are diagonals (0,2) and (1,3). The DP compares their lengths and stores the shorter, producing two triangles and one diagonal, which is the minimum-weight triangulation.",
    },
    id: "polygon-triangulation-dp",
    name: "Minimum Weight Polygon Triangulation",
    category: "geometry",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        points: [[0, 0], [5, 0], [7, 3], [4, 6], [0, 4]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute the convex hull and index its vertices",
        "set the cost of every polygon edge to zero",
        "for each span from two up to n minus one",
        "for every base edge of that span try each third vertex k",
        "store the least cost and its choice in a table",
        "backtrack the choices to list the diagonals",
        "done: report the minimum total diagonal length",
    ],
};

export default module;
