/**
 * quickhull.ts - QuickHull convex hull (divide and conquer)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * QuickHull is the divide-and-conquer convex hull algorithm. It starts from
 * the leftmost and rightmost points, splits the remaining points into the ones
 * above and below that line, then recursively picks the point farthest from
 * the line. Points strictly inside the triangle formed at each step can never
 * be extreme, so they are discarded. The recursion joins the upper and lower
 * chains into the hull.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst case
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Leftmost and rightmost seeds are shown in the pivot color.
 *   - The farthest point chosen in a recursive call is active.
 *   - The final hull edges are drawn as a closed path.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Orientation of (o, a, b): positive is a left turn. */
function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Build point nodes; logical y is negated so the plot reads in math orientation. */
function nodes(points: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: `${index}`,
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y: -y,
        width: 0,
        height: 0,
        metadata: { x, y, index },
    }));
}

/** Edges joining hull vertices into a closed polygon. */
function hullEdges(hull: number[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < hull.length; i += 1) {
        const from = hull[i];
        const to = hull[(i + 1) % hull.length];
        if (from === undefined || to === undefined) {
            continue;
        }
        edges.push({
            id: `hull-${from}-${to}-${i}`,
            sourceId: `p-${from}`,
            targetId: `p-${to}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return edges;
}

/** A recorded recursive step: the segment a-b produced child c. */
interface QuickStep {
    a: number;
    b: number;
    c: number;
}

/** The QuickHull generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const points: Pt[] = (task.points ?? [
        [0, 0],
        [4, 1],
        [2, 4],
        [1, 2],
        [5, 3],
        [3, 0],
        [5, 5],
        [0, 3],
    ]).map((p) => [p[0], p[1]] as Pt);

    let step = 0;
    const emit = (
        states: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: nodes(points, states),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    if (points.length <= 1) {
        yield emit(
            new Map(),
            [],
            points.length === 0 ? "QuickHull: no points, so the hull is empty." : "QuickHull: one point is its own hull.",
            0,
            { hull: points.map((_, i) => i) },
        );
        return;
    }

    // Leftmost (tie: lower y) and rightmost (tie: lower y) seeds.
    let left = 0;
    let right = 0;
    for (let i = 1; i < points.length; i += 1) {
        const p = points[i] as Pt;
        const l = points[left] as Pt;
        const r = points[right] as Pt;
        if (p[0] < l[0] || (p[0] === l[0] && p[1] < l[1])) {
            left = i;
        }
        if (p[0] > r[0] || (p[0] === r[0] && p[1] > r[1])) {
            right = i;
        }
    }

    const seeds = new Map<number, EntityState>([
        [left, "pivot"],
        [right, "pivot"],
    ]);
    yield emit(
        seeds,
        [],
        `QuickHull: seed points are ${left} (leftmost) and ${right} (rightmost).`,
        1,
        { left, right, count: points.length },
    );

    const steps: QuickStep[] = [];

    // Each recursion keeps points to the left of its directed segment; the
    // lower chain is seeded right-to-left so the same +1 sign applies. Returns
    // the chosen vertices in traversal order from a to b.
    const buildSide = (ai: number, bi: number, candidates: number[], sign: number): number[] => {
        if (candidates.length === 0) {
            return [];
        }
        const a = points[ai] as Pt;
        const b = points[bi] as Pt;
        let best = -1;
        let bestDistance = 0;
        for (const idx of candidates) {
            const p = points[idx] as Pt;
            const distance = cross(a, b, p) * sign;
            if (distance > bestDistance) {
                bestDistance = distance;
                best = idx;
            }
        }
        if (best < 0) {
            return [];
        }
        steps.push({ a: ai, b: bi, c: best });

        const c = points[best] as Pt;
        const towardA: number[] = [];
        const towardB: number[] = [];
        for (const idx of candidates) {
            if (idx === best) {
                continue;
            }
            const p = points[idx] as Pt;
            if (cross(a, c, p) * sign > 0) {
                towardA.push(idx);
            } else if (cross(c, b, p) * sign > 0) {
                towardB.push(idx);
            }
        }
        return [...buildSide(ai, best, towardA, sign), best, ...buildSide(best, bi, towardB, sign)];
    };

    const above: number[] = [];
    const below: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
        if (i === left || i === right) {
            continue;
        }
        const c = cross(points[left] as Pt, points[right] as Pt, points[i] as Pt);
        if (c > 0) {
            above.push(i);
        } else if (c < 0) {
            below.push(i);
        }
    }
    const upper = buildSide(left, right, above, 1);
    const lower = buildSide(right, left, below, 1);

    for (const s of steps) {
        const states = new Map<number, EntityState>([
            [s.a, "pivot"],
            [s.b, "pivot"],
            [s.c, "active"],
        ]);
        const edges: VisualEdge[] = [
            {
                id: `seg-${s.a}-${s.b}`,
                sourceId: `p-${s.a}`,
                targetId: `p-${s.b}`,
                label: "",
                state: "idle",
                directed: false,
            },
            {
                id: `seg-${s.a}-${s.c}`,
                sourceId: `p-${s.a}`,
                targetId: `p-${s.c}`,
                label: "",
                state: "path",
                directed: false,
            },
            {
                id: `seg-${s.c}-${s.b}`,
                sourceId: `p-${s.c}`,
                targetId: `p-${s.b}`,
                label: "",
                state: "path",
                directed: false,
            },
        ];
        yield emit(
            states,
            edges,
            `QuickHull: farthest point from segment ${s.a}-${s.b} is ${s.c}.`,
            3,
            { a: s.a, b: s.b, c: s.c },
        );
    }

    const hull = [left, ...upper, right, ...lower];

    const finalStates = new Map<number, EntityState>();
    for (const idx of hull) {
        finalStates.set(idx, "sorted");
    }
    yield emit(
        finalStates,
        hullEdges(hull),
        `QuickHull: the hull has ${hull.length} extreme points.`,
        5,
        { hull },
    );
}

/** The QuickHull module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "QuickHull borrows the split step from quicksort. It seeds the hull with the leftmost and rightmost points, then repeatedly chooses the point farthest from the current line because that point must be extreme. The triangle it forms encloses points that can never be on the hull, so recursion only continues in the two outer regions.",
        invariants: [
            "The current segment endpoints are always hull vertices of the partial hull.",
            "Every discarded point lies strictly inside or on a triangle already bounded by hull edges.",
            "Candidates for a recursive call all lie on the same side of its seed segment.",
        ],
        correctness:
            "The farthest point from a segment is extreme because the segment is a chord of the hull and the point of maximum distance on that side is a hull vertex. All points inside the triangle formed with the two endpoints lie in the convex hull of the segment and the farthest point, so they cannot be vertices. Recursing on the two outer subproblems therefore visits exactly the remaining hull vertices, and concatenating the upper and lower chains yields the complete hull.",
        complexityRationale:
            "Each level scans the surviving candidate set once. Balanced splits give O(n log n) expected time, matching quicksort's average behavior, while adversarial point orders can degrade to O(n^2). The recursion stacks and candidate arrays use O(n) space.",
        uses: [
            "Computing convex hulls quickly on well distributed point clouds",
            "A teaching bridge between quicksort partitioning and geometric divide and conquer",
            "Preprocessing for collision detection and shape approximation",
        ],
        references: [
            "Eddy, A New Convex Hull Algorithm for Planar Sets, 1977",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1",
        ],
        workedExample:
            "For the corners (0,0), (4,0), (4,4), (0,4) plus an interior point (2,2), the seeds are (0,0) and (4,0). The upper side picks (0,4) or (4,4) as farthest, recursion adds the other top corner, the lower side finds nothing, and the interior point is discarded. The hull is the four corners.",
    },
    id: "quickhull",
    name: "QuickHull",
    category: "geometry",
    complexity: { time: "O(n log n) average", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 1],
            [2, 4],
            [1, 2],
            [5, 3],
            [3, 0],
            [5, 5],
            [0, 3],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "find the leftmost and rightmost points as seeds",
        "split the other points into those above and below the seed line",
        "on each side pick the point farthest from the current segment",
        "that farthest point is a hull vertex; recurse on the two outer triangles",
        "discard points inside the closed triangle, which cannot be extreme",
        "join the upper chain, right seed, and lower chain into one polygon",
    ],
};

export default module;
