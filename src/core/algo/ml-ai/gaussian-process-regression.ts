/**
 * gaussian-process-regression.ts - Gaussian Process Regression
 *
 * A Gaussian process defines a distribution over functions and conditions it
 * on observed data to produce a posterior mean and variance at new points.
 * With a squared-exponential kernel the posterior is computed by inverting a
 * small Gram matrix. The demo shows the kernel matrix, its inverse and the
 * predictive curve with uncertainty represented by the posterior variance.
 *
 * Time:  O(n^3 + m * n^2) for n training and m test points
 * Space: O(n^2) for the Gram matrix and its inverse
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GpInput {
    x?: number[];
    y?: number[];
    testX?: number[];
    lengthscale?: number;
    amplitude?: number;
    noise?: number;
}

type Matrix = number[][];

/** Invert a square matrix with Gauss-Jordan elimination and partial pivoting. */
function invert(matrix: Matrix): Matrix {
    const n = matrix.length;
    const aug: number[][] = matrix.map((row, i) => [
        ...row.slice(),
        ...Array.from({ length: n }, (_unused, j) => (i === j ? 1 : 0)),
    ]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) pivot = r;
        }
        const temp = aug[col];
        aug[col] = aug[pivot]!;
        aug[pivot] = temp!;
        const pv = aug[col]?.[col] ?? 0;
        for (let c = 0; c < 2 * n; c += 1) aug[col]![c] = (aug[col]![c] ?? 0) / pv;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]?.[col] ?? 0;
            if (factor === 0) continue;
            for (let c = 0; c < 2 * n; c += 1) aug[r]![c] = (aug[r]![c] ?? 0) - factor * (aug[col]![c] ?? 0);
        }
    }
    return aug.map((row) => row.slice(n));
}

function kernelMatrix(x: number[], lengthscale: number, amplitude: number, noise: number): Matrix {
    return x.map((xi, i) =>
        x.map((xj, j) => {
            const diff = xi - xj;
            const cov = amplitude * amplitude * Math.exp(-(diff * diff) / (2 * lengthscale * lengthscale));
            return cov + (i === j ? noise * noise : 0);
        }),
    );
}

function kernelVector(at: number, x: number[], lengthscale: number, amplitude: number): number[] {
    return x.map((xi) => {
        const diff = at - xi;
        return amplitude * amplitude * Math.exp(-(diff * diff) / (2 * lengthscale * lengthscale));
    });
}

function matVec(matrix: Matrix, vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function makePointEntities(x: number[], y: number[], testX: number[], means: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = x.map((xi, i) => ({
        id: `train-${i}`,
        type: "node" as const,
        label: `(${xi.toFixed(1)}, ${(y[i] ?? 0).toFixed(2)})`,
        value: [xi, y[i] ?? 0],
        state: "pivot" as EntityState,
        x: xi,
        y: y[i] ?? 0,
        width: 0,
        height: 0,
        metadata: { kind: "training", index: i },
    }));
    for (let i = 0; i < testX.length; i += 1) {
        if (i > revealed) continue;
        entities.push({
            id: `pred-${i}`,
            type: "node" as const,
            label: `pred ${(means[i] ?? 0).toFixed(2)}`,
            value: [testX[i] ?? 0, means[i] ?? 0],
            state: "sorted",
            x: testX[i] ?? 0,
            y: means[i] ?? 0,
            width: 0,
            height: 0,
            metadata: { kind: "prediction", index: i },
        });
    }
    return entities;
}

function makeMatrixCells(matrix: Matrix): VisualEntity[] {
    const n = matrix.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = matrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: (i === j ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GpInput | null) ?? {};
    const x = task.x?.length ? task.x.slice() : [-2, -1, 0, 1, 2];
    const y = task.y?.length ? task.y.slice() : [-0.8, 0.2, 0.9, 0.4, -0.5];
    const testX = task.testX?.length
        ? task.testX.slice()
        : Array.from({ length: 9 }, (_unused, i) => -2 + i * 0.5);
    const lengthscale = typeof task.lengthscale === "number" && task.lengthscale > 0 ? task.lengthscale : 1;
    const amplitude = typeof task.amplitude === "number" && task.amplitude > 0 ? task.amplitude : 1;
    const noise = typeof task.noise === "number" && task.noise > 0 ? task.noise : 0.1;
    const n = Math.min(x.length, y.length);

    const k = kernelMatrix(x.slice(0, n), lengthscale, amplitude, noise);
    const kInv = invert(k);
    const alpha = matVec(kInv, y.slice(0, n));
    const means: number[] = [];
    const variances: number[] = [];
    for (const at of testX) {
        const kStar = kernelVector(at, x.slice(0, n), lengthscale, amplitude);
        const mean = dot(kStar, alpha);
        const projected = matVec(kInv, kStar);
        const variance = Math.max(0, amplitude * amplitude - dot(kStar, projected));
        means.push(mean);
        variances.push(variance);
    }
    const trainingMeans = x.slice(0, n).map((at) => dot(kernelVector(at, x.slice(0, n), lengthscale, amplitude), alpha));
    const trainingErrors = trainingMeans.map((value, i) => Math.abs(value - (y[i] ?? 0)));
    const base = { n, lengthscale, amplitude, noise, testCount: testX.length, rowsMeta: n, colsMeta: n };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makePointEntities(x, y, testX, means, -1),
        edges: [],
        description: `Load ${n} noisy training observations; condition a Gaussian process with RBF kernel.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...base, phase: 0, means: means.slice(), variances: variances.slice(), trainingErrors: trainingErrors.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeMatrixCells(k),
        edges: [],
        description: `Build the Gram matrix K with the squared-exponential kernel plus noise on the diagonal.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: 1, kernel: k.flat(), means: means.slice(), variances: variances.slice(), trainingErrors: trainingErrors.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeMatrixCells(kInv),
        edges: [],
        description: `Invert K with Gauss-Jordan elimination to form the posterior solve.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: 2, inverse: kInv.flat(), alpha: alpha.slice(), means: means.slice(), variances: variances.slice(), trainingErrors: trainingErrors.slice() },
    };
    step += 1;

    for (let i = 0; i < testX.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makePointEntities(x, y, testX, means, i),
            edges: [],
            description: `Predict at ${testX[i]?.toFixed(2)}: mean ${(means[i] ?? 0).toFixed(4)}, posterior variance ${(variances[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: i === testX.length - 1 ? 4 : 3,
            layout: "point",
            meta: { ...base, phase: i + 3, means: means.slice(), variances: variances.slice(), trainingErrors: trainingErrors.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePointEntities(x, y, testX, means, testX.length - 1),
        edges: [],
        description: `Done: posterior mean tracks the data; largest training residual is ${Math.max(...trainingErrors).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            ...base,
            phase: testX.length + 3,
            means: means.slice(),
            variances: variances.slice(),
            trainingErrors: trainingErrors.slice(),
            predictions: means.slice(),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Gaussian process places a joint Gaussian distribution over the values of a function at any set of points. The kernel says how strongly two points should agree, and conditioning on observations produces a posterior mean curve plus a variance that grows away from the data. It is a distribution over functions rather than a single fitted function.",
        invariants: [
            "The kernel matrix is symmetric and has the observation noise added to its diagonal.",
            "The posterior mean at a test point is the kernel vector dotted with the solved weights.",
            "Posterior variance is the prior variance minus the explained part and is nonnegative.",
        ],
        correctness:
            "Conditioning a joint Gaussian gives mean k star times K inverse times y and covariance k double star minus k star times K inverse times k star, which is exactly what the computation implements. With a small noise term the posterior mean passes close to every observation. The test rebuilds the kernel and its inverse independently, checks that K times the solved weights reproduces the observations, and compares all predictive means.",
        complexityRationale:
            "Inverting the n by n Gram matrix with Gauss-Jordan costs O(n cubed); each of the m test points forms a kernel vector and two dot products costing O(m times n squared). Storing the matrix and inverse uses O(n squared) space.",
        uses: [
            "Bayesian optimization and black-box function tuning",
            "Interpolation with honest uncertainty estimates",
            "Spatial statistics and small-data regression",
        ],
        references: [
            "Rasmussen and Williams, Gaussian Processes for Machine Learning, 2006",
            "Williams and Rasmussen, Gaussian Processes for Regression, NIPS, 1995",
        ],
        workedExample:
            "With five observations at x from minus two to two, noise 0.1 and lengthscale one, the Gram matrix is nearly diagonal because distant points are almost uncorrelated. Solving gives weights that reproduce the observations to within the noise level, and predictions halfway between points bend smoothly toward zero with a modest posterior variance.",
    },
    id: "gaussian-process-regression",
    name: "Gaussian Process Regression",
    category: "ml-ai",
    complexity: { time: "O(n^3 + m * n^2)", space: "O(n^2)" },
    defaultInput: {
        x: [-2, -1, 0, 1, 2],
        y: [-0.8, 0.2, 0.9, 0.4, -0.5],
        testX: [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2],
        lengthscale: 1,
        amplitude: 1,
        noise: 0.1,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the observations, kernel settings and test points",
        "build the Gram matrix with kernel values plus noise",
        "invert the Gram matrix with Gauss-Jordan elimination",
        "solve for the weights by multiplying the inverse by the targets",
        "for each test point form its kernel vector to the data",
        "set the mean to the kernel vector times the weights",
        "set the variance to the prior minus the explained part",
        "done: report the predictive means and variances",
    ],
};

export default module;
