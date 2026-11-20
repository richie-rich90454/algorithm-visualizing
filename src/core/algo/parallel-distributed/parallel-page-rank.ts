/**
 * parallel-page-rank.ts - Parallel Jacobi PageRank Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PageRank assigns a stationary importance score to each node of a directed
 * graph. On every round each node receives a share of the rank of every node
 * pointing to it, plus a small teleportation term. All nodes are updated from
 * the same previous vector, so the work is parallel across nodes. Dangling
 * nodes with no out-links spread their rank uniformly. This is the classical
 * iterative algorithm on a small graph, not a distributed production crawler.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(iterations * (n + m)) for n nodes and m links
 *   Space: O(n + m) for the ranks and the adjacency lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per node shows its current rank.
 *   - Bars are yellow while ranks move and green at convergence.
 *   - Rank sum, change between rounds, and iteration count are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Link = [number, number];

/** Build the rank bars for one round. */
function makeBars(ranks: number[], state: EntityState): VisualEntity[] {
    return ranks.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, node: index },
    }));
}

/** The parallel PageRank generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; edges?: Link[]; damping?: number; iterations?: number; tol?: number } | null) ?? {};
    const n = typeof task.nodes === "number" && task.nodes >= 1 && task.nodes <= 12
        ? Math.floor(task.nodes)
        : 4;
    const edges = Array.isArray(task.edges)
        ? task.edges.filter((edge) => Array.isArray(edge) && edge.length === 2).map((edge) => [Math.floor(edge[0]), Math.floor(edge[1])] as Link)
        : [[0, 1], [0, 2], [1, 2], [2, 0]];
    const damping = typeof task.damping === "number" && task.damping > 0 && task.damping < 1
        ? task.damping
        : 0.85;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 30;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-10;

    const outDegree = new Array<number>(n).fill(0);
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n) {
            outDegree[u] = (outDegree[u] ?? 0) + 1;
        }
    }
    let ranks = new Array<number>(n).fill(1 / n);
    const sum = () => ranks.reduce((total, value) => total + value, 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(ranks, "idle"),
        edges: [],
        description: `Starting PageRank on ${n} nodes with ${edges.length} links and damping ${damping}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, ranks: [...ranks], sum: sum(), delta: 0, converged: false },
    };
    step += 1;

    let converged = false;
    let used = 0;
    for (let iteration = 0; iteration < iterations && !converged; iteration += 1) {
        const dangling = ranks.reduce((total, value, i) => total + ((outDegree[i] ?? 0) === 0 ? value : 0), 0);
        const next = new Array<number>(n).fill((1 - damping) / n + (damping * dangling) / n);
        for (const [u, v] of edges) {
            if (u >= 0 && u < n && v >= 0 && v < n && (outDegree[u] ?? 0) > 0) {
                next[v] = (next[v] ?? 0) + (damping * (ranks[u] ?? 0)) / (outDegree[u] ?? 1);
            }
        }
        const delta = next.reduce((total, value, i) => total + Math.abs(value - (ranks[i] ?? 0)), 0);
        ranks = next;
        used = iteration + 1;
        converged = delta < tol;
        yield {
            stepNumber: step,
            entities: makeBars(ranks, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Round ${used}: ranks sum to ${sum().toFixed(10)}, total change ${delta.toExponential(2)}.`,
            codeLineNumber: converged ? 5 : 2,
            layout: "array",
            meta: { iteration: used, ranks: [...ranks], sum: sum(), delta, converged },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(ranks, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} round(s): ${ranks.map((value) => value.toFixed(4)).join(", ")}.`
            : `Stopped after ${used} round(s): ${ranks.map((value) => value.toFixed(4)).join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { iteration: used, ranks: [...ranks], sum: sum(), delta: 0, converged },
    };
}

/** The parallel PageRank module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A link is a vote of confidence. Each node starts with the same score and passes a fraction of its score to the nodes it links to, splitting the payment evenly among its out-links. A small teleport term keeps the walk from getting stuck, and nodes with no out-links spread their score everywhere. Every node's new score depends only on old scores, so all updates can run at once.",
        invariants: [
            "The ranks always sum to one, including the contribution from dangling nodes.",
            "Each round reads only the previous rank vector, never partially updated values.",
            "Ranks stay nonnegative and each node receives at least the teleportation share.",
        ],
        correctness:
            "The update multiplies the rank vector by a column-stochastic transition matrix and adds the teleportation vector, so the total stays one. The damping factor makes the matrix a contraction in the total variation norm, so repeated multiplication converges to the unique stationary distribution by the Perron-Frobenius theorem. Summing the change between rounds gives a practical stopping test.",
        complexityRationale:
            "One round visits every link once and every node once, so the work is O(n + m) per round and O(iterations * (n + m)) total. The adjacency lists and two rank vectors require O(n + m) space.",
        uses: [
            "Ranking web pages in search engines",
            "Measuring influence in social and citation networks",
            "Identifying important nodes in biological and transportation graphs",
        ],
        references: [
            "Page et al., The PageRank Citation Ranking: Bringing Order to the Web, 1999",
            "Langville and Meyer, Google's PageRank and Beyond, 2006",
        ],
        workedExample:
            "With four nodes and links 0 to 1, 0 to 2, 1 to 2, and 2 to 0, node 3 is dangling. Starting from 0.25 each, node 2 gains shares from 0 and 1 while the dangling share is spread evenly. After a few rounds the ranks settle near 0.22, 0.24, 0.32, 0.21 in some order, always summing to one.",
    },
    id: "parallel-page-rank",
    name: "Parallel PageRank (Jacobi Iteration)",
    category: "parallel-distributed",
    complexity: { time: "O(iterations * (n + m))", space: "O(n + m)" },
    defaultInput: { nodes: 4, edges: [[0, 1], [0, 2], [1, 2], [2, 0]], damping: 0.85, iterations: 30, tol: 1e-10 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every node to one over n",
        "count the out-links of every node",
        "repeat until the total change is small",
        "give each target a share of its sources' ranks",
        "spread dangling rank evenly over all nodes",
        "add the teleportation share to every node",
        "replace all ranks at once from the old vector",
        "done: report the stationary rank vector",
    ],
};

export default module;
