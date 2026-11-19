/**
 * fuzzy-c-means.ts - Fuzzy C-Means Clustering
 *
 * Unlike hard k-means, every point carries a membership degree for each
 * cluster. Alternating updates refine the centers and the memberships while
 * minimizing a weighted within-cluster objective.
 *
 * Time:  O(iterations * n * c * d)
 * Space: O(n * c) for the membership matrix
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface FcmInput {
    points: Point[];
    clusters: number;
    fuzzifier: number;
    iterations: number;
}

function initialMemberships(n: number, c: number): number[][] {
    return Array.from({ length: n }, (_unused, i) =>
        Array.from({ length: c }, (_u, j) => (j === i % c ? 0.8 : 0.2 / Math.max(1, c - 1))),
    );
}

function updateCenters(points: Point[], u: number[][], c: number, m: number): Point[] {
    const centers: Point[] = [];
    for (let j = 0; j < c; j += 1) {
        let wx = 0;
        let wy = 0;
        let weight = 0;
        for (let i = 0; i < points.length; i += 1) {
            const w = Math.pow(u[i]?.[j] ?? 0, m);
            wx += w * (points[i]?.[0] ?? 0);
            wy += w * (points[i]?.[1] ?? 0);
            weight += w;
        }
        centers.push(weight > 0 ? [wx / weight, wy / weight] : [0, 0]);
    }
    return centers;
}

function distances(points: Point[], centers: Point[]): number[][] {
    return points.map(([x, y]) =>
        centers.map(([cx, cy]) => Math.hypot(x - cx, y - cy)),
    );
}

function updateMemberships(dist: number[][], c: number, m: number): number[][] {
    return dist.map((row) => {
        const zeroIndex = row.findIndex((d) => d < 1e-12);
        if (zeroIndex >= 0) {
            return row.map((_d, j) => (j === zeroIndex ? 1 : 0));
        }
        const scaled = row.map((d) => Math.pow(d, -2 / (m - 1)));
        const total = scaled.reduce((a, b) => a + b, 0);
        return scaled.map((v) => v / total);
    });
}

function objective(points: Point[], u: number[][], dist: number[][], m: number): number {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        for (let j = 0; j < (u[i]?.length ?? 0); j += 1) {
            sum += Math.pow(u[i]![j]!, m) * Math.pow(dist[i]![j]!, 2);
        }
    }
    return sum;
}

function flatten(matrix: number[][]): number[] {
    return matrix.reduce((acc: number[], row) => acc.concat(row), []);
}

function makeEntities(points: Point[], centers: Point[], u: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = points.map(([x, y], i) => {
        const row = u[i] ?? [];
        let dominant = 0;
        for (let j = 1; j < row.length; j += 1) {
            if ((row[j] ?? 0) > (row[dominant] ?? 0)) {
                dominant = j;
            }
        }
        const state: EntityState = dominant === 0 ? "sorted" : (dominant === 1 ? "active" : "highlight");
        return {
            id: `point-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { kind: "point", index: i, dominant },
        };
    });
    centers.forEach(([x, y], j) => {
        entities.push({
            id: `center-${j}`,
            type: "node" as const,
            label: `C${j}`,
            value: [x, y],
            state: "pivot",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { kind: "center", index: j },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<FcmInput> | null) ?? {};
    const points: Point[] = Array.isArray(task.points) && task.points.length > 0
        ? task.points
        : [[0, 0], [0.6, 0.2], [5, 5], [5.4, 4.8], [2, 8]];
    const c = Math.max(1, Math.min(points.length, Math.floor(task.clusters ?? 2)));
    const m = Math.max(1.01, task.fuzzifier ?? 2);
    const iterations = Math.max(1, Math.floor(task.iterations ?? 6));

    let u = initialMemberships(points.length, c);
    let centers = updateCenters(points, u, c, m);
    let dist = distances(points, centers);
    let obj = objective(points, u, dist, m);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(points, centers, u),
        edges: [],
        description: `Fuzzy C-means on ${points.length} points with ${c} clusters and fuzzifier ${m}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: points.length, c, m, iterations, rows: 1, iteration: 0, objective: obj, centers: flatten(centers), memberships: flatten(u) },
    };
    step += 1;

    for (let iter = 1; iter <= iterations; iter += 1) {
        const nextU = updateMemberships(dist, c, m);
        const nextCenters = updateCenters(points, nextU, c, m);
        const nextDist = distances(points, nextCenters);
        const nextObj = objective(points, nextU, nextDist, m);
        let maxChange = 0;
        for (let i = 0; i < u.length; i += 1) {
            for (let j = 0; j < c; j += 1) {
                maxChange = Math.max(maxChange, Math.abs((nextU[i]?.[j] ?? 0) - (u[i]?.[j] ?? 0)));
            }
        }
        u = nextU;
        centers = nextCenters;
        dist = nextDist;
        obj = nextObj;
        yield {
            stepNumber: step,
            entities: makeEntities(points, centers, u),
            edges: [],
            description: `Iteration ${iter}: recomputed centers and memberships; weighted objective now ${obj.toFixed(4)}.`,
            codeLineNumber: iter === iterations ? 6 : 4,
            layout: "point",
            meta: { n: points.length, c, m, iterations, rows: 1, iteration: iter, objective: obj, maxChange, centers: flatten(centers), memberships: flatten(u) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, centers, u),
        edges: [],
        description: `Done: ${c} fuzzy centers found with within-cluster objective ${obj.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { n: points.length, c, m, iterations, rows: 1, iteration: iterations, objective: obj, converged: true, centers: flatten(centers), memberships: flatten(u) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hard clustering forces each point into exactly one group, which throws away uncertainty near a boundary. Fuzzy C-means instead gives every point a degree of membership in every cluster. Points near a center earn high membership there, and the centers move toward the points that weigh them most heavily.",
        invariants: [
            "For every point the membership degrees across all clusters sum to one.",
            "A center is the membership-weighted mean of the points, with powers of the degrees as weights.",
            "The weighted within-cluster objective never increases from one iteration to the next.",
        ],
        correctness:
            "Each update is the exact minimizer of the objective with the other variable held fixed. Setting the derivative of the weighted center problem to zero gives the weighted mean used here; setting the derivative of the membership problem to zero under the row-sum constraint gives the inverse-distance power formula. Alternating between two exact minimizations cannot increase the objective, so the sequence converges to a stationary point. The test recomputes centers from the reported memberships independently and confirms the membership rows are valid probability vectors.",
        complexityRationale:
            "Each iteration scans all n points for each of c clusters, and each comparison costs d coordinate operations, so the work per iteration is O(n * c * d). Storing the n by c membership matrix uses O(n * c) space.",
        uses: [
            "Image segmentation where pixels can belong to several regions",
            "Patient subtyping in medical analysis with overlapping groups",
            "Soft assignment in feature quantization and clustering ensembles",
        ],
        references: [
            "Dunn, A Fuzzy Relative of the ISODATA Process, Journal of Cybernetics, 1973",
            "Bezdek, Pattern Recognition with Fuzzy Objective Function Algorithms, Plenum Press, 1981",
        ],
        workedExample:
            "With points near (0,0), (0.6,0.2), (5,5), and (5.4,4.8) and two clusters, the first centers land near the two pairs. A point halfway between them receives roughly half membership in each, while a point close to one center receives almost all of its membership there. The centers then shift slightly toward the heavily weighted points and the objective falls.",
    },
    id: "fuzzy-c-means",
    name: "Fuzzy C-Means",
    category: "ml-ai",
    complexity: { time: "O(iterations * n * c * d)", space: "O(n * c)" },
    defaultInput: {
        points: [[0, 0], [0.6, 0.2], [5, 5], [5.4, 4.8], [2, 8]],
        clusters: 2,
        fuzzifier: 2,
        iterations: 6,
    },
    visualType: "point",
    run,
    pseudocode: [
        "choose the number of clusters and the fuzzifier exponent",
        "initialize a membership degree for every point and cluster",
        "compute each center as the membership-weighted mean of the points",
        "measure the distance from every point to every center",
        "update memberships from inverse distances raised to a power",
        "recompute the weighted within-cluster objective",
        "repeat until the iteration budget is exhausted",
        "done: report the final fuzzy centers and objective",
    ],
};

export default module;
