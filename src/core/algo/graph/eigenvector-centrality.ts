/**
 * eigenvector-centrality.ts - Eigenvector Centrality
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A vertex is important in the eigenvector sense when it is linked to other
 * important vertices. Each node starts with the same score; on every round a
 * node's new score is the sum of the scores flowing in from its neighbors,
 * rescaled to unit length. Repeating this power iteration converges to the
 * principal eigenvector of the adjacency matrix, whose entries are the
 * eigenvector centralities. Unlike PageRank there is no damping or teleport
 * term, and unlike Katz centrality there is no walk-length discount.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * E)   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are colored by score: the leader is yellow, others visited.
 *   - Node labels carry the current numeric score.
 *   - Final frame marks the ranking in green.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; iterations?: number } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D", "E"],
        B: ["A", "C"],
        C: ["A", "B"],
        D: ["A", "E"],
        E: ["A", "D"],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.min(200, task.iterations)) : 40;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let step = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        scores: number[],
        states: Map<string, EntityState> = new Map(),
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        for (const n of nodes) {
            const v = String((n.metadata as Record<string, unknown>).label);
            const i = labels.indexOf(v);
            n.label = `${v}:${(scores[i] ?? 0).toFixed(3)}`;
            n.state = states.get(v) ?? "unvisited";
        }
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                iteration: extra.iteration ?? 0,
                lambda: extra.lambda ?? 0,
                scores: labels.map((v, i) => `${v}:${(scores[i] ?? 0).toFixed(6)}`),
                ...extra,
            },
        };
    };
    void byId;

    if (labels.length === 0) {
        yield snap("Empty graph - nothing to rank.", 0, []);
        return;
    }

    const n = labels.length;
    const index = new Map(labels.map((v, i) => [v, i]));
    let x = new Array<number>(n).fill(1 / Math.sqrt(n));
    yield snap(`All ${n} nodes start with equal score ${(1 / Math.sqrt(n)).toFixed(3)}.`, 0, x);
    step += 1;

    let lambda = 0;
    for (let k = 1; k <= iterations; k += 1) {
        const next = new Array<number>(n).fill(0);
        for (const [source, targets] of Object.entries(adjacency)) {
            const si = index.get(source);
            if (si === undefined) continue;
            for (const target of targets) {
                const ti = index.get(target);
                if (ti !== undefined) next[ti] = (next[ti] as number) + (x[si] as number);
            }
        }
        const norm = Math.sqrt(next.reduce((s, v) => s + v * v, 0));
        if (norm === 0) {
            lambda = 0;
            break;
        }
        x = next.map((v) => v / norm);
        lambda = norm;

        let leader = 0;
        for (let i = 1; i < n; i += 1) if ((x[i] as number) > (x[leader] as number)) leader = i;
        const states = new Map<string, EntityState>([[labels[leader] as string, "comparing"]]);
        yield snap(
            `Iteration ${k}: strongest node ${labels[leader]} at ${(x[leader] as number).toFixed(4)}, lambda≈${lambda.toFixed(4)}.`,
            2,
            x,
            states,
            { iteration: k, lambda },
        );
        step += 1;
    }

    const states = new Map<string, EntityState>();
    for (const v of labels) states.set(v, "sorted");
    yield snap(
        `Converged after ${iterations} iteration(s) with eigenvalue ${lambda.toFixed(4)}.`,
        4,
        x,
        states,
        { iteration: iterations, lambda, ranking: [...labels].sort((a, b) => (x[index.get(b) as number] as number) - (x[index.get(a) as number] as number)) },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Being linked to important neighbors matters more than merely having many links. Give every node an equal score, then replace each score by the sum of the scores pointing into it and rescale the whole vector. Nodes connected to high-scoring neighbors climb; the process settles on the principal eigenvector of the adjacency matrix, which is the eigenvector centrality ranking.",
        invariants: [
            "All scores stay nonnegative for a graph with nonnegative adjacency.",
            "After each iteration the score vector has unit Euclidean length.",
            "The scaling factor approaches the largest eigenvalue of the adjacency matrix.",
        ],
        correctness:
            "Write the initial vector as a combination of the eigenvectors of the adjacency matrix A. One iteration multiplies the coefficient of each eigenvector by its eigenvalue, so the component belonging to the largest eigenvalue grows fastest relative to the rest. Normalization keeps the vector bounded, and because that eigenvalue is simple and strictly dominant for a connected aperiodic graph, the iterates converge to the associated eigenvector. At the limit A x equals lambda times x, which is exactly the eigenvector-centrality definition: each node's score is proportional to the sum of its neighbors' scores.",
        complexityRationale:
            "Each iteration visits every directed edge once to gather incoming scores and touches every vertex to normalize, giving O(kE + kV) time, or O(kE) for graphs with at least one edge. Only one score per vertex beyond the graph is stored, so space is O(V).",
        uses: [
            "Ranking influence in social and citation networks",
            "Identifying key proteins in biological interaction graphs",
            "Measuring prestige in directed link structures",
        ],
        references: [
            "Bonacich, Factoring and Weighting Approaches to Status Scores, 1972",
            "Newman, Networks: An Introduction, Chapter 7",
        ],
        workedExample:
            "On a star with center A connected to B, C and D, all nodes begin at 0.5. After one round A receives 1.5 while each leaf receives 0.5; after normalization A is about 0.87 and the leaves about 0.29. Repeating sharpens the lead, so A is correctly the most central node.",
    },
    id: "eigenvector-centrality",
    name: "Eigenvector Centrality",
    category: "graph",
    complexity: { time: "O(k·E)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D", "E"],
            B: ["A", "C"],
            C: ["A", "B"],
            D: ["A", "E"],
            E: ["A", "D"],
        },
        iterations: 40,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "assign every node an equal starting score",
        "for each of k iterations",
        "set each score to the sum of incoming neighbor scores",
        "divide the vector by its Euclidean length",
        "record the scaling factor as the eigenvalue estimate",
        "identify the highest scoring node",
        "repeat until scores stabilize",
        "done: report scores and ranking",
    ],
};

export default module;
