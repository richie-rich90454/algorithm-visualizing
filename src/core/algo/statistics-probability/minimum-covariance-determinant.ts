/**
 * minimum-covariance-determinant.ts - Minimum Covariance Determinant
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The minimum covariance determinant estimator finds the subset of h data
 * points whose sample covariance has the smallest determinant. By concentrating
 * on the tightest cloud of points it resists outliers that would inflate a
 * covariance matrix computed from every observation. This module evaluates all
 * h-subsets exhaustively for small data sets and reports the winning subset and
 * covariance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C(n, h) * (h * p^2 + p^3)) for exhaustive subset search
 *   Space: O(p^2 + C(n, h)) for the covariance and stored determinants
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per evaluated subset shows its covariance determinant.
 *   - The best subset so far is highlighted in green.
 *   - The final frame reports the winning subset, mean, and covariance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

/** Determinant of a small square matrix by Gaussian elimination. */
function determinant(matrix: Matrix): number {
    const n = matrix.length;
    const a = matrix.map((row) => [...row]);
    let det = 1;
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] as number) > Math.abs(a[pivot]?.[col] as number)) pivot = r;
        }
        if (Math.abs(a[pivot]?.[col] as number) < 1e-14) return 0;
        if (pivot !== col) {
            const temp = a[col];
            a[col] = a[pivot] as number[];
            a[pivot] = temp as number[];
            det = -det;
        }
        const diag = a[col]?.[col] as number;
        det *= diag;
        for (let r = col + 1; r < n; r += 1) {
            const factor = (a[r]?.[col] as number) / diag;
            for (let c = col; c < n; c += 1) a[r]![c] = (a[r]![c] as number) - factor * (a[col]![c] as number);
        }
    }
    return det;
}

/** Mean and maximum-likelihood covariance of a subset of points. */
function subsetStats(points: number[][], indices: number[]): { mean: number[]; cov: Matrix } {
    const p = points[0]?.length ?? 0;
    const mean = new Array<number>(p).fill(0);
    for (const i of indices) {
        const point = points[i] as number[];
        for (let j = 0; j < p; j += 1) mean[j] = mean[j] as number + (point[j] as number) / indices.length;
    }
    const cov: Matrix = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (const i of indices) {
        const point = points[i] as number[];
        for (let a = 0; a < p; a += 1) {
            for (let b = 0; b < p; b += 1) {
                cov[a]![b] = cov[a]![b] as number + ((point[a] as number) - (mean[a] as number)) * ((point[b] as number) - (mean[b] as number)) / indices.length;
            }
        }
    }
    return { mean, cov };
}

/** Enumerate index combinations of size h from 0..n-1. */
function combinations(n: number, h: number): number[][] {
    const result: number[][] = [];
    const current: number[] = [];
    const visit = (start: number): void => {
        if (current.length === h) {
            result.push([...current]);
            return;
        }
        for (let i = start; i <= n - (h - current.length); i += 1) {
            current.push(i);
            visit(i + 1);
            current.pop();
        }
    };
    visit(0);
    return result;
}

function makeBars(values: number[], current: number, best: number): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = index === best ? "sorted" : index === current ? "comparing" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toExponential(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, determinant: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: number[][]; h?: number } | null) ?? {};
    const points = task.points ?? [
        [0, 0], [0.2, 0.1], [0.1, 0.2], [0.3, 0.1], [0.2, 0.3], [10, 10],
    ];
    const n = Math.min(14, points.length);
    const h = typeof task.h === "number" ? Math.max(2, Math.min(n, Math.floor(task.h))) : Math.max(2, n - 1);
    const subsetList = combinations(n, h);
    const determinants: number[] = [];
    let bestDet = Infinity;
    let bestIndex = -1;
    let bestSubset: number[] = [];
    let bestMean: number[] = [];
    let bestCov: Matrix = [];

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Searching ${subsetList.length} subsets of size ${h} for the smallest covariance determinant.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, h, subsetCount: subsetList.length, determinants: [], bestSubset: [], bestDet: null, bestMean: [], bestCov: [], complete: false },
    };
    let step = 1;
    for (let index = 0; index < subsetList.length; index += 1) {
        const subset = subsetList[index] as number[];
        const stats = subsetStats(points, subset);
        const det = determinant(stats.cov);
        determinants.push(det);
        if (det < bestDet) {
            bestDet = det;
            bestIndex = index;
            bestSubset = subset;
            bestMean = stats.mean;
            bestCov = stats.cov;
        }
        yield {
            stepNumber: step,
            entities: makeBars(determinants, index, bestIndex),
            edges: [],
            description: `Subset ${index + 1}: determinant ${det.toExponential(3)}, best ${bestDet.toExponential(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, h, subsetCount: subsetList.length, determinants: [...determinants], bestSubset: [...bestSubset], bestDet, bestMean: [...bestMean], bestCov: bestCov.map((row) => [...row]), complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(determinants, subsetList.length, bestIndex),
        edges: [],
        description: `Search complete: subset [${bestSubset.join(", ")}] has determinant ${bestDet.toExponential(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, h, subsetCount: subsetList.length, determinants, bestSubset, bestDet, bestMean, bestCov, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single outlier can make an ordinary covariance matrix wildly too large. The minimum covariance determinant estimator searches for a compact group of points and uses only those to estimate center and spread. The determinant measures the volume of the confidence ellipse, so minimizing it finds the tightest cluster.",
        invariants: [
            "Every evaluated subset has exactly h distinct points.",
            "The covariance of a subset is symmetric and positive semidefinite.",
            "The reported determinant is the smallest among all evaluated subsets.",
        ],
        correctness:
            "Enumerating all h-subsets guarantees that the global minimum determinant is found. For each subset the sample mean and maximum-likelihood covariance are computed directly, and Gaussian elimination with partial pivoting evaluates the determinant. Because the estimator returns the subset with the smallest covariance volume, no other subset has a smaller determinant.",
        complexityRationale:
            "There are choose(n, h) subsets; for each, forming the covariance takes O(h times p squared) and its determinant takes O(p cubed), giving the stated total. Storing the determinant list uses O(choose(n, h)) space, and the solver keeps one covariance matrix.",
        uses: [
            "Robust outlier detection in multivariate data",
            "Estimating a reliable covariance matrix for anomaly detection",
            "Preprocessing for robust principal component analysis",
        ],
        references: [
            "Rousseeuw and Van Driessen, A Fast Algorithm for the Minimum Covariance Determinant Estimator, Technometrics 41, 1999",
            "Maronna, Martin, and Yohai, Robust Statistics: Theory and Methods, Chapter 6",
        ],
        workedExample:
            "With five points near the origin and one far outlier at (10, 10), choosing h equal to five lets the estimator discard the outlier. The winning subset's covariance determinant is tiny compared with the determinant of the covariance of all six points, so the estimate stays close to the origin.",
    },
    id: "minimum-covariance-determinant",
    name: "Minimum Covariance Determinant",
    category: "statistics-probability",
    complexity: { time: "O(C(n,h) * (h * p^2 + p^3))", space: "O(p^2 + C(n,h))" },
    defaultInput: {
        points: [
            [0, 0], [0.2, 0.1], [0.1, 0.2], [0.3, 0.1], [0.2, 0.3], [10, 10],
        ],
        h: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the point cloud and the subset size h",
        "enumerate every subset of h points",
        "for each subset compute its sample mean and covariance",
        "compute the determinant of the covariance by Gaussian elimination",
        "record the determinant and remember the smallest one",
        "after all subsets report the winning subset, mean, and covariance",
        "done: return the robust center and scatter estimate",
    ],
};

export default module;
