/**
 * minimum-width-annulus.ts - Minimum Width Annulus
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The minimum width annulus encloses a point set between two concentric
 * circles while minimizing the difference of their radii. The optimal center
 * is always either a midpoint of two input points or a circumcenter of three
 * input points: moving the center until either the inner or the outer radius
 * is determined by an additional point cannot improve the width. Enumerating
 * those candidate centers and evaluating the radial spread finds the optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^4) for O(n^3) candidate centers scored against n points
 *   Space: O(n) for the candidate and distance buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Input points are POINT nodes at their true coordinates.
 *   - The best center so far is a HIGHLIGHT node.
 *   - Two radius markers joined to the center show the current annulus.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Center of the circle through three points, or null for a degenerate triple. */
function circumcenter(a: Pt, b: Pt, c: Pt): Pt | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    return [
        (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
        (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
    ];
}

/** All midpoint and circumcenter candidate centers. */
function candidateCenters(points: Pt[]): Pt[] {
    const result: Pt[] = [];
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            result.push([(points[i]![0] + points[j]![0]) / 2, (points[i]![1] + points[j]![1]) / 2]);
        }
    }
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            for (let k = j + 1; k < points.length; k += 1) {
                const center = circumcenter(points[i]!, points[j]!, points[k]!);
                if (center) result.push(center);
            }
        }
    }
    return result;
}

function score(center: Pt, points: Pt[]): { inner: number; outer: number; width: number } {
    let inner = Infinity;
    let outer = -Infinity;
    for (const p of points) {
        const d = Math.hypot(p[0] - center[0], p[1] - center[1]);
        inner = Math.min(inner, d);
        outer = Math.max(outer, d);
    }
    return { inner, outer, width: outer - inner };
}

function pointNodes(points: Pt[]): VisualEntity[] {
    return points.map((p, i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: `p${i}`,
        value: [p[0], p[1]],
        state: "unvisited" as const,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { x: p[0], y: p[1], index: i },
    }));
}

/** Scan candidate centers and keep the narrowest enclosing annulus. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const points: Pt[] = task.points && task.points.length >= 2
        ? task.points
        : [
            [5, 0], [0, 5], [-5, 0], [0, -5], [3.5, 3.5], [-4, 2],
        ];

    let step = 0;
    yield {
        stepNumber: step,
        entities: pointNodes(points),
        edges: [],
        description: `Find the narrowest annulus enclosing ${points.length} points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: points.length, bestWidth: Infinity },
    };
    step += 1;

    const centers = candidateCenters(points);
    let bestCenter: Pt = centers[0] ?? [0, 0];
    let best = score(bestCenter, points);
    const stride = Math.max(1, Math.ceil(centers.length / 60));

    for (let i = 0; i < centers.length; i += 1) {
        const center = centers[i]!;
        const current = score(center, points);
        if (current.width < best.width - 1e-12 ||
            (Math.abs(current.width - best.width) <= 1e-12 && current.outer < best.outer)) {
            bestCenter = center;
            best = current;
        }
        if (i % stride === 0 || i === centers.length - 1) {
            const centerNode: VisualEntity = {
                id: "center",
                type: "node",
                label: "c",
                value: [bestCenter[0], bestCenter[1]],
                state: "highlight",
                x: bestCenter[0],
                y: bestCenter[1],
                width: 0,
                height: 0,
                metadata: { x: bestCenter[0], y: bestCenter[1] },
            };
            const innerMarker: VisualEntity = {
                id: "inner-marker",
                type: "node",
                label: `ri=${best.inner.toFixed(2)}`,
                value: [bestCenter[0] + best.inner, bestCenter[1]],
                state: "active",
                x: bestCenter[0] + best.inner,
                y: bestCenter[1],
                width: 0,
                height: 0,
                metadata: {},
            };
            const outerMarker: VisualEntity = {
                id: "outer-marker",
                type: "node",
                label: `ro=${best.outer.toFixed(2)}`,
                value: [bestCenter[0] + best.outer, bestCenter[1]],
                state: "sorted",
                x: bestCenter[0] + best.outer,
                y: bestCenter[1],
                width: 0,
                height: 0,
                metadata: {},
            };
            const radialEdges: VisualEdge[] = [
                { id: "radial-in", sourceId: "center", targetId: "inner-marker", label: "", state: "active", directed: false },
                { id: "radial-out", sourceId: "center", targetId: "outer-marker", label: "", state: "sorted", directed: false },
            ];
            yield {
                stepNumber: step,
                entities: [...pointNodes(points), centerNode, innerMarker, outerMarker],
                edges: radialEdges,
                description: `Checked center ${i + 1} of ${centers.length}; best width so far ${best.width.toFixed(3)}.`,
                codeLineNumber: 2,
                layout: "point",
                meta: {
                    n: points.length,
                    checked: i + 1,
                    center: bestCenter,
                    innerRadius: best.inner,
                    outerRadius: best.outer,
                    bestWidth: best.width,
                },
            };
            step += 1;
        }
    }

    const finalMarker = (id: string, radius: number, state: EntityState, label: string): VisualEntity => ({
        id,
        type: "node",
        label,
        value: [bestCenter[0] + radius, bestCenter[1]],
        state,
        x: bestCenter[0] + radius,
        y: bestCenter[1],
        width: 0,
        height: 0,
        metadata: {},
    });
    yield {
        stepNumber: step,
        entities: [
            ...pointNodes(points),
            { ...pointNodes(points)[0]!, id: "center", value: [bestCenter[0], bestCenter[1]], x: bestCenter[0], y: bestCenter[1], state: "highlight", label: "c" },
            finalMarker("inner-marker", best.inner, "path", `ri=${best.inner.toFixed(2)}`),
            finalMarker("outer-marker", best.outer, "path", `ro=${best.outer.toFixed(2)}`),
        ],
        edges: [
            { id: "radial-in", sourceId: "center", targetId: "inner-marker", label: "", state: "path", directed: false },
            { id: "radial-out", sourceId: "center", targetId: "outer-marker", label: "", state: "path", directed: false },
        ],
        description: `Minimum annulus width ${best.width.toFixed(3)} at center (${bestCenter[0].toFixed(2)}, ${bestCenter[1].toFixed(2)}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: {
            n: points.length,
            candidatesChecked: centers.length,
            center: bestCenter,
            innerRadius: best.inner,
            outerRadius: best.outer,
            bestWidth: best.width,
        },
    };
}

/** The minimum width annulus module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An annulus is the region between two circles that share a center. To make it as thin as possible, slide the center until at least two constraints hold: either two points sit on the outer circle, two on the inner circle, or one of each. Those alignments happen exactly at midpoints of point pairs and circumcenters of point triples, so a finite candidate list suffices.",
        invariants: [
            "Every input point lies between the inner and outer radii of the current center.",
            "The width is always the outer radius minus the inner radius and is nonnegative.",
            "The best width never increases as more candidate centers are checked.",
        ],
        correctness:
            "For a fixed center the tightest annulus uses the nearest and farthest point as its radii. If a center is not a midpoint or circumcenter, a small move reduces the radial spread until either two points become equidistant on the same circle or a nearest and farthest point coincide in distance, which corresponds to one of the enumerated candidates. Scanning all candidates therefore returns the global minimum width.",
        complexityRationale:
            "There are O(n^2) midpoints and O(n^3) circumcenters, and scoring each against all n points costs O(n), for O(n^4) time. Only a constant number of buffers and the candidate list are kept, so space is O(n^3) in the worst case for the explicit list, or O(n) if candidates are streamed.",
        uses: [
            "Robust fitting of circular boundaries with measurement noise",
            "Detecting whether sampled points lie near a common circle",
            "Computer-aided design tolerance analysis for concentric rings",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, exercises on annuli",
            "Eppstein, Quasi-linear-time minimum width annulus, 1996",
        ],
        workedExample:
            "For points at angles 0, 90, 180 and 270 degrees on a radius-5 circle, the circumcenter of any triple is (0,0), where the inner and outer radii are both 5. The width is zero, correctly showing that the points are exactly concyclic.",
    },
    id: "minimum-width-annulus",
    name: "Minimum Width Annulus",
    category: "geometry",
    complexity: { time: "O(n^4)", space: "O(n^3)" },
    defaultInput: {
        points: [[5, 0], [0, 5], [-5, 0], [0, -5], [3.5, 3.5], [-4, 2]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect the midpoint of every pair of points",
        "collect the circumcenter of every triple of points",
        "for each candidate center compute nearest and farthest distances",
        "record the center with the smallest radial spread",
        "report the inner radius, outer radius and their difference",
    ],
};

export default module;
