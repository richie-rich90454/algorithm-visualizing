/**
 * lookahead-optimizer.ts - Lookahead Optimizer on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lookahead keeps two sets of weights: fast weights that an inner optimizer
 * updates many times, and slow weights that are pulled toward the fast ones
 * once per outer step. The slow weights are the ones used for prediction. This
 * interpolation smooths the noisy inner trajectory and often improves
 * generalization. The demo fits a two-parameter least-squares line.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * k * n) for k inner steps and n training points
 *   Space: O(n) for the stored points and drawn entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted in the plane.
 *   - The fitted line shows the slow weights after each outer interpolation.
 *   - Meta records both the slow and fast weights and the interpolation factor.
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

/** The Lookahead generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            innerRate?: number;
            alpha?: number;
            k?: number;
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
    const innerRate =
        typeof task.innerRate === "number" && task.innerRate > 0 ? task.innerRate : 0.05;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.5;
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : 5;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;

    let slowW = 0;
    let slowB = 0;
    let fastW = slowW;
    let fastB = slowB;
    const initialLoss = gradient(points, slowW, slowB).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, slowW, slowB),
        edges: [fitEdge],
        description: `Lookahead on ${points.length} points, ${k} inner steps, interpolation ${alpha}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w: slowW, b: slowB, slowW, slowB, fastW, fastB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        fastW = slowW;
        fastB = slowB;
        for (let inner = 0; inner < k; inner += 1) {
            const grad = gradient(points, fastW, fastB);
            fastW -= innerRate * grad.dw;
            fastB -= innerRate * grad.db;
        }
        slowW += alpha * (fastW - slowW);
        slowB += alpha * (fastB - slowB);
        loss = gradient(points, slowW, slowB).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, slowW, slowB),
            edges: [fitEdge],
            description: `Epoch ${epoch}: slow weights move a fraction ${alpha} toward the inner result, line y = ${slowW.toFixed(3)}x + ${slowB.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w: slowW, b: slowB, slowW, slowB, fastW, fastB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, slowW, slowB),
        edges: [fitEdge],
        description: `After ${epochs} Lookahead epochs the line is y = ${slowW.toFixed(3)}x + ${slowB.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < initialLoss, w: slowW, b: slowB, loss, slowW, slowB, fastW, fastB, initialLoss },
    };
}

/** The Lookahead module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fast inner updates can make progress quickly but also bounce around noisily. Lookahead separates the two speeds: let an ordinary optimizer run several steps on a fast copy, then nudge the stable slow weights a fraction of the way toward it. The slow weights filter out the noise while still following the overall trend of the fast trajectory.",
        invariants: [
            "The fast weights are reinitialized from the slow weights at the start of each outer step.",
            "The slow weights move by the interpolation factor times the gap to the fast weights.",
            "The slow weights, not the fast ones, are the model reported after each outer step.",
        ],
        correctness:
            "Each outer update sets the slow weights to a convex combination of their old value and the inner optimizer's result, so they stay within the segment joining the two and cannot diverge further than the fast weights. Because the inner optimizer descends the loss from the slow point, the interpolated point lies on a descent path and the smoothed trajectory converges at least as reliably as the inner method.",
        complexityRationale:
            "Each outer epoch performs k inner gradient evaluations over n points plus one interpolation, so time is O(epochs * k * n). Two parameter vectors are stored, leaving space at O(n) for the data.",
        uses: [
            "Wrapping SGD or Adam to stabilize training",
            "Improving generalization in image classification",
            "Smoothing noisy trajectories in reinforcement learning",
        ],
        references: [
            "Zhang et al., Lookahead Optimizer: k steps forward, 1 step back, NeurIPS 2019",
            "Robbins and Monro, A Stochastic Approximation Method, 1951",
        ],
        workedExample:
            "From a slope of zero, five inner SGD steps might carry the fast slope to about zero point six. With interpolation factor one half, the slow slope becomes about zero point three. Repeating this, the slow slope follows the fast one at a steadier pace and the fitted line approaches the data without the inner oscillation.",
    },
    id: "lookahead-optimizer",
    name: "Lookahead Optimizer",
    category: "ml-ai",
    complexity: { time: "O(epochs * k * n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 1],
            [1, 3],
            [2, 5],
            [3, 7],
            [4, 9],
        ],
        innerRate: 0.05,
        alpha: 0.5,
        k: 5,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize slow weights and a copy of fast weights",
        "repeat for a fixed number of outer epochs",
        "copy slow weights into fast weights",
        "repeat k times: compute gradient and update fast weights with the inner optimizer",
        "move slow weights by interpolation factor times the difference to fast weights",
        "report the slow weights as the current model",
        "done: report the fitted line and final loss",
    ],
};

export default module;
