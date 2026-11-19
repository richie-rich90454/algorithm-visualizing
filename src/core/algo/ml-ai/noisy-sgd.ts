/**
 * noisy-sgd.ts - SGD with Gradient Noise on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Noisy SGD adds a small zero-mean Gaussian perturbation to the gradient before
 * each update. The injected noise acts as an implicit regularizer, helping the
 * iterate escape shallow saddles and favor flat minima. A seeded pseudo-random
 * generator makes the noise reproducible, so the visualization replays exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n) for n training points
 *   Space: O(n) for the stored points and drawn entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted in the plane.
 *   - The fitted line endpoints move as the noisy updates accumulate.
 *   - Meta records the noise added to each parameter on the latest step.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Mean loss and gradient of the least-squares line. */
function gradient(points: Point[], w: number, b: number) {
    let dw = 0;
    let db = 0;
    let loss = 0;
    for (const [x, y] of points) {
        const err = w * x + b - y;
        dw += err * x;
        db += err;
        loss += 0.5 * err * err;
    }
    const n = Math.max(1, points.length);
    return { dw: dw / n, db: db / n, loss: loss / n };
}

/** Deterministic mulberry32 generator so the noise is reproducible. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** One standard normal draw using the Box-Muller transform. */
function gaussian(rng: () => number): number {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeEntities(points: Point[], w: number, b: number): VisualEntity[] {
    const entities: VisualEntity[] = points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `${x},${y}`,
        value: [x, y],
        state: (Math.abs(w * x + b - y) < 0.5 ? "sorted" : "unvisited") as EntityState,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, x, y },
    }));
    const xs = points.map((point) => point[0]);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 1;
    entities.push({
        id: "fit-start",
        type: "node",
        label: "line",
        value: [minX, w * minX + b],
        state: "pivot",
        x: minX,
        y: w * minX + b,
        width: 0,
        height: 0,
        metadata: { line: true, end: 0 },
    });
    entities.push({
        id: "fit-end",
        type: "node",
        label: "line",
        value: [maxX, w * maxX + b],
        state: "pivot",
        x: maxX,
        y: w * maxX + b,
        width: 0,
        height: 0,
        metadata: { line: true, end: 1 },
    });
    return entities;
}

const fitEdge: VisualEdge = {
    id: "fit-line",
    sourceId: "fit-start",
    targetId: "fit-end",
    label: "y = wx + b",
    state: "path",
    directed: false,
};

/** The noisy-SGD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
            sigma?: number;
            seed?: number;
            epochs?: number;
        } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 9],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.02;
    const sigma = typeof task.sigma === "number" && task.sigma >= 0 ? task.sigma : 0.4;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 42;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const rng = makeRng(seed);

    let w = 0;
    let b = 0;
    let noiseW = 0;
    let noiseB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `Noisy SGD on ${points.length} points, rate ${learningRate}, noise ${sigma}, seed ${seed}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, noiseW, noiseB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        noiseW = sigma * gaussian(rng);
        noiseB = sigma * gaussian(rng);
        w -= learningRate * (grad.dw + noiseW);
        b -= learningRate * (grad.db + noiseB);
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: additive noise ${noiseW.toFixed(3)}/${noiseB.toFixed(3)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, noiseW, noiseB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} noisy SGD updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, noiseW, noiseB, initialLoss },
    };
}

/** The noisy-SGD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain gradient descent follows the steepest local direction exactly, which can get stuck near a saddle or settle in a sharp minimum. Adding a small amount of random noise to each gradient turns the trajectory into a stochastic process that wanders out of shallow traps and tends to favor flatter regions that generalize better.",
        invariants: [
            "The injected noise has mean zero, so it does not bias the expected gradient.",
            "The seeded generator produces an identical noise sequence on every replay.",
            "The noise magnitude is controlled by a single standard deviation parameter.",
        ],
        correctness:
            "Because the noise has zero mean, the expected update equals the true SGD update, so the descent guarantee is preserved in expectation. The variance term vanishes as the learning rate decreases, which lets the iterate converge to a neighborhood of the minimizer whose size is proportional to the noise level.",
        complexityRationale:
            "Each epoch computes the gradient over n points, draws a constant number of Gaussian samples and updates the parameters, so time is O(epochs * n). A single PRNG state is the only extra storage, leaving space at O(n) for the data.",
        uses: [
            "Escaping saddle points in nonconvex training",
            "Implicit regularization to favor flat minima",
            "Stochastic gradient Langevin dynamics and Bayesian training",
        ],
        references: [
            "Robbins and Monro, A Stochastic Approximation Method, 1951",
            "Welling and Teh, Bayesian Learning via Stochastic Gradient Langevin Dynamics, 2011",
        ],
        workedExample:
            "On the line data the slope gradient is minus fourteen at the start. A draw of plus one from the noise distribution with standard deviation 0.4 changes that gradient to minus thirteen point six, so the step is slightly smaller. Across many epochs the noise sometimes speeds and sometimes slows progress, but the trend follows the true gradient.",
    },
    id: "noisy-sgd",
    name: "Noisy SGD",
    category: "ml-ai",
    complexity: { time: "O(epochs * n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 1],
            [1, 3],
            [2, 5],
            [3, 7],
            [4, 9],
        ],
        learningRate: 0.02,
        sigma: 0.4,
        seed: 42,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and a seeded random generator",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "draw Gaussian noise with the chosen standard deviation for each parameter",
        "add the noise to the gradient",
        "subtract learning rate times the noisy gradient from each parameter",
        "done: report the fitted line and final loss",
    ],
};

export default module;
