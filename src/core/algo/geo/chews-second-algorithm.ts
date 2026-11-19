/**
 * chews-second-algorithm.ts - Chew's second algorithm.
 *
 * For a simple polygon the algorithm returns two concentric circles centered
 * at the polygon centroid: an inner circle that fits entirely inside the
 * polygon and an outer circle that encloses it. Their radii are the minimum
 * and maximum distance from the centroid to the polygon boundary.
 *
 * Time: O(n) for n vertices. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function polygonCentroid(pts: Pt[]): Pt {
    let area2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i] as Pt;
        const b = pts[(i + 1) % pts.length] as Pt;
        const cross = a[0] * b[1] - b[0] * a[1];
        area2 += cross;
        cx += (a[0] + b[0]) * cross;
        cy += (a[1] + b[1]) * cross;
    }
    if (Math.abs(area2) < 1e-12) {
        const n = pts.length || 1;
        return [
            pts.reduce((s, p) => s + p[0], 0) / n,
            pts.reduce((s, p) => s + p[1], 0) / n,
        ];
    }
    return [cx / (3 * area2), cy / (3 * area2)];
}

function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
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

function polygonEdges(pts: Pt[]): VisualEdge[] {
    return pts.map((_, i) => ({
        id: `poly-${i}`,
        sourceId: `v-${i}`,
        targetId: `v-${(i + 1) % pts.length}`,
        label: "",
        state: "path" as EntityState,
        directed: false,
    }));
}

function ringEntities(center: Pt, radius: number, prefix: string, state: EntityState) {
    const samples = 48;
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    for (let k = 0; k < samples; k += 1) {
        const angle = (2 * Math.PI * k) / samples;
        entities.push(
            node(
                `${prefix}-${k}`,
                [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)],
                state,
                "",
            ),
        );
        edges.push({
            id: `${prefix}-e-${k}`,
            sourceId: `${prefix}-${k}`,
            targetId: `${prefix}-${(k + 1) % samples}`,
            label: "",
            state,
            directed: false,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.polygon ?? [
        [0, 0],
        [6, 0],
        [6, 4],
        [3, 6],
        [0, 4],
    ];
    let step = 0;
    if (pts.length < 3) {
        yield {
            stepNumber: step,
            entities: pts.map((p, i) => node(`v-${i}`, p, "unvisited", String(i))),
            edges: [],
            description: "A polygon needs at least three vertices.",
            codeLineNumber: 0,
            layout: "point",
            meta: { innerRadius: 0, outerRadius: 0 },
        };
        return;
    }

    const centroid = polygonCentroid(pts);
    const distances = pts.map((a, i) => pointSegmentDistance(centroid, a, pts[(i + 1) % pts.length] as Pt));
    let inner = Infinity;
    let outer = -Infinity;
    let nearest = 0;
    let farthest = 0;
    distances.forEach((d, i) => {
        if (d < inner) {
            inner = d;
            nearest = i;
        }
        if (d > outer) {
            outer = d;
            farthest = i;
        }
    });

    yield {
        stepNumber: step,
        entities: [
            ...pts.map((p, i) => node(`v-${i}`, p, "unvisited", String(i))),
            node("centroid", centroid, "pivot", "C"),
        ],
        edges: polygonEdges(pts),
        description: `Computing the centroid of a ${pts.length}-vertex polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { centroidX: centroid[0], centroidY: centroid[1] },
    };
    step += 1;

    for (let i = 0; i < pts.length; i += 1) {
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: [
                ...pts.map((p, k) =>
                    node(`v-${k}`, p, states.get(k) ?? "unvisited", String(k)),
                ),
                node("centroid", centroid, "pivot", "C"),
            ],
            edges: polygonEdges(pts).map((e) =>
                e.id === `poly-${i}` ? { ...e, state: "active" as EntityState } : e,
            ),
            description: `Edge ${i} is ${distances[i]!.toFixed(2)} from the centroid (inner ${inner.toFixed(2)}, outer ${outer.toFixed(2)}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { edge: i, edgeDistances: distances.slice(0, i + 1) },
        };
        step += 1;
    }

    const innerRing = ringEntities(centroid, inner, "inner", "sorted");
    const outerRing = ringEntities(centroid, outer, "outer", "path");
    yield {
        stepNumber: step,
        entities: [
            ...pts.map((p, i) =>
                node(`v-${i}`, p, i === nearest || i === farthest ? "highlight" : "visited", String(i)),
            ),
            node("centroid", centroid, "pivot", "C"),
            ...innerRing.entities,
            ...outerRing.entities,
        ],
        edges: [...polygonEdges(pts), ...innerRing.edges, ...outerRing.edges],
        description: `Done: inner radius ${inner.toFixed(2)} (edge ${nearest}), outer radius ${outer.toFixed(2)} (edge ${farthest}).`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            centroidX: centroid[0],
            centroidY: centroid[1],
            innerRadius: inner,
            outerRadius: outer,
            nearestEdge: nearest,
            farthestEdge: farthest,
            edgeDistances: distances,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Chew's second algorithm draws two circles around the centroid of a polygon. The smaller one just touches the nearest edge, so it stays inside; the larger one just reaches the farthest edge, so the polygon stays inside it. Both radii come from measuring the centroid's distance to every edge.",
        invariants: [
            "Both circles share the polygon centroid as their center.",
            "The inner radius equals the minimum centroid-to-edge distance.",
            "The outer radius equals the maximum centroid-to-edge distance.",
        ],
        correctness:
            "For a convex polygon the distance from an interior point to the boundary is the minimum over its edges, so a disk of that radius centered at the centroid stays inside and any larger disk crosses the nearest edge. Similarly the farthest edge distance bounds the polygon, so a disk of that radius contains every vertex and, by convexity, the whole polygon. For a star-shaped polygon these two radii still give a guaranteed inscribed and enclosing circle around the centroid.",
        complexityRationale:
            "Computing the centroid and scanning all n edges each take one pass, so time is O(n). The vertex list and the two sampled circle rings dominate space at O(n).",
        uses: [
            "Placing a guaranteed-clear inscribed disk inside a region",
            "Building a conservative bounding circle for collision culling",
            "Mesh generation refinement around polygonal domains",
        ],
        references: [
            "Chew, Guaranteed-Quality Triangular Meshes, PhD Thesis, Cornell University, 1989",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 3",
        ],
        workedExample:
            "For the square with corners (0,0), (2,0), (2,2), (0,2), the centroid is (1,1). Each edge is 1 away, so the inner and outer radii are both 1 and the two circles coincide with the inscribed circle.",
    },
    id: "chews-second-algorithm",
    name: "Chew's Second Algorithm",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [6, 0],
            [6, 4],
            [3, 6],
            [0, 4],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute the polygon centroid C",
        "for each polygon edge e",
        "measure the distance from C to e",
        "keep the smallest distance as the inner radius",
        "keep the largest distance as the outer radius",
        "draw the two circles centered at C",
        "done: return the inscribed and enclosing circles",
    ],
};

export default module;
