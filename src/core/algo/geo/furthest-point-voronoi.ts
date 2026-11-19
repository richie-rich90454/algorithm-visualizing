/**
 * furthest-point-voronoi.ts - Farthest-point Voronoi skeleton of a point set.
 *
 * Only convex-hull vertices own a cell in a farthest-point Voronoi diagram,
 * and neighboring cells meet along the perpendicular bisector of consecutive
 * hull vertices. This module builds the hull with a monotone chain and clips
 * each supporting bisector to a padded bounding box for display.
 *
 * Time: O(n log n) for the hull plus O(h) bisectors. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
interface Bounds { xmin: number; xmax: number; ymin: number; ymax: number }

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Monotone-chain hull as indices, counter-clockwise, dropping collinear points. */
function hullIndices(points: Pt[]): number[] {
    if (points.length <= 1) return points.map((_, i) => i);
    const order = points.map((_, i) => i).sort((a, b) => points[a]![0] - points[b]![0] || points[a]![1] - points[b]![1]);
    const lower: number[] = [];
    const upper: number[] = [];
    for (const i of order) {
        while (lower.length >= 2 && cross(points[lower[lower.length - 2]!]!, points[lower[lower.length - 1]!]!, points[i]!) <= 0) lower.pop();
        lower.push(i);
    }
    for (const i of [...order].reverse()) {
        while (upper.length >= 2 && cross(points[upper[upper.length - 2]!]!, points[upper[upper.length - 1]!]!, points[i]!) <= 0) upper.pop();
        upper.push(i);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Clip the perpendicular bisector of a-b to a rectangle, returning its ends. */
function bisectorSegment(a: Pt, b: Pt, bounds: Bounds): [Pt, Pt] | null {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = -(b[1] - a[1]);
    const dy = b[0] - a[0];
    let tlo = -Infinity;
    let thi = Infinity;
    if (dx === 0) {
        if (mx < bounds.xmin || mx > bounds.xmax) return null;
    } else {
        const t1 = (bounds.xmin - mx) / dx;
        const t2 = (bounds.xmax - mx) / dx;
        tlo = Math.max(tlo, Math.min(t1, t2));
        thi = Math.min(thi, Math.max(t1, t2));
    }
    if (dy === 0) {
        if (my < bounds.ymin || my > bounds.ymax) return null;
    } else {
        const t1 = (bounds.ymin - my) / dy;
        const t2 = (bounds.ymax - my) / dy;
        tlo = Math.max(tlo, Math.min(t1, t2));
        thi = Math.min(thi, Math.max(t1, t2));
    }
    if (tlo > thi) return null;
    return [
        [mx + tlo * dx, my + tlo * dy],
        [mx + thi * dx, my + thi * dy],
    ];
}

function defaultBounds(points: Pt[]): Bounds {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const [x, y] of points) {
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
    }
    const pad = Math.max(1, 0.15 * Math.max(xmax - xmin, ymax - ymin));
    return { xmin: xmin - pad, xmax: xmax + pad, ymin: ymin - pad, ymax: ymax + pad };
}

/** The farthest-point Voronoi generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; bounds?: Partial<Bounds> } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [2, 2], [3, 1],
    ];
    const supplied = task.bounds ?? {};
    const base = defaultBounds(points);
    const bounds: Bounds = {
        xmin: supplied.xmin ?? base.xmin,
        xmax: supplied.xmax ?? base.xmax,
        ymin: supplied.ymin ?? base.ymin,
        ymax: supplied.ymax ?? base.ymax,
    };
    const hull = hullIndices(points);
    const segments: Array<[Pt, Pt]> = [];
    for (let i = 0; i < hull.length; i += 1) {
        const a = points[hull[i]!]!;
        const b = points[hull[(i + 1) % hull.length]!]!;
        const seg = bisectorSegment(a, b, bounds);
        if (seg) segments.push(seg);
    }

    let step = 0;
    const flatPoints: number[] = [];
    for (const [x, y] of points) flatPoints.push(x, y);
    const emit = (shownSegments: number, description: string, codeLineNumber: number, final: boolean): VisualFrame => {
        const entities: VisualEntity[] = points.map((p, i) => ({
            id: `p-${i}`,
            type: "node",
            label: String(i),
            value: p,
            state: final ? (hull.includes(i) ? "sorted" : "visited") : hull.includes(i) ? "pivot" : "unvisited",
            x: p[0],
            y: -p[1],
            width: 0,
            height: 0,
            metadata: { index: i, hull: hull.includes(i) },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < hull.length; i += 1) {
            edges.push({
                id: `hull-${i}`,
                sourceId: `p-${hull[i]!}`,
                targetId: `p-${hull[(i + 1) % hull.length]!}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
        const bisectors: number[] = [];
        for (let i = 0; i < shownSegments; i += 1) {
            const [a, b] = segments[i]!;
            entities.push(
                { id: `bi-${i}-a`, type: "node", label: "", value: a, state: "active", x: a[0], y: -a[1], width: 0, height: 0, metadata: { bisector: i } },
                { id: `bi-${i}-b`, type: "node", label: "", value: b, state: "active", x: b[0], y: -b[1], width: 0, height: 0, metadata: { bisector: i } },
            );
            edges.push({ id: `bisector-${i}`, sourceId: `bi-${i}-a`, targetId: `bi-${i}-b`, label: "", state: "comparing", directed: false });
            bisectors.push(a[0], a[1], b[0], b[1]);
        }
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: { hull, bisectors, points: flatPoints, bounds: [bounds.xmin, bounds.xmax, bounds.ymin, bounds.ymax] },
        };
    };

    yield emit(0, `Farthest Voronoi: ${hull.length} hull vertices can own cells among ${points.length} sites.`, 0, false);
    for (let i = 0; i < segments.length; i += 1) {
        yield emit(i + 1, `Farthest Voronoi: bisector ${i + 1} separates two neighboring hull cells.`, 2, false);
    }
    yield emit(segments.length, `Farthest Voronoi: ${segments.length} supporting bisectors bound the unbounded cells.`, 4, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A farthest-point Voronoi diagram answers which site is farthest from a query. Interior sites can never win, so only convex-hull vertices matter. Neighboring hull vertices share a cell boundary that is simply their perpendicular bisector, and every such cell stretches off to infinity.",
        invariants: [
            "Every cell owner is a convex-hull vertex of the site set.",
            "Each drawn line is the perpendicular bisector of two consecutive hull vertices.",
            "Interior sites appear as points but own no cell and emit no bisector.",
        ],
        correctness:
            "For any query x, the farthest site maximizes squared distance, a convex function, so its maximum over a finite set occurs at a hull vertex; interior sites are never farthest. Two adjacent hull vertices v_i and v_{i+1} tie exactly on their perpendicular bisector, and on one side of it one is farther than the other, so that line is their shared cell boundary. Drawing one bisector per consecutive hull pair therefore gives the complete skeleton of the diagram.",
        complexityRationale:
            "The monotone-chain hull sorts the n sites once in O(n log n) time and scans them linearly. Each of the h hull vertices contributes one bisector clipped in constant time, so the extra work is O(h) time and O(h) space.",
        uses: [
            "Finding the largest empty circle and widest open spaces",
            "Computing the convex-hull skeleton of facility locations",
            "Nearest-worst-site queries in spatial analysis",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 7",
            "Okabe, Boots, Sugihara and Chiu, Spatial Tessellations, Chapter 3",
        ],
        workedExample:
            "For sites at (0,0), (4,0), (4,3), (0,3) plus an interior point (2,2), the hull is the four rectangle corners. The bisectors are x = 2 for the left and right pairs and y = 1.5 for the bottom and top pairs. The interior point is ignored because a query is always at least as far from some corner as from the middle.",
    },
    id: "furthest-point-voronoi",
    name: "Farthest-Point Voronoi Diagram",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [[0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [2, 2], [3, 1]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "sort the sites lexicographically and build a convex hull",
        "keep only the hull vertices because interior sites never win",
        "for each consecutive hull pair compute the perpendicular bisector",
        "clip that line to the padded bounding box",
        "draw the clipped lines as the cell boundaries",
        "done: only hull vertices own unbounded farthest cells",
    ],
};

export default module;
