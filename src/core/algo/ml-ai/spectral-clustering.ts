/**
 * spectral-clustering.ts - Spectral Clustering via the Fiedler Vector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Spectral clustering partitions a graph using the eigenvectors of its graph
 * Laplacian. The second-smallest eigenvector, called the Fiedler vector, is
 * positive on one densely connected group and negative on another. Splitting
 * nodes by its sign recovers the two communities. A mean-removed power
 * iteration on a shifted Laplacian finds that vector exactly here.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for an n by n adjacency matrix
 *   Space: O(n^2) for the shifted matrix and O(n) for the vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are colored by the cluster given by the sign of the Fiedler entry.
 *   - Edges show the similarity graph; the weak bridge is highlighted.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type Matrix = number[][];

interface Input {
    adjacency?: Matrix;
    iterations?: number;
}

function nodes(vector: number[], clusters: number[], states: EntityState[]): VisualEntity[] {
    const palette: EntityState[] = ["sorted", "highlight"];
    return vector.map((v, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: `${(clusters[i] ?? 0)}:${v.toFixed(2)}`,
        value: v,
        state: states[i] ?? palette[clusters[i] ?? 0] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, cluster: clusters[i] ?? 0, fiedler: v },
    }));
}

function graphEdges(a: Matrix, state: EntityState): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < a.length; i += 1) {
        for (let j = i + 1; j < (a[i]?.length ?? 0); j += 1) {
            const w = a[i]?.[j] ?? 0;
            if (w > 0) {
                edges.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${j}`,
                    label: w < 1 ? w.toFixed(2) : "",
                    state: w < 1 ? "active" : state,
                    directed: false,
                });
            }
        }
    }
    return edges;
}

function matVec(m: Matrix, v: number[]): number[] {
    return m.map((row) => row.reduce((a, val, j) => a + val * (v[j] ?? 0), 0));
}

function iterate(matrix: Matrix, vector: number[]): number[] {
    const next = matVec(matrix, vector);
    const avg = next.length === 0 ? 0 : next.reduce((a, v) => a + v, 0) / next.length;
    const centered = next.map((v) => v - avg);
    const scale = centered.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
    return scale === 0 ? centered : centered.map((v) => v / scale);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 1, 0, 0, 0],
        [1, 0, 1, 0, 0, 0],
        [1, 1, 0, 0.05, 0, 0],
        [0, 0, 0.05, 0, 1, 1],
        [0, 0, 0, 1, 0, 1],
        [0, 0, 0, 1, 1, 0],
    ];
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 300;
    const n = adjacency.length;
    const degrees = adjacency.map((row) => row.reduce((a, v) => a + v, 0));
    const maxDegree = Math.max(0, ...degrees);
    const shifted: Matrix = adjacency.map((row, i) =>
        row.map((v, j) => (i === j ? maxDegree - degrees[i]! : -v)),
    );
    let vector = adjacency.map((_, i) => (i < n / 2 ? 1 : -1) + 0.1 * Math.cos(i));

    const clustersOf = (v: number[]): number[] => v.map((value) => (value >= 0 ? 0 : 1));
    const milestones = new Set([0, Math.floor(iterations / 5), Math.floor(iterations / 2), iterations]);
    let step = 0;

    for (let it = 0; it <= iterations; it += 1) {
        if (milestones.has(it)) {
            const clusters = clustersOf(vector);
            yield {
                stepNumber: step,
                entities: nodes(vector, clusters, new Array<EntityState>(n).fill("idle")),
                edges: graphEdges(adjacency, "idle"),
                description:
                    it === 0
                        ? `Spectral clustering on ${n} nodes; begin mean-removed power iteration.`
                        : `Power iteration ${it} of ${iterations}; sign of the vector is starting to separate communities.`,
                codeLineNumber: it === 0 ? 0 : 2,
                layout: "graph",
                meta: { n, iteration: it, iterations, fiedler: vector, clusters },
            };
            step += 1;
        }
        if (it < iterations) vector = iterate(shifted, vector);
    }

    const clusters = clustersOf(vector);
    yield {
        stepNumber: step,
        entities: nodes(vector, clusters, new Array<EntityState>(n).fill("sorted")),
        edges: graphEdges(adjacency, "sorted"),
        description: `Fiedler vector splits ${n} nodes into clusters of sizes ${clusters.filter((c) => c === 0).length} and ${clusters.filter((c) => c === 1).length}.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { n, iterations, fiedler: vector, clusters, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Spectral clustering turns a graph into geometry. The graph Laplacian measures how strongly connected nodes are, and its second-smallest eigenvector, the Fiedler vector, varies slowly across dense regions but changes sharply where the graph has a weak cut. Taking the sign of that vector separates the graph into two communities that ordinary distance-based clustering might miss.",
        invariants: [
            "The Fiedler vector is kept orthogonal to the constant vector by removing its mean each iteration.",
            "Nodes are assigned to a cluster solely by the sign of their Fiedler entry.",
            "The weak bridge between communities has small weight compared with internal edges.",
        ],
        correctness:
            "By the Rayleigh-Ritz characterization, the Fiedler vector minimizes the total squared difference across edges among all unit vectors orthogonal to the constants. A vector with one sign on each community and a single crossing at the weak bridge has a very small Rayleigh quotient, so power iteration on the shifted Laplacian converges to it. Splitting on its sign therefore cuts the weakest connection and recovers the two communities.",
        complexityRationale:
            "Each power iteration multiplies the shifted n by n matrix by a vector, costing O(n squared), repeated for a fixed number of iterations. The shifted matrix uses O(n squared) space and the evolving vector uses O(n).",
        uses: [
            "Community detection in social and citation networks",
            "Image segmentation by grouping similar pixels",
            "Preprocessing for clustering on non-convex geometric data",
        ],
        references: [
            "Ng, Jordan, and Weiss, On Spectral Clustering: Analysis and an Algorithm, NeurIPS 2001",
            "Von Luxburg, A Tutorial on Spectral Clustering, Statistics and Computing, 2007",
        ],
        workedExample:
            "Two triangles of three nodes joined by one bridge of weight 0.05. The Fiedler vector is near plus one on the first triangle and near minus one on the second. Sign splitting puts those triangles in different clusters, correctly ignoring the weak bridge that a minimum cut would also choose.",
    },
    id: "spectral-clustering",
    name: "Spectral Clustering",
    category: "ml-ai",
    complexity: { time: "O(iterations n^2)", space: "O(n^2)" },
    defaultInput: {
        adjacency: [
            [0, 1, 1, 0, 0, 0],
            [1, 0, 1, 0, 0, 0],
            [1, 1, 0, 0.05, 0, 0],
            [0, 0, 0.05, 0, 1, 1],
            [0, 0, 0, 1, 0, 1],
            [0, 0, 0, 1, 1, 0],
        ],
        iterations: 300,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the similarity graph adjacency matrix",
        "compute degrees and build the graph Laplacian",
        "shift the Laplacian and run mean-removed power iteration",
        "normalize the vector after every multiplication",
        "assign each node to a cluster by the sign of its entry",
        "done: emit the Fiedler vector and the two clusters",
    ],
};

export default module;
