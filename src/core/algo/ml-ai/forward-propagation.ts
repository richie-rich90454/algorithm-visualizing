/**
 * forward-propagation.ts - Forward Propagation in a Small Neural Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Forward propagation pushes an input vector through a layered network. Each
 * neuron forms a weighted sum of its incoming values plus a bias, then applies
 * an activation function. This demo uses two inputs, a hidden layer of two
 * ReLU neurons, and one sigmoid output, so every arithmetic step is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * n^2) for L layers of width n (constant here)
 *   Space: O(L * n) for the stored activations
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Neurons are nodes arranged by layer; connections are weighted edges.
 *   - A computed neuron turns green; the neuron being computed turns active.
 *   - Edges feeding the active neuron are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface NNInput {
    x?: number[];
}

const W1: number[][] = [
    [0.1, 0.2],
    [0.3, 0.4],
];
const B1 = [0.05, 0.05];
const W2 = [0.5, -0.5];
const B2 = 0.1;

const EDGE_SPECS: Array<[string, string, string]> = [
    ["in-0", "hid-0", "e-in0-hid0"],
    ["in-1", "hid-0", "e-in1-hid0"],
    ["in-0", "hid-1", "e-in0-hid1"],
    ["in-1", "hid-1", "e-in1-hid1"],
    ["hid-0", "out-0", "e-hid0-out"],
    ["hid-1", "out-0", "e-hid1-out"],
];

function relu(value: number): number {
    return Math.max(0, value);
}

function sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
}

function fmt(value: number | null): string {
    return value === null ? "?" : value.toFixed(2);
}

/** Build the network nodes for one frame. */
function makeNodes(
    x: number[],
    hidden: Array<number | null>,
    output: number | null,
    highlight: string | null,
): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    const x0 = x[0] ?? 0;
    const x1 = x[1] ?? 0;
    const spec: Array<[string, string, number | null, number, string]> = [
        ["in-0", "x0", x0, 0, "input"],
        ["in-1", "x1", x1, 0, "input"],
        ["hid-0", "h0", hidden[0] ?? null, 1, "hidden"],
        ["hid-1", "h1", hidden[1] ?? null, 1, "hidden"],
        ["out-0", "y", output, 2, "output"],
    ];
    for (const [id, name, value, layer, role] of spec) {
        const known = value !== null;
        let state: EntityState = known ? "sorted" : "unvisited";
        if (id === highlight) {
            state = "active";
        } else if (role === "input") {
            state = "idle";
        }
        nodes.push({
            id,
            type: "node",
            label: `${name}=${fmt(value)}`,
            value: value ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { layer, role },
        });
    }
    return nodes;
}

/** Build the weighted edges, highlighting those entering a chosen node. */
function makeEdges(activeTarget: string | null): VisualEdge[] {
    return EDGE_SPECS.map(([source, target, id]) => ({
        id,
        sourceId: source,
        targetId: target,
        label: target === "out-0" ? fmt(W2[source === "hid-0" ? 0 : 1]) : fmt(W1[target === "hid-0" ? 0 : 1][source === "in-0" ? 0 : 1] ?? 0),
        state: target === activeTarget ? ("active" as const) : ("idle" as const),
        directed: true,
    }));
}

/** Run a forward pass, emitting one frame per neuron. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NNInput | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length >= 2 ? task.x.slice(0, 2) : [0.5, 0.8];
    const z1 = [
        W1[0]![0]! * x[0]! + W1[0]![1]! * x[1]! + B1[0]!,
        W1[1]![0]! * x[0]! + W1[1]![1]! * x[1]! + B1[1]!,
    ];
    const hidden = [relu(z1[0]!), relu(z1[1]!)];
    const z2 = W2[0]! * hidden[0]! + W2[1]! * hidden[1]! + B2;
    const output = sigmoid(z2);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(x, [null, null], null, null),
        edges: makeEdges(null),
        description: `Feeding x = (${x[0]}, ${x[1]}) through two hidden ReLU neurons and one sigmoid output.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { x: x.map((v) => Number(v.toFixed(6))), hidden: [], output: 0 },
    };
    step += 1;

    for (let j = 0; j < 2; j += 1) {
        const knownHidden: Array<number | null> = [null, null];
        for (let k = 0; k <= j; k += 1) {
            knownHidden[k] = hidden[k]!;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(x, knownHidden, null, `hid-${j}`),
            edges: makeEdges(`hid-${j}`),
            description: `Hidden neuron ${j}: weighted sum ${z1[j]!.toFixed(3)}, ReLU activation ${hidden[j]!.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: {
                x: x.map((v) => Number(v.toFixed(6))),
                hidden: knownHidden.map((v) => (v === null ? 0 : Number(v.toFixed(6)))),
                z1: z1.map((v) => Number(v.toFixed(6))).slice(0, j + 1),
                output: 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(x, hidden, output, "out-0"),
        edges: makeEdges("out-0"),
        description: `Output neuron: weighted sum ${z2.toFixed(3)}, sigmoid activation ${output.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: {
            x: x.map((v) => Number(v.toFixed(6))),
            hidden: hidden.map((v) => Number(v.toFixed(6))),
            z1: z1.map((v) => Number(v.toFixed(6))),
            z2: Number(z2.toFixed(6)),
            output: Number(output.toFixed(8)),
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(x, hidden, output, null),
        edges: makeEdges(null),
        description: `Forward pass complete; the network predicts ${output.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            x: x.map((v) => Number(v.toFixed(6))),
            hidden: hidden.map((v) => Number(v.toFixed(6))),
            z1: z1.map((v) => Number(v.toFixed(6))),
            z2: Number(z2.toFixed(6)),
            output: Number(output.toFixed(8)),
        },
    };
}

/** The forward propagation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A neural network is a chain of small linear calculations with a nonlinear function after each layer. Forward propagation visits the layers in order, turning the input into hidden activations and finally into a prediction. Nothing is learned here; this is only the scoring pass that a trained network performs.",
        invariants: [
            "Each neuron's pre-activation is the dot product of its weights with the previous layer plus its bias.",
            "Hidden neurons apply ReLU and the output applies the sigmoid function.",
            "A neuron's value is computed only after every neuron in the previous layer is known.",
        ],
        correctness:
            "Because each layer depends only on the layer before it, processing layers from input to output is a topological order of the computation graph. When every neuron applies its documented weighted sum and activation, the final value is exactly the composition of those functions, which is the network's defined output.",
        complexityRationale:
            "Fully connecting two adjacent layers of width n costs n squared multiply-adds, so a network with L such layers takes O(L times n squared) time. Storing one activation vector per layer uses O(L times n) space.",
        uses: [
            "Scoring an example with a trained classifier",
            "The forward pass inside training, before backpropagation computes gradients",
            "Running inference in deployed neural networks",
        ],
        references: [
            "Haykin, Neural Networks and Learning Machines, 2009",
            "Goodfellow, Bengio, and Courville, Deep Learning, 2016",
        ],
        workedExample:
            "With inputs 0.5 and 0.8, the first hidden neuron computes 0.1 times 0.5 plus 0.2 times 0.8 plus 0.05 = 0.26, which ReLU keeps at 0.26. The second computes 0.49. The output sums 0.5 times 0.26 minus 0.5 times 0.49 plus 0.1 = -0.015, and sigmoid maps that to about 0.496.",
    },
    id: "forward-propagation",
    name: "Forward Propagation",
    category: "ml-ai",
    complexity: { time: "O(L * n^2)", space: "O(L * n)" },
    defaultInput: { x: [0.5, 0.8] },
    visualType: "graph",
    run,
    pseudocode: [
        "read the input values into the first layer",
        "for each hidden neuron compute the weighted sum plus bias",
        "apply the ReLU activation to each hidden sum",
        "store each hidden activation for the next layer",
        "compute the output weighted sum from hidden activations",
        "apply the sigmoid activation to get the prediction",
        "done: report the network output",
    ],
};

export default module;
