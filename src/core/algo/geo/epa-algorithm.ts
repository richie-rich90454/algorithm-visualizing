/**
 * epa-algorithm.ts - Expanding Polytope Algorithm for penetration depth.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Once GJK has found a simplex surrounding the origin in the Minkowski
 * difference of two overlapping convex polygons, EPA expands that simplex
 * toward the boundary. At each step it selects the closest face of the current
 * polytope, asks the support function for the farthest point in that face's
 * outward direction, and inserts it. The process stops when the face cannot
 * be pushed outward, at which point the face distance is the penetration
 * depth: the smallest translation that separates the shapes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * v) for k expansion steps and v polygon vertices
 *   Space: O(k) for the expanding polytope
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points of shape A, shape B, and the current polytope are plotted.
 *   - Polytope edges are drawn; the closest edge is highlighted.
 *   - The final frame reports the penetration depth and separating direction.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

const dot = (a: Pt, b: Pt): number => a[0] * b[0] + a[1] * b[1];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt): number => a[0] * b[1] - a[1] * b[0];

function support(polygon: Pt[], direction: Pt): Pt {
    let best = polygon[0] ?? [0, 0];
    let bestDot = dot(best, direction);
    for (const point of polygon) {
        const value = dot(point, direction);
        if (value > bestDot) {
            best = point;
            bestDot = value;
        }
    }
    return best;
}

function hull(points: Pt[]): Pt[] {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length <= 2) return sorted;
    const lower: Pt[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(sub(lower[lower.length - 1] as Pt, lower[lower.length - 2] as Pt), sub(p, lower[lower.length - 2] as Pt)) <= 0) lower.pop();
        lower.push(p);
    }
    const upper: Pt[] = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const p = sorted[i] as Pt;
        while (upper.length >= 2 && cross(sub(upper[upper.length - 1] as Pt, upper[upper.length - 2] as Pt), sub(p, upper[upper.length - 2] as Pt)) <= 0) upper.pop();
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

function originInside(polygon: Pt[]): boolean {
    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i] as Pt;
        const b = polygon[(i + 1) % polygon.length] as Pt;
        if (cross(sub(b, a), [-a[0], -a[1]]) < -1e-9) return false;
    }
    return true;
}

function closestEdge(polygon: Pt[]): { index: number; distance: number; normal: Pt } {
    let best = { index: 0, distance: Infinity, normal: [0, 0] as Pt };
    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i] as Pt;
        const b = polygon[(i + 1) % polygon.length] as Pt;
        const edge = sub(b, a);
        const length = Math.hypot(edge[0], edge[1]);
        if (length < 1e-12) continue;
        const normal: Pt = [edge[1] / length, -edge[0] / length];
        const distance = dot(a, normal);
        if (distance < best.distance) best = { index: i, distance, normal };
    }
    return best;
}

function build(A: Pt[], B: Pt[], directions: number): { polytope: Pt[]; steps: Array<{ polytope: Pt[]; edgeIndex: number; distance: number }> } {
    const minkowskiSupport = (direction: Pt): Pt => sub(support(A, direction), support(B, [-direction[0], -direction[1]]));
    const initial: Pt[] = [];
    for (let i = 0; i < directions; i += 1) {
        const angle = (2 * Math.PI * i) / directions;
        initial.push(minkowskiSupport([Math.cos(angle), Math.sin(angle)]));
    }
    let polytope = hull(initial);
    if (!originInside(polytope)) {
        const all: Pt[] = [];
        for (const a of A) for (const b of B) all.push(sub(a, b));
        polytope = hull(all);
    }
    const steps: Array<{ polytope: Pt[]; edgeIndex: number; distance: number }> = [];
    for (let iteration = 0; iteration < 64; iteration += 1) {
        const edge = closestEdge(polytope);
        if (!Number.isFinite(edge.distance)) break;
        const point = minkowskiSupport(edge.normal);
        const reach = dot(point, edge.normal);
        steps.push({ polytope: polytope.slice(), edgeIndex: edge.index, distance: edge.distance });
        if (reach <= edge.distance + 1e-7) break;
        const next = polytope.slice();
        next.splice(edge.index + 1, 0, point);
        polytope = next;
    }
    const finalEdge = closestEdge(polytope);
    steps.push({ polytope: polytope.slice(), edgeIndex: finalEdge.index, distance: finalEdge.distance });
    return { polytope, steps };
}

function entitiesFor(A: Pt[], B: Pt[], polytope: Pt[], edgeIndex: number): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [
        ...A.map((p, i) => ({ id: `a-${i}`, type: "node" as const, label: `A${i}`, value: p, state: "idle" as EntityState, x: p[0], y: p[1], width: 0, height: 0, metadata: { shape: "A" } })),
        ...B.map((p, i) => ({ id: `b-${i}`, type: "node" as const, label: `B${i}`, value: p, state: "idle" as EntityState, x: p[0], y: p[1], width: 0, height: 0, metadata: { shape: "B" } })),
        ...polytope.map((p, i) => ({ id: `m-${i}`, type: "node" as const, label: "m", value: p, state: (i === edgeIndex ? "active" : "path") as EntityState, x: p[0], y: p[1], width: 0, height: 0, metadata: { shape: "Minkowski" } })),
    ];
    const edges: VisualEdge[] = [];
    for (let i = 0; i < polytope.length; i += 1) {
        edges.push({
            id: `edge-${i}`,
            sourceId: `m-${i}`,
            targetId: `m-${(i + 1) % polytope.length}`,
            label: "",
            state: i === edgeIndex ? "highlight" : "idle",
            directed: false,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygonA?: Pt[]; polygonB?: Pt[] } | null) ?? {};
    const A: Pt[] = task.polygonA ?? [[0, 0], [4, 0], [4, 3], [0, 3]];
    const B: Pt[] = task.polygonB ?? [[3, 1], [6, 1], [6, 4], [3, 4]];
    const { polytope, steps } = build(A, B, 8);
    let step = 0;

    const initial = entitiesFor(A, B, polytope, -1);
    yield {
        stepNumber: step++,
        entities: initial.entities,
        edges: initial.edges,
        description: `Overlapping polygons: begin EPA with a ${polytope.length}-point simplex around the origin.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { penetration: 0, iterations: 0, polytope: polytope.map(String) },
    };

    for (let i = 0; i < steps.length; i += 1) {
        const current = steps[i];
        if (!current) continue;
        const visual = entitiesFor(A, B, current.polytope, current.edgeIndex);
        yield {
            stepNumber: step++,
            entities: visual.entities,
            edges: visual.edges,
            description: `Iteration ${i + 1}: closest polytope face is at distance ${current.distance.toFixed(3)} from the origin.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { penetration: current.distance, iterations: i + 1, face: current.edgeIndex, polytope: current.polytope.map(String) },
        };
    }

    const finalEdge = closestEdge(polytope);
    const final = entitiesFor(A, B, polytope, finalEdge.index);
    yield {
        stepNumber: step,
        entities: final.entities,
        edges: final.edges,
        description: `Penetration depth is ${finalEdge.distance.toFixed(3)} along the selected separating direction.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { penetration: finalEdge.distance, normal: finalEdge.normal, iterations: steps.length, polytope: polytope.map(String) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Minkowski difference of two overlapping shapes contains the origin. Its boundary distance from the origin is exactly how far one shape must move to stop overlapping. EPA grows a small simplex outward, face by face, until it reaches that boundary.",
        invariants: [
            "The origin stays inside the expanding polytope at every iteration.",
            "Every expansion uses a support point of the true Minkowski difference, so the polytope remains inscribed in it.",
            "The distance of the closest face never decreases as the polytope grows.",
        ],
        correctness:
            "The support function returns a point of the Minkowski difference farthest in the chosen outward direction. If that point lies beyond the closest face's line, the face is not yet on the true boundary and inserting the point strictly grows the inscribed polytope. When no support point passes the line, the face lies on the boundary, so its distance from the origin equals the minimum distance to the boundary, which is the penetration depth.",
        complexityRationale:
            "Each iteration finds the closest face by scanning the polytope and calls the support function over both vertex sets, costing O(v). With k expansion steps the total is O(k * v) time and O(k) space for the growing polytope.",
        uses: [
            "Penetration depth and contact normals in physics engines",
            "Collision response and character controllers in games",
            "Robotic grasp planning and path collision checks",
        ],
        references: [
            "Gilbert, Johnson and Keerthi, A Fast Procedure for Computing the Distance Between Complex Objects, 1988",
            "Ericson, Real-Time Collision Detection, chapter 4",
        ],
        workedExample:
            "Two axis-aligned squares, one spanning x from 0 to 4 and the other from 3 to 6, overlap by one unit horizontally and two vertically. The closest face of the Minkowski difference is one unit from the origin, so EPA reports a penetration depth of 1 along the horizontal axis.",
    },
    id: "epa-algorithm",
    name: "Expanding Polytope Algorithm",
    category: "geometry",
    complexity: { time: "O(k * v)", space: "O(k)" },
    defaultInput: { polygonA: [[0, 0], [4, 0], [4, 3], [0, 3]], polygonB: [[3, 1], [6, 1], [6, 4], [3, 4]] },
    visualType: "point",
    run,
    pseudocode: [
        "given two overlapping convex polygons",
        "build an initial simplex inside their Minkowski difference",
        "repeat until the closest face cannot expand",
        "find the polytope face nearest the origin",
        "query the support point in that face's outward direction",
        "if the point passes the face line, insert it into the polytope",
        "otherwise stop and report the face distance",
        "the distance is the penetration depth",
    ],
};

export default module;
