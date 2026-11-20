/**
 * message-passing-neural-network.ts - Message Passing Neural Network (MPNN)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The message passing framework unifies many graph neural networks as two
 * phases. In the message phase each node sends a value to every neighbor. In
 * the update phase each node aggregates incoming messages by summation and
 * combines them with its own feature through a learned scale and ReLU. The
 * framework is the common template behind GCN, GAT, and GraphSAGE.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) with m directed edges
 *   Space: O(n) for the aggregated messages and updated features
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their feature before and after the update phase.
 *   - Edges show the message flow; active edges carry a message.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type Matrix = number[][];

interface Input {
    adjacency?: Matrix;
    features?: number[];
    scale?: number;
}

function nodes(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, feature: v },
    }));
}

function edges(a: Matrix, state: EntityState): VisualEdge[] {
    const list: VisualEdge[] = [];
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1) {
            if (i !== j && (a[i]?.[j] ?? 0) > 0) {
                list.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `node-${j}`,
                    targetId: `node-${i}`,
                    label: "",
                    state,
                    directed: true,
                });
            }
        }
    }
    return list;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
    ];
    const features = (task.features ?? [1, 2, 3, 4]).slice();
    const scale = typeof task.scale === "number" ? task.scale : 0.5;
    const n = adjacency.length;
    const at = (a: number[], i: number): number => a[i] ?? 0;
    const messages = features.map((_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (adjacency[i]?.[j] ?? 0) > 0) sum += at(features, j);
        }
        return sum;
    });
    const outputs = features.map((h, i) => Math.max(0, h + scale * (messages[i] ?? 0)));
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes(features, state("idle")),
        edges: edges(adjacency, "idle"),
        description: `Message passing on ${n} nodes with aggregation scale ${scale}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, scale, features },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(features, state("comparing")),
        edges: edges(adjacency, "active"),
        description: "Message phase: each node sends its feature to every neighbor.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { n, scale, features },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(messages, state("active"), messages.map((v) => v.toFixed(3))),
        edges: edges(adjacency, "idle"),
        description: "Aggregate the incoming messages at each node by summation.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { n, scale, messages },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(outputs, state("sorted")),
        edges: edges(adjacency, "active"),
        description: "Update phase: add the scaled aggregate to the node's own feature and apply ReLU.",
        codeLineNumber: 3,
        layout: "graph",
        meta: { n, scale, messages, outputs, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most graph neural networks can be described as passing messages. Each node sends a message along an edge, every node sums the messages it receives, and then a small update function blends that sum with the node's own state. Changing the message, aggregation, or update functions recovers GCN, GraphSAGE, GAT, and many others, which makes this a useful mental template.",
        invariants: [
            "Messages flow only along edges present in the adjacency matrix.",
            "Sum aggregation is order independent, so edge ordering cannot affect the result.",
            "ReLU keeps the updated features nonnegative.",
        ],
        correctness:
            "The framework is correct by construction as a general computation: the message function depends only on edge endpoints, the aggregate is a permutation-invariant sum over incoming messages, and the update is an arbitrary learnable function of the old state and the aggregate. Because these are the only operations, any instantiation is equivariant to node relabeling and respects the graph topology by never sending information across a missing edge.",
        complexityRationale:
            "Building messages and summing them scans each directed edge once, so the work is O(n plus m) for m edges. Only the message totals and updated features are stored, giving O(n) space beyond the input graph.",
        uses: [
            "A unifying implementation pattern for graph neural network libraries",
            "Molecular property prediction with learned edge messages",
            "Physics simulations modeled as interacting particles on a graph",
        ],
        references: [
            "Gilmer, Schoenholz, Riley, Vinyals, and Dahl, Neural Message Passing for Quantum Chemistry, ICML 2017",
            "Scarselli et al., The Graph Neural Network Model, IEEE TNN 2009",
        ],
        workedExample:
            "Three nodes in a path have features 1, 2, 3 and scale 0.5. The middle node receives messages 1 and 3, so its aggregate is 4. Updating gives 2 plus 0.5 times 4, which is 4 before ReLU. The end nodes each receive a single message and update accordingly.",
    },
    id: "message-passing-neural-network",
    name: "Message Passing Neural Network",
    category: "ml-ai",
    complexity: { time: "O(n + m)", space: "O(n)" },
    defaultInput: {
        adjacency: [
            [0, 1, 0, 0],
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
        ],
        features: [1, 2, 3, 4],
        scale: 0.5,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the adjacency matrix, node features, and aggregation scale",
        "for every edge send the source node's feature as a message",
        "aggregate incoming messages at each node by summation",
        "add the scaled aggregate to the node's own feature",
        "apply ReLU to produce the updated feature",
        "done: emit the updated node features",
    ],
};

export default module;
