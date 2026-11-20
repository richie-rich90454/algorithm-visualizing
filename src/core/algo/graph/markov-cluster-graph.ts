/**
 * markov-cluster-graph.ts - Markov Cluster Algorithm (MCL)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MCL clusters a graph by simulating a random walk and repeatedly sharpening
 * it. Alternating expansion (matrix squaring, which spreads flow over longer
 * paths) with inflation (raising entries to a power and renormalizing, which
 * strengthens strong currents and kills weak ones) drives the matrix toward a
 * block-diagonal form. Each block marks one cluster. Weak bridges between
 * dense regions fade away, so MCL separates communities without being told
 * how many there are.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * V^3) for t iterations of dense matrix multiplication
 *   Space: O(V^2) for the stochastic matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cluster gets its own node color.
 *   - meta carries the iteration count, residual, and final clusters.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface MclInput {
    edges?: Array<[string, string]>;
    inflation?: number;
    iterations?: number;
    tolerance?: number;
}

type Matrix = number[][];

const FALLBACK_EDGES: Array<[string, string]> = [
    ["A", "B"], ["B", "C"], ["A", "C"], ["C", "D"], ["D", "E"], ["E", "F"], ["D", "F"],
];
const CLUSTER_STATES: EntityState[] = ["visited", "comparing", "highlight", "sorted", "active", "path"];

/** Build the column-stochastic matrix with a self-loop on every vertex. */
function buildMatrix(size: number, index: Map<string, number>, edgesIn: Array<[string, string]>): Matrix {
    const matrix: Matrix = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (i === j ? 1 : 0)),
    );
    for (const [a, b] of edgesIn) {
        const i = index.get(a);
        const j = index.get(b);
        if (i === undefined || j === undefined) {
            continue;
        }
        matrix[i]![j] = 1;
        matrix[j]![i] = 1;
    }
    return matrix;
}

/** Normalize every column of a nonnegative matrix to sum to one. */
function normalizeColumns(matrix: Matrix): Matrix {
    const size = matrix.length;
    const result: Matrix = matrix.map((row) => [...row]);
    for (let col = 0; col < size; col += 1) {
        let total = 0;
        for (let row = 0; row < size; row += 1) {
            total += result[row]![col] ?? 0;
        }
        if (total > 0) {
            for (let row = 0; row < size; row += 1) {
                result[row]![col] = (result[row]![col] ?? 0) / total;
            }
        }
    }
    return result;
}

/** Square a square matrix. */
function square(matrix: Matrix): Matrix {
    const size = matrix.length;
    const result: Matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
            let sum = 0;
            for (let k = 0; k < size; k += 1) {
                sum += (matrix[i]![k] ?? 0) * (matrix[k]![j] ?? 0);
            }
            result[i]![j] = sum;
        }
    }
    return result;
}

/** Raise every entry to a power and renormalize columns. */
function inflate(matrix: Matrix, power: number): Matrix {
    const raised = matrix.map((row) => row.map((value) => Math.pow(value, power)));
    return normalizeColumns(raised);
}

/** Largest absolute difference between two matrices. */
function maxDifference(a: Matrix, b: Matrix): number {
    let worst = 0;
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1) {
            worst = Math.max(worst, Math.abs((a[i]![j] ?? 0) - (b[i]![j] ?? 0)));
        }
    }
    return worst;
}

/** Connected components of the support graph of a stochastic matrix. */
function extractClusters(matrix: Matrix): number[][] {
    const size = matrix.length;
    const label = new Array<number>(size).fill(-1);
    const clusters: number[][] = [];
    const cutoff = 1e-3;
    for (let seed = 0; seed < size; seed += 1) {
        if (label[seed] !== -1) {
            continue;
        }
        const group: number[] = [];
        const stack = [seed];
        label[seed] = clusters.length;
        while (stack.length > 0) {
            const current = stack.pop() as number;
            group.push(current);
            for (let other = 0; other < size; other += 1) {
                if (label[other] !== -1) {
                    continue;
                }
                const linked = (matrix[current]![other] ?? 0) > cutoff || (matrix[other]![current] ?? 0) > cutoff;
                if (linked) {
                    label[other] = clusters.length;
                    stack.push(other);
                }
            }
        }
        clusters.push(group.sort((a, b) => a - b));
    }
    return clusters;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MclInput | null) ?? {};
    const raw = Array.isArray(task.edges) && task.edges.length > 0 ? task.edges : FALLBACK_EDGES;
    const edgesIn = raw.filter(
        (pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string" && pair[0] !== pair[1],
    );
    const labels = [...new Set(edgesIn.flatMap(([a, b]) => [a, b]))].sort();
    const power = typeof task.inflation === "number" && task.inflation > 1 ? task.inflation : 2;
    const maxIterations = Math.min(60, Math.max(1, Math.floor(Number(task.iterations ?? 24)) || 24));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-6;
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph – no clusters to find.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { clusters: [], iterations: 0, converged: true, residual: 0 },
        };
        return;
    }

    const index = new Map(labels.map((label, i) => [label, i]));
    let matrix = normalizeColumns(buildMatrix(labels.length, index, edgesIn));
    const nodes = makeGraphNodes(labels);
    const simpleAdjacency: Record<string, string[]> = {};
    for (const label of labels) {
        simpleAdjacency[label] = [...new Set(edgesIn.flatMap(([a, b]) => (a === label ? [b] : b === label ? [a] : [])))].sort();
    }
    const edges = makeGraphEdges(simpleAdjacency);
    for (const edge of edges) {
        edge.directed = false;
    }

    let clusters = extractClusters(matrix);
    let residual = 0;
    let iterations = 0;
    let converged = false;

    const paint = (assignment: number[][]): void => {
        for (const node of nodes) {
            node.state = "unvisited";
        }
        assignment.forEach((group, clusterIndex) => {
            for (const member of group) {
                const node = nodes[member];
                if (node) {
                    node.state = CLUSTER_STATES[clusterIndex % CLUSTER_STATES.length] ?? "visited";
                }
            }
        });
        for (const edge of edges) {
            edge.state = "idle";
        }
    };
    const snapshot = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: 0,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta: {
            clusters: clusters.map((group) => group.map((member) => labels[member] ?? "")),
            clusterCount: clusters.length,
            iterations,
            residual,
            converged,
            inflation: power,
        },
    });

    paint(clusters);
    let step = 0;
    const setup = snapshot(`MCL with inflation ${power}: before iteration the whole graph is one loose component.`, 0);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const expanded = square(matrix);
        const inflated = inflate(expanded, power);
        residual = maxDifference(inflated, matrix);
        matrix = inflated;
        iterations = iteration;
        clusters = extractClusters(matrix);
        paint(clusters);
        converged = residual < tolerance;
        const frame = snapshot(
            `Iteration ${iteration}: ${clusters.length} cluster(s), residual ${residual.toExponential(2)}.`,
            converged ? 5 : 3,
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
        if (converged) {
            break;
        }
    }

    clusters = extractClusters(matrix);
    paint(clusters);
    const final = snapshot(
        `Settled after ${iterations} iteration(s): ${clusters.length} cluster(s) [${clusters.map((group) => group.map((member) => labels[member]).join("")).join(" | ")}].`,
        6,
    );
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a token drifting along random edges. Squaring the transition matrix lets it travel two steps, which mixes information across a neighborhood. Raising each probability to a power and renormalizing then amplifies the strong routes and starves the weak ones. Repeating this erodes bridges between communities until flow stays inside dense groups, and those groups are the clusters.",
        invariants: [
            "Every column of the matrix stays nonnegative and sums to one after normalization.",
            "Inflation preserves the support only where flow is strong enough to survive the power.",
            "Cluster extraction partitions every vertex into exactly one component.",
        ],
        correctness:
            "Expansion computes two-step transition probabilities, so a weak inter-community edge contributes a product of two small factors. Inflation raises each entry above one to a larger power, shrinking small entries far more than large ones before renormalization restores the column sum. Over iterations, entries across a sparse bridge vanish while entries inside a dense community persist, driving the matrix block diagonal; connected components of its support are therefore the communities.",
        complexityRationale:
            "Each iteration performs a dense matrix square in O(V^3) time and elementwise inflation in O(V^2); storage is a single V by V matrix, so space is O(V^2).",
        uses: [
            "Community detection in biological protein interaction networks",
            "Clustering documents and citation graphs without a preset cluster count",
            "Segmenting social networks into tightly knit groups",
        ],
        references: [
            "van Dongen, Graph Clustering by Flow Simulation, 2000",
            "van Dongen, A New Algorithm for Clustering Structural Analysis Data, 2008",
        ],
        workedExample:
            "Two triangles joined by a single edge have a weak bridge. After expansion a token crosses the bridge only through a two-step product; inflation shrinks that product sharply while the dense triangle edges survive, so the matrix splits into two blocks and the vertices separate into two clusters.",
    },
    id: "markov-cluster-graph",
    name: "Markov Cluster Algorithm",
    category: "graph",
    complexity: { time: "O(t * V^3)", space: "O(V^2)" },
    defaultInput: {
        edges: [["A", "B"], ["B", "C"], ["A", "C"], ["C", "D"], ["D", "E"], ["E", "F"], ["D", "F"]],
        inflation: 2,
        iterations: 24,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a column-stochastic matrix with self-loops",
        "expand by squaring the matrix",
        "inflate by raising entries to a power and renormalizing columns",
        "measure the change since the previous matrix",
        "repeat expansion and inflation until the change is tiny",
        "find components of the matrix support as clusters",
        "done: report the final clusters",
    ],
};

export default module;
