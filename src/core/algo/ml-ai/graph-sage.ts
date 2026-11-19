/**
 * graph-sage.ts - GraphSAGE Mean Aggregation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GraphSAGE learns a function that generates embeddings by sampling and
 * aggregating neighbor features. In its simplest form it averages the features
 * of a node's neighbors, combines that mean with the node's own feature through
 * learned weights, and applies ReLU. This inductive approach generalizes to
 * nodes that were not present during training.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) in the dense case, or O(n + m) with m edges
 *   Space: O(n) for the neighbor means and output embeddings
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their input feature and, finally, their updated embedding.
 *   - Edges show the graph used for neighbor aggregation.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type Matrix = number[][];

interface Input {
    adjacency?: Matrix;
    features?: number[];
    selfWeight?: number;
    neighborWeight?: number;
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

function adjacencyEdges(a: Matrix, state: EntityState): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < a.length; i += 1) {
        for (let j = i + 1; j < (a[i]?.length ?? 0); j += 1) {
            if ((a[i]?.[j] ?? 0) > 0) {
                edges.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${j}`,
                    label: "",
                    state,
                    directed: false,
                });
            }
        }
    }
    return edges;
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
    const selfWeight = typeof task.selfWeight === "number" ? task.selfWeight : 0.5;
    const neighborWeight = typeof task.neighborWeight === "number" ? task.neighborWeight : 1;
    const n = adjacency.length;
    const at = (a: number[], i: number): number => a[i] ?? 0;

    const means = features.map((_, i) => {
        const neighbors: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (adjacency[i]?.[j] ?? 0) > 0) neighbors.push(j);
        }
        if (neighbors.length === 0) return 0;
        return neighbors.reduce((a, j) => a + at(features, j), 0) / neighbors.length;
    });
    const outputs = features.map((h, i) =>
        Math.max(0, selfWeight * h + neighborWeight * (means[i] ?? 0)),
    );
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes(features, state("idle")),
        edges: adjacencyEdges(adjacency, "idle"),
        description: `GraphSAGE mean aggregation over ${n} nodes.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, features, selfWeight, neighborWeight },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(features, state("comparing")),
        edges: adjacencyEdges(adjacency, "active"),
        description: "Collect the neighbors of each node for aggregation.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { n, features },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(means, state("active"), means.map((v) => v.toFixed(3))),
        edges: adjacencyEdges(adjacency, "idle"),
        description: "Average the neighbor features into a single message per node.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { n, means },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(outputs, state("sorted")),
        edges: adjacencyEdges(adjacency, "active"),
        description: "Combine the node's own feature with the neighbor mean and apply ReLU.",
        codeLineNumber: 4,
        layout: "graph",
        meta: { n, means, outputs, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "GraphSAGE learns how to combine a node's own feature with a summary of its neighbors. Instead of memorizing an embedding for each node, it learns an aggregator that works for any node with the right neighborhood. The mean aggregator simply averages neighbor features, which is cheap and works well when neighbors are drawn from a sampled fixed-size set.",
        invariants: [
            "A node with no neighbors has a zero neighbor message.",
            "The neighbor mean lies between the smallest and largest neighbor feature.",
            "ReLU makes each output embedding nonnegative.",
        ],
        correctness:
            "The mean aggregator is a symmetric function of its inputs, so permuting neighbor order leaves the message unchanged, a requirement for any valid graph aggregation. Combining that message with the node's own feature through learned weights and a nonlinearity produces an inductive mapping that depends only on local structure, which is why embeddings can be generated for previously unseen nodes.",
        complexityRationale:
            "Scanning neighbors to build each mean visits every edge a constant number of times, giving O(n plus m) time on m edges or O(n squared) for a dense matrix. The mean and output arrays use O(n) space.",
        uses: [
            "Embedding newly added users in large recommendation graphs",
            "Inductive node classification where the graph keeps growing",
            "Scalable graph learning with sampled neighborhoods",
        ],
        references: [
            "Hamilton, Ying, and Leskovec, Inductive Representation Learning on Large Graphs, NeurIPS 2017",
            "Kipf and Welling, Semi-Supervised Classification with Graph Convolutional Networks, ICLR 2017",
        ],
        workedExample:
            "A node with feature 2 has neighbors with features 1 and 3, so the neighbor mean is 2. With a self weight of 0.5 and a neighbor weight of 1, the pre-activation is 0.5 times 2 plus 1 times 2, which equals 3, and ReLU keeps it at 3.",
    },
    id: "graph-sage",
    name: "GraphSAGE",
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
        selfWeight: 0.5,
        neighborWeight: 1,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the adjacency, node features, and the two learned weights",
        "for each node collect its neighbor set",
        "average the neighbor features into one message",
        "combine the node's own feature with the neighbor message",
        "apply ReLU to obtain the updated embedding",
        "done: emit the updated node embeddings",
    ],
};

export default module;
