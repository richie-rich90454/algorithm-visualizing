/**
 * graph-isomorphism-network.ts - Graph Isomorphism Network Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A GIN layer updates each node from its own feature and the sum of its
 * neighbors' features, then pushes the result through a small multilayer
 * perceptron. The self weight and the sum aggregation make the layer at least
 * as discriminative as the Weisfeiler-Lehman graph test, so two different graph
 * neighborhoods produce different node features unless the MLP collapses them.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E) * d + V * d * h) for V nodes, E edges, widths d and h
 *   Space: O(V * d) for the aggregated and output features
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are highlighted while their neighbor sums are accumulated.
 *   - The final frame shows each node's updated feature vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface GinInput {
    adjacency?: Record<string, string[]>;
    features?: Matrix;
    eps?: number;
    w1?: Matrix;
    b1?: number[];
    w2?: Matrix;
    b2?: number[];
}

const dot = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
const relu = (v: number): number => (v > 0 ? v : 0);

/** Sum the features of node v's neighbors, giving zero for an isolated node. */
export function neighborSum(adjacency: Record<string, string[]>, features: Matrix, index: number, ids: string[]): number[] {
    const d = features[0]?.length ?? 0;
    const result: number[] = new Array(d).fill(0);
    for (const neighbor of adjacency[ids[index] ?? ""] ?? []) {
        const j = ids.indexOf(neighbor);
        if (j < 0) continue;
        for (let k = 0; k < d; k += 1) result[k] = (result[k] ?? 0) + (features[j]?.[k] ?? 0);
    }
    return result;
}

/** Apply the GIN update to a single aggregated vector. */
export function ginUpdate(aggregated: number[], w1: Matrix, b1: number[], w2: Matrix, b2: number[]): number[] {
    const hidden = w1.map((row, i) => relu(dot(aggregated, row) + (b1[i] ?? 0)));
    return w2.map((row, i) => relu(dot(hidden, row) + (b2[i] ?? 0)));
}

/** Run a full GIN layer and return every node's updated feature. */
export function ginForward(
    adjacency: Record<string, string[]>,
    features: Matrix,
    eps: number,
    w1: Matrix,
    b1: number[],
    w2: Matrix,
    b2: number[],
): Matrix {
    const ids = Object.keys(adjacency);
    return features.map((row, i) => {
        const summed = neighborSum(adjacency, features, i, ids);
        const aggregated = row.map((v, k) => (1 + eps) * v + (summed[k] ?? 0));
        return ginUpdate(aggregated, w1, b1, w2, b2);
    });
}

function nodes(features: Matrix, states: EntityState[]): VisualEntity[] {
    return features.map((row, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: `${i}: [${row.map((v) => v.toFixed(1)).join(",")}]`,
        value: row.slice(),
        state: states[i] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GinInput | null) ?? {};
    const adjacency: Record<string, string[]> = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D"],
        D: ["B", "C"],
    };
    const features: Matrix = task.features ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0.5, -0.5],
    ];
    const eps = typeof task.eps === "number" ? task.eps : 0.1;
    const w1: Matrix = task.w1 ?? [
        [1, 0.5],
        [-0.5, 1],
    ];
    const b1: number[] = task.b1 ?? [0, 0];
    const w2: Matrix = task.w2 ?? [
        [0.5, 0],
        [0, 0.5],
    ];
    const b2: number[] = task.b2 ?? [0, 0];
    const ids = Object.keys(adjacency);
    const output = ginForward(adjacency, features, eps, w1, b1, w2, b2);
    const edges = ids.flatMap((from, i) =>
        (adjacency[from] ?? [])
            .filter((to) => ids.indexOf(to) > i)
            .map((to) => ({
                id: `edge-${from}-${to}`,
                sourceId: `node-${i}`,
                targetId: `node-${ids.indexOf(to)}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            })),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes(features, ids.map(() => "unvisited")),
        edges,
        description: `GIN layer over ${ids.length} nodes with self weight ${eps}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "init", eps, output: [] },
    };
    step += 1;

    for (let i = 0; i < ids.length; i += 1) {
        const states: EntityState[] = ids.map((_, k) => (k === i ? "active" : k < i ? "sorted" : "unvisited"));
        yield {
            stepNumber: step,
            entities: nodes(features, states),
            edges,
            description: `Node ${ids[i]}: sum neighbor features, add the weighted self feature, then apply the MLP.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { phase: "aggregate", eps, currentNode: ids[i], output: [] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes(output, ids.map(() => "sorted")),
        edges,
        description: "Done: every node now carries its GIN-updated feature vector.",
        codeLineNumber: 4,
        layout: "graph",
        meta: { phase: "done", eps, output, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To tell two graph neighborhoods apart, a layer must treat the node itself differently from its neighbors. GIN sums the neighbor features and adds a learned multiple of the node's own feature before applying an MLP. That sum makes the layer sensitive to the full multiset of neighbors, which is exactly the information the Weisfeiler-Lehman graph test uses.",
        invariants: [
            "An isolated node's aggregate is exactly (1+eps) times its own feature.",
            "Neighbor features are summed without normalization, preserving their multiset.",
            "The same MLP weights are shared by every node.",
        ],
        correctness:
            "The aggregate for node v is a strictly positive multiple of its own feature plus the unweighted sum of neighbor features, so permuting the neighbor order leaves it unchanged. A sum is injective on multisets up to the input precision, so distinct neighbor multisets give distinct aggregates before the MLP. Applying one shared MLP to each aggregate is the layer definition, so the computed features are exactly the GIN output.",
        complexityRationale:
            "Summing neighbors touches each edge once, O(E d), and the shared MLP costs O(V d h) across all nodes. Storing the aggregate and output features uses O(V d) space.",
        uses: [
            "Graph classification where neighborhood structure matters",
            "Molecular property prediction from atom graphs",
            "A theoretically grounded baseline for graph neural networks",
        ],
        references: [
            "Xu et al., How Powerful are Graph Neural Networks?, ICLR 2019",
            "Weisfeiler and Lehman, A Reduction of a Graph to a Canonical Form, 1968",
        ],
        workedExample:
            "For a node with feature (1,0) and two neighbors with features (0,1) and (1,1), the neighbor sum is (1,2). With eps equal to 0.1 the aggregate is (1.1, 2.1) plus the self feature, giving (2.1, 2.1). The shared MLP maps that vector through a hidden layer and ReLU to the node's updated feature.",
    },
    id: "graph-isomorphism-network",
    name: "Graph Isomorphism Network",
    category: "ml-ai",
    complexity: { time: "O((V + E) * d + V * d * h)", space: "O(V * d)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "D"],
            D: ["B", "C"],
        },
        features: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0.5, -0.5],
        ],
        eps: 0.1,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "for each node collect the features of its neighbors",
        "sum the neighbor features into one vector",
        "add the self feature scaled by one plus epsilon",
        "apply the shared multilayer perceptron with ReLU",
        "store the updated feature for the node",
        "done: report all updated node features",
    ],
};

export default module;
