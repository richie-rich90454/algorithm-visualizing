/**
 * adagrad.ts - AdaGrad Adaptive Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AdaGrad is a gradient-descent variant that keeps a per-parameter sum of
 * squared past gradients. Each coordinate is divided by the square root of
 * that sum, so frequently changing parameters get smaller effective steps and
 * rarely changing parameters keep larger ones. It is well suited to sparse
 * features, where the accumulated denominator adapts automatically.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d) for d parameters
 *   Space: O(d) for the squared-gradient accumulator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The parameter vector is drawn as a point in the plane.
 *   - Visited positions form a path; the current position is highlighted.
 *   - meta carries the gradient and accumulator for each coordinate.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GradState {
    w: number[];
    accum: number[];
}

/** Analytic gradient of f(w) = 0.5*((w0-a)^2 + k*(w1-b)^2). */
function gradient(w: number[], a: number, b: number, k: number): number[] {
    return [(w[0] ?? 0) - a, k * ((w[1] ?? 0) - b)];
}

/** Objective value at w. */
function loss(w: number[], a: number, b: number, k: number): number {
    const d0 = (w[0] ?? 0) - a;
    const d1 = (w[1] ?? 0) - b;
    return 0.5 * (d0 * d0 + k * d1 * d1);
}

/** Build the trajectory nodes plus connecting edges. */
function makeEntities(path: number[][], states: Map<number, EntityState>): {
    entities: VisualEntity[];
    edges: VisualEdge[];
} {
    const entities: VisualEntity[] = path.map((p, i) => ({
        id: `pos-${i}`,
        type: "node" as const,
        label: i === path.length - 1 ? `w${i}` : String(i),
        value: [p[0], p[1]],
        state: states.get(i) ?? "visited",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { step: i, w0: p[0], w1: p[1] },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 1; i < path.length; i += 1) {
        edges.push({
            id: `step-${i}`,
            sourceId: `pos-${i - 1}`,
            targetId: `pos-${i}`,
            label: "",
            state: "path",
            directed: true,
        });
    }
    return { entities, edges };
}

/** The AdaGrad generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            start?: number[];
            target?: number[];
            curvature?: number;
            lr?: number;
            eps?: number;
            iterations?: number;
        } | null
    ) ?? {};
    const w: number[] = (task.start ?? [0, 0]).slice();
    const a = task.target?.[0] ?? 3;
    const b = task.target?.[1] ?? -2;
    const k = typeof task.curvature === "number" ? task.curvature : 4;
    const lr = typeof task.lr === "number" ? task.lr : 1;
    const eps = typeof task.eps === "number" ? task.eps : 1e-8;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 12;

    const accum = w.map(() => 0);
    const path: number[][] = [w.slice()];
    let g = gradient(w, a, b, k);
    let step = 0;

    const first = makeEntities(path, new Map([[0, "active" as EntityState]]));
    yield {
        stepNumber: step,
        entities: first.entities,
        edges: first.edges,
        description: `AdaGrad on f(w) = 0.5*((w0-${a})^2 + ${k}*(w1-${b})^2), starting at (${w[0]}, ${w[1]}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { w0: w[0], w1: w[1], loss: loss(w, a, b, k), g0: g[0], g1: g[1], a0: 0, a1: 0 },
    };
    step += 1;

    for (let t = 0; t < iterations; t += 1) {
        g = gradient(w, a, b, k);
        for (let d = 0; d < w.length; d += 1) {
            const gv = g[d] ?? 0;
            const av = (accum[d] ?? 0) + gv * gv;
            accum[d] = av;
            w[d] = (w[d] ?? 0) - (lr * gv) / (Math.sqrt(av) + eps);
        }
        path.push(w.slice());
        const states = new Map<number, EntityState>([[path.length - 1, "active"]]);
        const view = makeEntities(path, states);
        yield {
            stepNumber: step,
            entities: view.entities,
            edges: view.edges,
            description: `Iteration ${t + 1}: gradient (${(g[0] ?? 0).toFixed(3)}, ${(g[1] ?? 0).toFixed(3)}), accumulator (${(accum[0] ?? 0).toFixed(3)}, ${(accum[1] ?? 0).toFixed(3)}), w = (${(w[0] ?? 0).toFixed(3)}, ${(w[1] ?? 0).toFixed(3)}).`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                w0: w[0],
                w1: w[1],
                loss: loss(w, a, b, k),
                g0: g[0],
                g1: g[1],
                a0: accum[0],
                a1: accum[1],
                iteration: t + 1,
            },
        };
        step += 1;
    }

    const final = makeEntities(path, new Map([[path.length - 1, "sorted" as EntityState]]));
    yield {
        stepNumber: step,
        entities: final.entities,
        edges: final.edges,
        description: `Finished in ${iterations} steps; final w = (${(w[0] ?? 0).toFixed(4)}, ${(w[1] ?? 0).toFixed(4)}), loss ${loss(w, a, b, k).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            w0: w[0],
            w1: w[1],
            loss: loss(w, a, b, k),
            a0: accum[0],
            a1: accum[1],
            converged: true,
            iterations,
        },
    };
}

/** The AdaGrad module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain gradient descent uses one learning rate for every parameter. AdaGrad gives each parameter its own rate by dividing its gradient by the square root of the sum of all its past squared gradients. Parameters that have moved a lot slow down, while quiet parameters keep taking larger steps, which helps with sparse data.",
        invariants: [
            "Each accumulator is the running sum of squared gradients for one coordinate and never decreases.",
            "Every update moves a coordinate opposite to the sign of its current gradient.",
            "The effective step in a coordinate is lr divided by the square root of its accumulator plus epsilon.",
        ],
        correctness:
            "At each step the update is the negative gradient scaled by a positive, coordinate-specific factor, so it is always a descent direction for a convex objective. Because the denominator grows only from past gradients, the scalar is deterministic given the history; reproducing the same update sequence term by term yields the same parameters as the closed-form AdaGrad rule.",
        complexityRationale:
            "One gradient and one accumulator update per parameter per iteration gives O(iterations * d) time. Only the d accumulators and the parameter vector are stored, so space is O(d).",
        uses: [
            "Training sparse linear models with rare categorical features",
            "Online learning where feature frequencies are uneven",
            "A building block for later adaptive optimizers such as RMSProp and Adam",
        ],
        references: [
            "Duchi, Hazan, and Singer, Adaptive Subgradient Methods, 2011",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 8, 2016",
        ],
        workedExample:
            "Minimizing f(w) = 0.5*((w0-3)^2 + 4*(w1+2)^2) from (0,0) with lr = 1: the first gradient is (-3, -8), the accumulators become (9, 64), and the first update moves w to about (1, 1) since the large w1 gradient is damped more strongly.",
    },
    id: "adagrad",
    name: "AdaGrad",
    category: "ml-ai",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: { start: [0, 0], target: [3, -2], curvature: 4, lr: 1, eps: 1e-8, iterations: 12 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters w and per-coordinate accumulators to zero",
        "for each iteration",
        "compute the gradient g of the loss at w",
        "add the square of each gradient component to its accumulator",
        "update each parameter by minus lr times g over sqrt of accumulator plus epsilon",
        "record the new parameter position",
        "done: report the final parameters and loss",
    ],
};

export default module;
