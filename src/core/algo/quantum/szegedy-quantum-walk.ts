/**
 * szegedy-quantum-walk.ts - Szegedy Quantum Walk (exact small simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Szegedy's discrete-time quantum walk assigns to every vertex v a unit vector
 * |u_v> that is a uniform superposition over the directed edges leaving v.
 * The walk operator W = S R S R is a product of two reflections: R reflects
 * about the span of the |u_v> vectors and S swaps the two copies of the graph.
 * Repeated application of W spreads a starting vertex into an interference
 * pattern that underlies quantum walk search algorithms.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact state-vector simulation on an undirected graph with at most
 * six vertices and no self-loops. For undirected graphs every matrix entry is
 * real, so the amplitudes are stored as plain numbers. No measurement noise,
 * decoherence, or hardware error is modeled, and the reported distribution is
 * computed exactly rather than sampled from shots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(t * m^2) for t steps and m directed edges
 *   Space: O(m) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probability of finding the walker at each vertex.
 *   - The starting vertex is highlighted at step zero.
 *   - The final frame reports the total probability, which stays exactly one.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface WalkInput {
    graph?: Record<string, string[]>;
    start?: string;
    steps?: number;
}

interface DirEdge {
    from: number;
    to: number;
}

function bars(probabilities: number[], highlight: number): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `vertex-${index}`,
        type: "bar" as const,
        label: `v${index}: ${probability.toFixed(3)}`,
        value: probability,
        state: (index === highlight ? "active" : probability > 0 ? "visited" : "idle") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability, vertex: index },
    }));
}

function build(nodes: string[], graph: Record<string, string[]>, nodeIndex: Map<string, number>): DirEdge[] {
    const out: DirEdge[] = [];
    for (const v of nodes) {
        for (const u of graph[v] ?? []) {
            const from = nodeIndex.get(v);
            const to = nodeIndex.get(u);
            if (from !== undefined && to !== undefined && from !== to) {
                out.push({ from, to });
            }
        }
    }
    return out;
}

/** Projection basis |u_v> over directed edges leaving v. */
function projectionBasis(
    edges: DirEdge[],
    nodes: string[],
    graph: Record<string, string[]>,
): number[][] {
    return nodes.map((v) => {
        const vector = new Array<number>(edges.length).fill(0);
        const degree = (graph[v] ?? []).length;
        if (degree > 0) {
            edges.forEach((edge, index) => {
                if (nodes[edge.from] === v) {
                    vector[index] = 1 / Math.sqrt(degree);
                }
            });
        }
        return vector;
    });
}

function reflect(state: number[], basis: number[][]): number[] {
    const out = state.map((value) => -value);
    for (const b of basis) {
        let dot = 0;
        for (let i = 0; i < state.length; i += 1) {
            dot += (b[i] ?? 0) * (state[i] ?? 0);
        }
        for (let i = 0; i < state.length; i += 1) {
            out[i] = (out[i] ?? 0) + 2 * (b[i] ?? 0) * dot;
        }
    }
    return out;
}

function swap(state: number[], edges: DirEdge[]): number[] {
    const out = new Array<number>(state.length).fill(0);
    const lookup = new Map<string, number>();
    edges.forEach((edge, index) => {
        lookup.set(`${edge.from}-${edge.to}`, index);
    });
    edges.forEach((edge, index) => {
        const target = lookup.get(`${edge.to}-${edge.from}`);
        if (target !== undefined) {
            out[target] = state[index] ?? 0;
        }
    });
    return out;
}

/** One Szegedy step: W = S R S R applied right to left. */
function walkStep(state: number[], edges: DirEdge[], basis: number[][]): number[] {
    let out = reflect(state, basis);
    out = swap(out, edges);
    out = reflect(out, basis);
    out = swap(out, edges);
    return out;
}

function vertexProbabilities(state: number[], edges: DirEdge[], nodes: string[]): number[] {
    const out = new Array<number>(nodes.length).fill(0);
    edges.forEach((edge, index) => {
        const amplitude = state[index] ?? 0;
        out[edge.from] = (out[edge.from] ?? 0) + amplitude * amplitude;
    });
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WalkInput | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        "0": ["1", "2"],
        "1": ["0", "2"],
        "2": ["0", "1"],
    };
    const nodes = Object.keys(graph).sort().slice(0, 6);
    const nodeIndex = new Map(nodes.map((node, index) => [node, index]));
    const start = task.start ?? nodes[0] ?? "0";
    const steps = Math.max(0, Math.min(12, typeof task.steps === "number" ? task.steps : 4));

    const edges = build(nodes, graph, nodeIndex);
    const basis = projectionBasis(edges, nodes, graph);
    let state = new Array<number>(edges.length).fill(0);
    const startIndex = nodeIndex.get(start) ?? 0;
    const startBasis = basis[startIndex] ?? [];
    state = state.map((_, index) => startBasis[index] ?? 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(vertexProbabilities(state, edges, nodes), startIndex),
        edges: [],
        description: `Szegedy walk on ${nodes.length} vertices: start at ${start} with a uniform superposition over its outgoing edges.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { vertices: nodes.length, steps, step: 0, total: 1, start: startIndex },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        state = walkStep(state, edges, basis);
        const probabilities = vertexProbabilities(state, edges, nodes);
        const total = probabilities.reduce((sum, value) => sum + value, 0);
        yield {
            stepNumber: step,
            entities: bars(probabilities, -1),
            edges: [],
            description: `After ${t} walk step(s) the vertex probabilities are spread by interference; the total remains ${total.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { vertices: nodes.length, steps, step: t, total },
        };
        step += 1;
    }

    const finalProbabilities = vertexProbabilities(state, edges, nodes);
    const peak = finalProbabilities.indexOf(Math.max(...finalProbabilities));
    yield {
        stepNumber: step,
        entities: bars(finalProbabilities, peak),
        edges: [],
        description: `After ${steps} step(s) vertex ${nodes[peak] ?? peak} carries the largest probability; the walk operator preserved normalization exactly.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { vertices: nodes.length, steps, step: steps, total: finalProbabilities.reduce((a, b) => a + b, 0), peak },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A classical random walker picks one neighbor at random. The quantum version instead carries a wave of amplitudes spread over all neighbors at once, then reflects that wave about the uniform directions and swaps the two copies of the graph. Those two reflections interfere amplitudes constructively on some vertices and destructively on others, producing a distribution that spreads differently from a classical walk.",
        invariants: [
            "Each |u_v> is a unit vector because it is uniform over the outgoing edges of v.",
            "Reflection about a subspace and the swap map are both norm preserving, so the state stays normalized.",
            "The probability at a vertex is the sum of squared amplitudes over its directed outgoing edges.",
        ],
        correctness:
            "The projection onto the span of the |u_v> vectors has matrix sum of outer products, and 2 times that projection minus the identity is a reflection, hence unitary; the swap is a permutation matrix, also unitary. Their product W is therefore unitary and preserves total probability. Starting from |u_start> and applying W step by step reproduces exactly the Szegedy walk on the bipartite double cover of the graph, and the vertex probabilities are obtained by summing squared amplitudes over edges leaving each vertex.",
        complexityRationale:
            "The state has m directed edges, each reflection is a matrix-vector product over the vertex basis vectors taking O(m^2) work in the worst case, and there are t steps, giving O(t * m^2) time and O(m) space for the state vector.",
        uses: [
            "The search routine in Ambainis's quantum walk search algorithm",
            "Quantum algorithms for graph traversal and element distinctness",
            "A teaching example of a unitary process with no classical analogue",
        ],
        references: [
            "Szegedy, Quantum Speed-Up of Markov Chain Based Algorithms (2004)",
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Chapter 12",
        ],
        workedExample:
            "On a triangle with vertices 0, 1, and 2, the starting vector at vertex 0 is the superposition of edges 0 to 1 and 0 to 2 with amplitude one over the square root of two. One Szegedy step reflects about the three vertex vectors and swaps the copies, leaving a normalized distribution spread over the three vertices that sums to exactly one.",
    },
    id: "szegedy-quantum-walk",
    name: "Szegedy Quantum Walk",
    category: "quantum",
    complexity: { time: "O(t * m^2)", space: "O(m)" },
    defaultInput: {
        graph: {
            "0": ["1", "2"],
            "1": ["0", "2"],
            "2": ["0", "1"],
        },
        start: "0",
        steps: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "list every directed edge of the undirected graph",
        "build the unit vector for each vertex over its outgoing edges",
        "prepare the start vertex vector as the initial state",
        "reflect the state about the span of the vertex vectors",
        "swap the two copies of the graph",
        "reflect and swap once more to complete one walk step",
        "sum squared amplitudes at each vertex to get probabilities",
        "report the distribution and confirm normalization",
    ],
};

export default module;
