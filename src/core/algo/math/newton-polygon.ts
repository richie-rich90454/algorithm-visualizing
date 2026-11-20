/**
 * newton-polygon.ts - Newton polygon of a polynomial at a prime.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a prime p, the Newton polygon of a polynomial is the lower convex hull
 * of the points (i, v_p(a_i)) for every nonzero coefficient. Its side slopes
 * encode the p-adic valuations of the roots: a side of slope -h/l contributes
 * roots of valuation h/l. The module builds the hull with a monotone chain.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d log d) for a polynomial of degree d
 *   Space: O(d)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each nonzero coefficient is a point at (index, valuation).
 *   - Hull vertices turn green and hull sides are drawn as edges.
 *   - The final caption lists the side slopes.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function valuation(n: number, p: number): number {
    let value = Math.abs(n);
    if (value === 0) return Infinity;
    let count = 0;
    while (value % p === 0) {
        value /= p;
        count += 1;
    }
    return count;
}

/** Monotone-chain lower convex hull of points sorted by x. */
function lowerHull(points: Point[]): Point[] {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length <= 2) return sorted;
    const cross = (o: Point, a: Point, b: Point): number =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const hull: Point[] = [];
    for (const point of sorted) {
        while (hull.length >= 2 && cross(hull[hull.length - 2] as Point, hull[hull.length - 1] as Point, point) <= 0) {
            hull.pop();
        }
        hull.push(point);
    }
    return hull;
}

function build(points: Point[], hull: Point[], phase: "points" | "scan" | "done", activeIndex: number) {
    const hullKeys = new Set(hull.map((p) => `${p[0]}:${p[1]}`));
    const entities: VisualEntity[] = points.map((point, index) => ({
        id: `point-${index}`,
        type: "node",
        label: `(${point[0]}, ${point[1]})`,
        value: point,
        state: hullKeys.has(`${point[0]}:${point[1]}`) && phase !== "points" ? "sorted" : phase === "scan" && index === activeIndex ? "active" : "idle",
        x: point[0],
        y: point[1],
        width: 0,
        height: 0,
        metadata: { index: point[0], valuation: point[1] },
    }));
    const ids = new Map(points.map((point, index) => [`${point[0]}:${point[1]}`, `point-${index}`]));
    const edges: VisualEdge[] = [];
    if (phase !== "points") {
        for (let i = 0; i + 1 < hull.length; i += 1) {
            const sourceId = ids.get(`${hull[i]?.[0]}:${hull[i]?.[1]}`);
            const targetId = ids.get(`${hull[i + 1]?.[0]}:${hull[i + 1]?.[1]}`);
            if (sourceId && targetId) {
                edges.push({
                    id: `hull-${i}`,
                    sourceId,
                    targetId,
                    label: `slope ${(hull[i + 1]![1] - hull[i]![1]) / (hull[i + 1]![0] - hull[i]![0])}`,
                    state: "path",
                    directed: false,
                });
            }
        }
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { prime?: number; coefficients?: number[] } | null) ?? {};
    const p = task.prime ?? 2;
    const coefficients = task.coefficients ?? [8, 0, 2, 1];
    const points: Point[] = [];
    coefficients.forEach((coefficient, index) => {
        if (coefficient !== 0) points.push([index, valuation(coefficient, p)]);
    });
    const hull = lowerHull(points);
    let step = 0;

    const initial = build(points, hull, "points", -1);
    yield {
        stepNumber: step++,
        entities: initial.entities,
        edges: [],
        description: `Valuations of ${coefficients.length} coefficients at p = ${p}; ${points.length} nonzero points to process.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { prime: p, points, hull: [], slopes: [] },
    };

    for (let i = 0; i < points.length; i += 1) {
        const scan = build(points, hull, "scan", i);
        yield {
            stepNumber: step++,
            entities: scan.entities,
            edges: [],
            description: `Scanning point (${points[i]?.[0]}, ${points[i]?.[1]}); discard it when it bends above the lower chain.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { prime: p, points, hull: [], active: points[i] },
        };
    }

    const slopes: number[] = [];
    for (let i = 0; i + 1 < hull.length; i += 1) {
        slopes.push((hull[i + 1]![1] - hull[i]![1]) / (hull[i + 1]![0] - hull[i]![0]));
    }
    const done = build(points, hull, "done", -1);
    yield {
        stepNumber: step,
        entities: done.entities,
        edges: done.edges,
        description: `Newton polygon has ${hull.length} vertex/vertices with slopes ${slopes.join(", ") || "none"}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { prime: p, points, hull, slopes },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Replace each coefficient by the exponent of the prime dividing it and plot those exponents against the coefficient index. The lower outline of these points is the Newton polygon; a steep downward side means high-valuation roots.",
        invariants: [
            "Only nonzero coefficients contribute points, since their valuations are infinite.",
            "The lower hull is convex, so its side slopes are nondecreasing.",
            "Every plotted point lies on or above the hull.",
        ],
        correctness:
            "The monotone-chain construction keeps exactly the vertices of the lower convex hull: a middle point is removed whenever it lies on or above the segment joining its neighbors. The resulting chain is convex and every discarded point is above it, so it is the lower convex hull by definition. The slopes are the quotients of valuation differences by index differences.",
        complexityRationale:
            "Extracting valuations costs O(d log n) for coefficient magnitude n, sorting the d points costs O(d log d), and the monotone-chain scan is linear, giving O(d log d) after valuation extraction and O(d) space.",
        uses: [
            "Computing p-adic root valuations of a polynomial",
            "Choosing the Newton polygon step in the Newton-Puiseux algorithm",
            "Analyzing ramification in local fields",
        ],
        references: [
            "Ribenboim, Algebraic Numbers, chapter on Newton polygons",
            "Cohen, A Course in Computational Algebraic Number Theory, section 4.3",
        ],
        workedExample:
            "For p = 2 and coefficients 8, 0, 2, 1 the valuations are 3, infinite, 1, 0. The nonzero points (0,3), (2,1), (3,0) are collinear on a line of slope -1, so the lower hull is the single side from (0,3) to (3,0), indicating roots of valuation 1/3.",
    },
    id: "newton-polygon",
    name: "Newton Polygon",
    category: "math",
    complexity: { time: "O(d log d)", space: "O(d)" },
    defaultInput: { prime: 2, coefficients: [8, 0, 2, 1] },
    visualType: "point",
    run,
    pseudocode: [
        "given a prime p and polynomial coefficients a_i",
        "for each nonzero coefficient compute v_p(a_i)",
        "form the point (i, v_p(a_i)) for each nonzero coefficient",
        "sort the points by their index coordinate",
        "build the lower convex hull with a monotone chain",
        "pop the middle point while the chain bends upward",
        "report the hull vertices and their side slopes",
    ],
};

export default module;
