/**
 * backpropagation.ts - Backpropagation in a Small Neural Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Backpropagation computes the gradient of a loss with respect to every weight
 * in a network by applying the chain rule layer by layer from the output back
 * to the input. This demo uses a fixed 2-2-1 network with sigmoid activations
 * and mean-squared-error loss. Every analytic gradient can be checked against
 * a finite-difference approximation of the same loss function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(W) for W weights and connections (one pass forward, one back)
 *   Space: O(W) for activations and gradients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Neurons are nodes; weights are directed edges labeled with their value.
 *   - Forward frames fill in activations layer by layer (green).
 *   - Backward frames highlight the edges whose gradients are being computed.
 *   - meta carries every weight gradient for finite-difference verification.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Weights {
    x0h0: number;
    x1h0: number;
    x0h1: number;
    x1h1: number;
    h0o: number;
    h1o: number;
    bh0: number;
    bh1: number;
    bo: number;
}

const DEFAULT_W: Weights = {
    x0h0: 0.1,
    x1h0: -0.2,
    x0h1: 0.3,
    x1h1: 0.4,
    h0o: 0.5,
    h1o: -0.6,
    bh0: 0.1,
    bh1: -0.1,
    bo: 0.2,
};

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** Full forward pass returning every intermediate activation and the loss. */
function forward(x: number[], w: Weights, target: number) {
    const z0 = (x[0] ?? 0) * w.x0h0 + (x[1] ?? 0) * w.x1h0 + w.bh0;
    const z1 = (x[0] ?? 0) * w.x0h1 + (x[1] ?? 0) * w.x1h1 + w.bh1;
    const h0 = sigmoid(z0);
    const h1 = sigmoid(z1);
    const zo = h0 * w.h0o + h1 * w.h1o + w.bo;
    const o = sigmoid(zo);
    const lossValue = 0.5 * (o - target) ** 2;
    return { z0, z1, h0, h1, zo, o, loss: lossValue };
}

/** Analytic gradients of the loss with respect to every weight. */
function backward(x: number[], w: Weights, target: number): Weights {
    const f = forward(x, w, target);
    const dzo = (f.o - target) * f.o * (1 - f.o);
    const dh0 = dzo * w.h0o;
    const dh1 = dzo * w.h1o;
    const dz0 = dh0 * f.h0 * (1 - f.h0);
    const dz1 = dh1 * f.h1 * (1 - f.h1);
    return {
        x0h0: dz0 * (x[0] ?? 0),
        x1h0: dz0 * (x[1] ?? 0),
        x0h1: dz1 * (x[0] ?? 0),
        x1h1: dz1 * (x[1] ?? 0),
        h0o: dzo * f.h0,
        h1o: dzo * f.h1,
        bh0: dz0,
        bh1: dz1,
        bo: dzo,
    };
}

const WEIGHT_KEYS = Object.keys(DEFAULT_W) as Array<keyof Weights>;

function makeNodes(x: number[], f: ReturnType<typeof forward> | null, phase: string): VisualEntity[] {
    const val = (n: number): string => (f ? n.toFixed(3) : "?");
    return [
        { id: "node-x0", label: `x0=${(x[0] ?? 0).toFixed(2)}`, state: "active" as EntityState },
        { id: "node-x1", label: `x1=${(x[1] ?? 0).toFixed(2)}`, state: "active" as EntityState },
        { id: "node-h0", label: `h0=${f ? val(f.h0) : "?"}`, state: (f ? "sorted" : "unvisited") as EntityState },
        { id: "node-h1", label: `h1=${f ? val(f.h1) : "?"}`, state: (f ? "sorted" : "unvisited") as EntityState },
        { id: "node-o", label: `o=${f ? val(f.o) : "?"}`, state: (f ? "highlight" : "unvisited") as EntityState },
    ].map((n, i) => ({
        ...n,
        type: "node" as const,
        value: n.label,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, phase },
    }));
}

function makeEdges(w: Weights, grads: Weights | null, highlight: Set<keyof Weights>): VisualEdge[] {
    const defs: Array<{ key: keyof Weights; from: string; to: string }> = [
        { key: "x0h0", from: "node-x0", to: "node-h0" },
        { key: "x1h0", from: "node-x1", to: "node-h0" },
        { key: "x0h1", from: "node-x0", to: "node-h1" },
        { key: "x1h1", from: "node-x1", to: "node-h1" },
        { key: "h0o", from: "node-h0", to: "node-o" },
        { key: "h1o", from: "node-h1", to: "node-o" },
    ];
    return defs.map((d) => ({
        id: `edge-${d.key}`,
        sourceId: d.from,
        targetId: d.to,
        label: grads ? `w=${w[d.key].toFixed(2)}, g=${grads[d.key].toFixed(4)}` : `w=${w[d.key].toFixed(2)}`,
        state: highlight.has(d.key) ? "highlight" : grads ? "path" : "idle",
        directed: true,
    }));
}

/** The backpropagation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { x?: number[]; weights?: Partial<Weights>; target?: number } | null
    ) ?? {};
    const x = (task.x ?? [0.5, 0.8]).slice();
    const w: Weights = { ...DEFAULT_W, ...(task.weights ?? {}) };
    const target = typeof task.target === "number" ? task.target : 0.7;

    const grads = backward(x, w, target);
    let step = 0;
    const g0 = (key: keyof Weights): number => grads[key];

    yield {
        stepNumber: step,
        entities: makeNodes(x, null, "init"),
        edges: makeEdges(w, null, new Set()),
        description: `2-2-1 sigmoid network: inputs (${x[0]}, ${x[1]}), target ${target}. Ready to propagate forward.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { loss: 0, phase: "init" },
    };
    step += 1;

    const f = forward(x, w, target);
    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "input"),
        edges: makeEdges(w, null, new Set()),
        description: `Input layer holds (${x[0]}, ${x[1]}); weights on the edges are fixed.`,
        codeLineNumber: 1,
        layout: "graph",
        meta: { loss: 0, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "hidden"),
        edges: makeEdges(w, null, new Set<keyof Weights>(["x0h0", "x1h0", "x0h1", "x1h1"])),
        description: `Hidden layer: h0 = ${f.h0.toFixed(4)}, h1 = ${f.h1.toFixed(4)} after sigmoid.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { loss: 0, h0: f.h0, h1: f.h1, phase: "hidden" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "output"),
        edges: makeEdges(w, null, new Set<keyof Weights>(["h0o", "h1o"])),
        description: `Output o = ${f.o.toFixed(4)}; loss = 0.5*(o - target)^2 = ${f.loss.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { loss: f.loss, o: f.o, phase: "output" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "back-output"),
        edges: makeEdges(w, grads, new Set<keyof Weights>(["h0o", "h1o", "bo"])),
        description: `Backward pass at the output: dL/dh0o = ${g0("h0o").toFixed(5)}, dL/dh1o = ${g0("h1o").toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { loss: f.loss, phase: "back-output", d_h0o: grads.h0o, d_h1o: grads.h1o, d_bo: grads.bo },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "back-hidden"),
        edges: makeEdges(w, grads, new Set<keyof Weights>(["x0h0", "x1h0", "x0h1", "x1h1", "bh0", "bh1"])),
        description: `Backward pass at the hidden layer: dL/dx0h0 = ${g0("x0h0").toFixed(5)}, dL/dx1h1 = ${g0("x1h1").toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            loss: f.loss,
            phase: "back-hidden",
            d_x0h0: grads.x0h0,
            d_x1h0: grads.x1h0,
            d_x0h1: grads.x0h1,
            d_x1h1: grads.x1h1,
            d_bh0: grads.bh0,
            d_bh1: grads.bh1,
        },
    };
    step += 1;

    const gradientMeta: Record<string, number> = {};
    for (const key of WEIGHT_KEYS) {
        gradientMeta[`grad_${key}`] = grads[key];
    }
    yield {
        stepNumber: step,
        entities: makeNodes(x, f, "done"),
        edges: makeEdges(w, grads, new Set()),
        description: `All ${WEIGHT_KEYS.length} gradients computed; loss ${f.loss.toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "graph",
        meta: { loss: f.loss, phase: "done", ...gradientMeta },
    };
}

/** The backpropagation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A network is a composition of simple functions, so its gradient follows from the chain rule. After a forward pass records each activation, the backward pass walks the composition in reverse, reusing the upstream derivative at each layer to form the derivative with respect to that layer's weights and inputs.",
        invariants: [
            "Each forward activation is the sigmoid of a weighted sum plus a bias.",
            "The loss is one half of the squared difference between the output and the target.",
            "A weight's gradient equals the upstream error signal times the activation feeding that weight.",
        ],
        correctness:
            "The chain rule gives dL/dz = (o - target) * o * (1 - o) at a sigmoid output with squared loss, and dL/dw = dL/dz times the incoming activation. Each hidden error signal is the downstream error times the outgoing weight times the sigmoid derivative. Inductively these are exactly the partial derivatives of the loss, which finite-difference approximations confirm.",
        complexityRationale:
            "Each connection participates once in the forward pass and once in the backward pass, so the work is linear in the number of weights W. Storing activations and gradients also takes O(W) space.",
        uses: [
            "Training feedforward neural networks with gradient descent",
            "The autodifferentiation engine behind modern deep learning frameworks",
            "Computing gradients for logistic regression and multilayer perceptrons",
        ],
        references: [
            "Rumelhart, Hinton, and Williams, Learning Representations by Back-Propagating Errors, 1986",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 6, 2016",
        ],
        workedExample:
            "With inputs (0.5, 0.8), target 0.7, and the default weights, the forward pass gives h0 about 0.51 and h1 about 0.64, producing an output near 0.55. The output error signal (o - 0.7) * o * (1 - o) then flows back to give, for example, dL/dh0o equal to that signal times h0.",
    },
    id: "backpropagation",
    name: "Backpropagation",
    category: "ml-ai",
    complexity: { time: "O(W)", space: "O(W)" },
    defaultInput: { x: [0.5, 0.8], target: 0.7 },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize the network weights and biases",
        "read the input values into the input layer",
        "compute each hidden activation as sigmoid of weighted inputs plus bias",
        "compute the output and the squared loss against the target",
        "at the output form the error signal times the sigmoid derivative",
        "for each output weight multiply the signal by its incoming activation",
        "propagate the signal backward through each hidden layer",
        "for each weight record the product of signal and incoming activation",
        "done: return every weight gradient",
    ],
};

export default module;
