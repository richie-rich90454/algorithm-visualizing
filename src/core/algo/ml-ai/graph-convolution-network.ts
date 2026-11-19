/**
 * graph-convolution-network.ts - Graph Convolutional Network (GCN) Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A GCN layer produces a new feature for each node by averaging the features of
 * its neighbors (including itself) under a symmetric degree normalization,
 * multiplying by a learned weight matrix, and applying ReLU. The normalization
 * keeps feature scales stable regardless of node degree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * f + n * f * o) for n nodes, f input and o output features
 *   Space: O(n^2 + n * o) for the normalized adjacency and outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes carry their feature vector; edges show the graph connectivity.
 *   - Final node labels show the output embedding after one GCN layer.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type Matrix = number[][];

interface Input {
    adjacency?: Matrix;
    features?: Matrix;
    weights?: Matrix;
}

function matMul(a: Matrix, b: Matrix): Matrix {
    const rows = a.length;
    const inner = b.length;
    const cols = inner > 0 ? (b[0]?.length ?? 0) : 0;
    const out: Matrix = [];
    for (let i = 0; i < rows; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < cols; j += 1) {
            let sum = 0;
            for (let k = 0; k < inner; k += 1) sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            row.push(sum);
        }
        out.push(row);
    }
    return out;
}

function nodes(values: Matrix, states: EntityState[]): VisualEntity[] {
    return values.map((vec, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: vec.map((v) => v.toFixed(2)).join(","),
        value: vec,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, features: vec.length },
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

function rows(m: Matrix): string[] {
    return m.map((row) => row.join(","));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
    ];
    const features: Matrix = task.features ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 0],
    ];
    const weights: Matrix = task.weights ?? [
        [1, 0.5],
        [0.5, 1],
    ];
    const n = adjacency.length;
    const withLoops: Matrix = adjacency.map((row, i) =>
        row.map((v, j) => v + (i === j ? 1 : 0)),
    );
    const degrees = withLoops.map((row) => row.reduce((a, v) => a + v, 0));
    const norm: Matrix = withLoops.map((row, i) =>
        row.map((v, j) => v / (Math.sqrt(degrees[i] ?? 1) * Math.sqrt(degrees[j] ?? 1))),
    );
    const aggregated = matMul(norm, features);
    const z = matMul(aggregated, weights);
    const outputs: Matrix = z.map((row) => row.map((v) => Math.max(0, v)));
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes(features, state("idle")),
        edges: adjacencyEdges(adjacency, "idle"),
        description: `One GCN layer over ${n} nodes with ${(features[0]?.length ?? 0)} input features.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, degrees },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(features, state("comparing")),
        edges: adjacencyEdges(adjacency, "active"),
        description: "Add self-loops and compute each node degree for symmetric normalization.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { n, degrees, withLoops: rows(withLoops) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(aggregated, state("active")),
        edges: adjacencyEdges(adjacency, "idle"),
        description: "Multiply the normalized adjacency by the feature matrix to average neighbor features.",
        codeLineNumber: 3,
        layout: "graph",
        meta: { n, degrees, norm: rows(norm), aggregated: rows(aggregated) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(outputs, state("sorted")),
        edges: adjacencyEdges(adjacency, "active"),
        description: "Apply the learned weights and ReLU to produce the final node embeddings.",
        codeLineNumber: 5,
        layout: "graph",
        meta: { n, degrees, outputs: rows(outputs), converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph convolution updates each node by blending its own features with those of its neighbors. Because some nodes have many neighbors and others have few, the blend uses a symmetric normalization based on node degrees so that the average stays on a consistent scale. A learned weight matrix then mixes the features before ReLU adds nonlinearity.",
        invariants: [
            "Self-loops are always added so a node keeps its own information.",
            "The normalized adjacency matrix is symmetric.",
            "ReLU makes every output feature nonnegative.",
        ],
        correctness:
            "The symmetric normalization D to the minus one half times A-hat times D to the minus one half is equivalent to averaging neighbor features with weights that depend only on degrees, which preserves the total feature mass under the change of basis. Multiplying by a learned weight matrix and applying ReLU is the standard message-passing update, so each output embedding is a deterministic, permutation-equivariant function of the local neighborhood.",
        complexityRationale:
            "Forming the normalized adjacency inspects the n by n matrix once, multiplying it by the n by f features costs O(n squared times f), and the final multiplication costs O(n times f times o). Space is O(n squared) for the dense normalized matrix plus O(n times o) for the outputs.",
        uses: [
            "Node classification on citation and social graphs",
            "Molecular property prediction from molecular graphs",
            "Recommendation systems over user item interaction graphs",
        ],
        references: [
            "Kipf and Welling, Semi-Supervised Classification with Graph Convolutional Networks, ICLR 2017",
            "Scarselli et al., The Graph Neural Network Model, IEEE TNN 2009",
        ],
        workedExample:
            "Two nodes connected to each other with features 1 and 3 and a single identity weight. After adding self-loops each node has degree 2, and the normalized adjacency gives each node about two thirds of its own feature and one third of its neighbor's. Node one ends near 1.67 and node two near 2.67 before ReLU.",
    },
    id: "graph-convolution-network",
    name: "Graph Convolutional Network",
    category: "ml-ai",
    complexity: { time: "O(n^2 f + n f o)", space: "O(n^2 + n o)" },
    defaultInput: {
        adjacency: [
            [0, 1, 0, 0],
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
        ],
        features: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, 0],
        ],
        weights: [
            [1, 0.5],
            [0.5, 1],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the adjacency matrix, node features, and weight matrix",
        "add a self-loop to every node and compute its degree",
        "build the symmetric normalized adjacency matrix",
        "multiply the normalized adjacency by the feature matrix",
        "multiply the aggregated features by the weight matrix",
        "apply ReLU to obtain the final node embeddings",
        "done: emit the updated node representations",
    ],
};

export default module;
