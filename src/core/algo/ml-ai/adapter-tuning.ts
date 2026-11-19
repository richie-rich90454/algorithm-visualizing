/**
 * adapter-tuning.ts - Adapter Tuning with a Frozen Base Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adapter tuning inserts a small bottleneck into a frozen network. A down
 * projection compresses the features to a few dimensions, a nonlinearity acts
 * there, and an up projection expands back. The adapter output is added to the
 * original features by a residual connection. Only the two small adapter
 * matrices are trainable; the base weights never receive an update.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * r) for a d-dimensional feature and bottleneck width r
 *   Space: O(d * r) for the two adapter matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input, the reduced code, the adapter delta, and the sum.
 *   - Metadata records how many adapter parameters are trainable versus how
 *     many base parameters are frozen.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdapterInput {
    x?: number[];
    down?: number[][];
    up?: number[][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

/** A single adapter forward pass: x plus the up-projected nonlinearity. */
export function adapterForward(x: number[], down: number[][], up: number[][]) {
    const hidden = down.map((row) => Math.max(0, dot(x, row)));
    const delta = up.map((row) => dot(hidden, row));
    const output = x.map((value, i) => value + (delta[i] ?? 0));
    return { hidden, delta, output };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feat-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdapterInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, -1, 0.5];
    const down: number[][] = Array.isArray(task.down) && task.down.length > 0
        ? task.down.map((row) => [...row])
        : [
              [1, 0.5, -0.5, 1],
              [-0.5, 1, 1, 0.5],
          ];
    const up: number[][] = Array.isArray(task.up) && task.up.length === x.length
        ? task.up.map((row) => [...row])
        : [
              [0.5, -0.5],
              [0.4, 0.3],
              [0.2, 0.6],
              [0.1, -0.2],
          ];
    const r = adapterForward(x, down, up);
    const trainable = down.length * (down[0]?.length ?? 0) + up.length * (up[0]?.length ?? 0);
    const frozen = x.length * x.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x, "idle"),
        edges: [],
        description: `Frozen ${x.length}-dimensional base features with a ${down.length}-unit adapter bottleneck.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, trainable, frozen, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.hidden, "active"),
        edges: [],
        description: "Compress features through the down projection and apply the nonlinearity.",
        codeLineNumber: 1,
        layout: "array",
        meta: { x, hidden: r.hidden, trainable, frozen, phase: "down" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.delta, "comparing"),
        edges: [],
        description: "Expand the bottleneck back with the up projection to form the adapter delta.",
        codeLineNumber: 2,
        layout: "array",
        meta: { x, hidden: r.hidden, delta: r.delta, trainable, frozen, phase: "up" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.output, "sorted"),
        edges: [],
        description: `Add the adapter delta to the frozen base features; ${trainable} adapter parameters are trainable.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            x,
            hidden: r.hidden,
            delta: r.delta,
            output: r.output,
            trainable,
            frozen,
            phase: "done",
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than changing every weight of a pretrained model, adapter tuning slips a tiny trainable module into each layer. The module squeezes the features into a narrow bottleneck and then expands them again, so it has far fewer parameters than the layer around it. Its output is added back to the original features, letting the model learn a task-specific correction while the base model stays completely frozen.",
        invariants: [
            "The base features are added unchanged through the residual path.",
            "Only the down and up adapter matrices are trainable.",
            "The bottleneck width r is smaller than the feature dimension d.",
        ],
        correctness:
            "The adapter computes h = relu(W_down x) and adds W_up h to x. This is a direct evaluation of the adapter definition, so the reported output is correct by construction. Because the residual path contributes x unchanged, setting both adapter matrices to zero reduces the whole module to the identity, which is the frozen base behavior; therefore any change from the base comes solely from trainable adapter parameters.",
        complexityRationale:
            "The down projection costs O(d*r) and the up projection costs O(r*d), so the forward pass is O(d*r). Storing both adapter matrices takes O(d*r) parameters, far fewer than the O(d squared) base layer that stays frozen.",
        uses: [
            "Parameter-efficient fine-tuning of large language models",
            "Storing many task-specific adapters for one shared base model",
            "Multi-task transfer with minimal added parameters",
        ],
        references: [
            "Houlsby et al., Parameter-Efficient Transfer Learning for NLP, ICML 2019",
            "Pfeiffer et al., AdapterFusion, 2021",
        ],
        workedExample:
            "For a four-dimensional feature and a two-unit bottleneck, the down matrix has eight entries and the up matrix has eight, for sixteen trainable parameters. The bottleneck produces two nonnegative numbers, the up matrix maps them to a four-dimensional delta, and that delta is added to the original feature.",
    },
    id: "adapter-tuning",
    name: "Adapter Tuning",
    category: "ml-ai",
    complexity: { time: "O(d * r)", space: "O(d * r)" },
    defaultInput: {
        x: [1, 2, -1, 0.5],
        down: [
            [1, 0.5, -0.5, 1],
            [-0.5, 1, 1, 0.5],
        ],
        up: [
            [0.5, -0.5],
            [0.4, 0.3],
            [0.2, 0.6],
            [0.1, -0.2],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "freeze the base layer features",
        "project features down to a narrow bottleneck",
        "apply a nonlinearity in the bottleneck",
        "project the bottleneck back up to the feature width",
        "add the adapter delta to the frozen base features",
        "update only the adapter matrices during training",
        "done: report the adapted features and parameter counts",
    ],
};

export default module;
