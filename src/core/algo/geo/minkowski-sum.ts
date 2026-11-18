/**
 * minkowski-sum.ts - Minkowski sum of two convex polygons
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Minkowski sum A + B is the set of all pairwise sums a + b with a in A
 * and b in B. For convex polygons there is a simple edge-merging construction:
 * start at the sum of the lowest-leftmost vertices of both polygons, then
 * repeatedly append the next edge vector from whichever polygon has the
 * smaller polar angle. The two boundary walks advance in angle lockstep and
 * trace the sum polygon in O(n + m) time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) after putting each polygon in angle-sorted form
 *   Space: O(n + m) for the result polygon
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Polygon A vertices are shown in one color, polygon B in another.
 *   - The sum vertices appear as they are produced by the edge merge.
 *   - The final frame draws the closed sum polygon.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Cross product of two edge vectors. */
function crossVec(a: Pt, b: Pt): number {
    return a[0] * b[1] - a[1] * b[0];
}

/** Twice the signed area of a polygon; positive means counter-clockwise. */
function area2(poly: Pt[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Pt;
        const b = poly[(i + 1) % poly.length] as Pt;
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return sum;
}

/** Index of the lowest (then leftmost) vertex. */
function lowestLeftmost(poly: Pt[]): number {
    let best = 0;
    for (let i = 1; i < poly.length; i += 1) {
        const p = poly[i] as Pt;
        const b = poly[best] as Pt;
        if (p[1] < b[1] || (p[1] === b[1] && p[0] < b[0])) {
            best = i;
        }
    }
    return best;
}

/** Rotate a convex polygon to counter-clockwise order starting at lowest-leftmost. */
function normalize(poly: Pt[]): Pt[] {
    const oriented = area2(poly) < 0 ? [...poly].reverse() : [...poly];
    const k = lowestLeftmost(oriented);
    return [...oriented.slice(k), ...oriented.slice(0, k)];
}

/** Edge vector i of a normalized polygon. */
function edge(poly: Pt[], i: number): Pt {
    const a = poly[i] as Pt;
    const b = poly[(i + 1) % poly.length] as Pt;
    return [b[0] - a[0], b[1] - a[1]];
}

/** Build entities for polygons A, B and the partially built sum. */
function makeEntities(
    a: Pt[],
    b: Pt[],
    sum: Pt[],
    aStates: Map<number, EntityState>,
    bStates: Map<number, EntityState>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    a.forEach(([x, y], index) => {
        entities.push({
            id: `a-${index}`,
            type: "node" as const,
            label: `A${index}`,
            value: [x, y],
            state: aStates.get(index) ?? "unvisited",
            x,
            y: -y,
            width: 0,
            height: 0,
            metadata: { x, y, index, poly: "a" },
        });
    });
    b.forEach(([x, y], index) => {
        entities.push({
            id: `b-${index}`,
            type: "node" as const,
            label: `B${index}`,
            value: [x, y],
            state: bStates.get(index) ?? "unvisited",
            x,
            y: -y,
            width: 0,
            height: 0,
            metadata: { x, y, index, poly: "b" },
        });
    });
    sum.forEach(([x, y], index) => {
        entities.push({
            id: `s-${index}`,
            type: "node" as const,
            label: `S${index}`,
            value: [x, y],
            state: "sorted",
            x,
            y: -y,
            width: 0,
            height: 0,
            metadata: { x, y, index, poly: "sum" },
        });
    });
    return entities;
}

/** The Minkowski sum generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: Pt[]; b?: Pt[] } | null) ?? {};
    const a: Pt[] = (task.a ?? [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
    ]).map((p) => [p[0], p[1]] as Pt);
    const b: Pt[] = (task.b ?? [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ]).map((p) => [p[0], p[1]] as Pt);

    let step = 0;
    const emit = (
        sum: Pt[],
        aStates: Map<number, EntityState>,
        bStates: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeEntities(a, b, sum, aStates, bStates),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    if (a.length === 0 || b.length === 0) {
        yield emit([], new Map(), new Map(), [], "Minkowski: an empty polygon gives an empty sum.", 0, { sum: [] });
        return;
    }

    const A = normalize(a);
    const B = normalize(b);
    const aStart = lowestLeftmost(A);
    const bStart = lowestLeftmost(B);
    const a0 = A[aStart] as Pt;
    const b0 = B[bStart] as Pt;
    const sum: Pt[] = [[a0[0] + b0[0], a0[1] + b0[1]]];

    yield emit(
        sum,
        new Map([[aStart, "pivot"]]),
        new Map([[bStart, "pivot"]]),
        [],
        "Minkowski: start at the sum of the lowest-leftmost vertices.",
        1,
        { sum: sum.flat() },
    );

    // Map normalized indices back to original indices for highlighting.
    const aOrigIndex = new Map<Pt, number>();
    a.forEach((p, i) => aOrigIndex.set(p, i));
    const bOrigIndex = new Map<Pt, number>();
    b.forEach((p, i) => bOrigIndex.set(p, i));

    let i = 0;
    let j = 0;
    let guard = 0;
    const limit = A.length + B.length + 2;
    while ((i < A.length || j < B.length) && guard < limit) {
        guard += 1;
        const ea: Pt | null = i < A.length ? edge(A, i) : null;
        const eb: Pt | null = j < B.length ? edge(B, j) : null;
        let stepVec: Pt;
        let usedA = false;
        let usedB = false;

        if (ea && eb) {
            const turn = crossVec(ea, eb);
            if (turn > 0) {
                stepVec = ea;
                usedA = true;
            } else if (turn < 0) {
                stepVec = eb;
                usedB = true;
            } else {
                stepVec = [ea[0] + eb[0], ea[1] + eb[1]];
                usedA = true;
                usedB = true;
            }
        } else if (ea) {
            stepVec = ea;
            usedA = true;
        } else if (eb) {
            stepVec = eb;
            usedB = true;
        } else {
            break;
        }

        const last = sum[sum.length - 1] as Pt;
        sum.push([last[0] + stepVec[0], last[1] + stepVec[1]]);
        if (usedA) {
            i += 1;
        }
        if (usedB) {
            j += 1;
        }

        const aStates = new Map<number, EntityState>();
        const bStates = new Map<number, EntityState>();
        if (usedA) {
            const vertex = A[(i - 1 + A.length) % A.length] as Pt;
            const original = aOrigIndex.get(vertex);
            if (original !== undefined) {
                aStates.set(original, "active");
            }
        }
        if (usedB) {
            const vertex = B[(j - 1 + B.length) % B.length] as Pt;
            const original = bOrigIndex.get(vertex);
            if (original !== undefined) {
                bStates.set(original, "active");
            }
        }
        const sumEdges: VisualEdge[] = [];
        for (let k = 0; k < sum.length - 1; k += 1) {
            sumEdges.push({
                id: `sum-edge-${k}`,
                sourceId: `s-${k}`,
                targetId: `s-${k + 1}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
        yield emit(
            sum,
            aStates,
            bStates,
            sumEdges,
            `Minkowski: append edge vector (${stepVec[0]}, ${stepVec[1]}) from ${usedA ? "A" : ""}${usedA && usedB ? "+" : ""}${usedB ? "B" : ""}.`,
            3,
            { stepVec, sumLength: sum.length },
        );
    }

    // The last vertex duplicates the first after a full circuit.
    if (sum.length > 1) {
        const first = sum[0] as Pt;
        const last = sum[sum.length - 1] as Pt;
        if (first[0] === last[0] && first[1] === last[1]) {
            sum.pop();
        }
    }

    const finalEdges: VisualEdge[] = [];
    for (let k = 0; k < sum.length; k += 1) {
        finalEdges.push({
            id: `sum-final-${k}`,
            sourceId: `s-${k}`,
            targetId: `s-${(k + 1) % sum.length}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    yield emit(
        sum,
        new Map(),
        new Map(),
        finalEdges,
        `Minkowski: the sum polygon has ${sum.length} vertex(es).`,
        5,
        { sum: sum.flat() },
    );
}

/** The Minkowski sum module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adding two convex polygons means sliding one around the other and tracing the shape swept out by their tips. The boundary of the result is just the two polygon boundaries walked at once. Because both boundaries turn monotonically, you can merge their edge vectors the way a merge sort merges two sorted lists, taking whichever edge turns less at each step.",
        invariants: [
            "Both input boundaries are traversed in counter-clockwise edge-angle order.",
            "Each sum vertex equals a vertex of A plus a vertex of B.",
            "The merged edge sequence turns monotonically, so the result is convex.",
        ],
        correctness:
            "The support function of a Minkowski sum is the sum of the support functions, so for every direction the extreme point of A + B is the sum of the extreme points of A and B. Walking both convex boundaries in angle order and adding the next edge from the polygon with the smaller angle visits exactly those summed support points in order, tracing the full boundary of the sum.",
        complexityRationale:
            "Rotating each polygon to its lowest-leftmost vertex takes O(n + m), after which each edge of each polygon is consumed exactly once in the merge, so the construction is linear. The output polygon stores at most n + m vertices, giving O(n + m) space.",
        uses: [
            "Computing configuration-space obstacles in robot motion planning",
            "Minkowski difference based collision detection for convex shapes",
            "Growing shapes by a fixed convex kernel in geometric modeling",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 13",
            "Schneider and Eberly, Geometric Tools for Computer Graphics, Chapter 6",
        ],
        workedExample:
            "Adding the square (0,0),(2,0),(2,2),(0,2) to the unit square (0,0),(1,0),(1,1),(0,1) starts at (0,0) and merges the identical rightward, upward, leftward, and downward edge directions, combining same-direction pairs. The result is the 3 by 3 square with corners (0,0), (3,0), (3,3), (0,3).",
    },
    id: "minkowski-sum",
    name: "Minkowski Sum (Convex Polygons)",
    category: "geometry",
    complexity: { time: "O(n + m)", space: "O(n + m)" },
    defaultInput: {
        a: [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
        ],
        b: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "orient both polygons counter-clockwise from lowest-leftmost",
        "start the sum with the addition of the two start vertices",
        "look at the next edge vector of each polygon",
        "append the vector with the smaller polar angle to the sum",
        "when angles are equal append their vector sum and advance both",
        "repeat until both boundaries are exhausted",
        "close the polygon and report the summed vertices",
    ],
};

export default module;
