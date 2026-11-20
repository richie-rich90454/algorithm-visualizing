/**
 * katz-centrality.ts - Katz Centrality by Power Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Katz centrality scores a vertex by the weighted number of walks that reach
 * it: one bonus for every neighbor, a discounted bonus for every two-step walk,
 * and so on. In matrix form x equals alpha times A x plus a constant beta, with
 * alpha below the reciprocal of the largest eigenvalue so the series converges.
 * The module iterates that fixed point from a uniform start and reports the
 * scores, the iteration count, and the final residual.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * E) for k power iterations over E edges
 *   Space: O(V) for the score vector plus O(V + E) for the graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A node's label shows its current Katz score.
 *   - The leading node is yellow while the rest are visited.
 *   - meta carries the score vector, the residual, and convergence status.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        edges?: Array<[string, string]>;
        alpha?: number;
        beta?: number;
        iterations?: number;
        tolerance?: number;
    } | null) ?? {};
    const raw = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"]];
    const pairs = raw
        .filter((pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string")
        .map(([a, b]) => [a, b] as [string, string]);
    const labels = [...new Set(pairs.flatMap(([a, b]) => [a, b]))].sort();
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? Math.min(task.alpha, 0.9) : 0.4;
    const beta = typeof task.beta === "number" ? task.beta : 1;
    const maxIterations = Math.min(500, Math.max(1, Math.floor(Number(task.iterations ?? 500)) || 500));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;

    const adjacency: Record<string, string[]> = {};
    for (const label of labels) {
        adjacency[label] = [];
    }
    for (const [a, b] of pairs) {
        if (!adjacency[a] || !adjacency[b]) {
            continue;
        }
        adjacency[a]!.push(b);
        adjacency[b]!.push(a);
    }

    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((node) => [node.id, node]));

    const setScores = (scores: number[]): void => {
        const leader = scores.indexOf(Math.max(...scores));
        labels.forEach((label, index) => {
            const node = byId.get(`node-${label}`);
            if (!node) {
                return;
            }
            node.label = `${label}:${(scores[index] ?? 0).toFixed(3)}`;
            node.value = scores[index] ?? 0;
            node.state = index === leader ? "comparing" : "visited";
        });
        for (const edge of edges) {
            edge.state = "idle";
        }
    };

    let scores = labels.map(() => beta);
    let iterations = 0;
    let residual = 0;
    setScores(scores);

    const meta = (phase: string) => ({
        phase,
        labels,
        centrality: [...scores],
        alpha,
        beta,
        iterations,
        residual,
        converged: residual < tolerance,
        edgeCount: edges.length,
    });

    yield {
        stepNumber: 0,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Katz centrality with alpha ${alpha} and beta ${beta}: every node starts at ${beta.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta("setup"),
    };
    let step = 1;

    const displayEvery = Math.max(1, Math.floor(maxIterations / 12));
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const next = labels.map((vertex, index) => {
            let incoming = 0;
            for (const neighbor of labels) {
                if ((adjacency[neighbor] ?? []).includes(vertex)) {
                    incoming += scores[labels.indexOf(neighbor)] ?? 0;
                }
            }
            return alpha * incoming + (index >= 0 ? beta : 0);
        });
        residual = next.reduce((sum, value, index) => sum + Math.abs(value - (scores[index] ?? 0)), 0);
        scores = next;
        iterations = iteration;
        setScores(scores);
        if (iteration % displayEvery === 0 || residual < tolerance || iteration === maxIterations) {
            const leader = labels[scores.indexOf(Math.max(...scores))] ?? "";
            yield {
                stepNumber: step,
                entities: nodes.map((node) => ({ ...node })),
                edges: edges.map((edge) => ({ ...edge })),
                description: `Iteration ${iteration}: ${leader} leads with score ${(Math.max(...scores)).toFixed(4)}; residual ${residual.toExponential(2)}.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: meta("iterate"),
            };
            step += 1;
        }
        if (residual < tolerance) {
            break;
        }
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Converged after ${iterations} iteration(s): ${labels.map((label, index) => `${label}=${(scores[index] ?? 0).toFixed(3)}`).join(", ")}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: meta("done"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vertex is central in the Katz sense if many walks lead to it, and shorter walks count more than longer ones. Give every vertex a base score, then repeatedly add a discounted copy of each neighbor's score. Because the discount is less than one divided by the graph's largest eigenvalue, the repeated additions settle down, and the settled scores count all walk lengths with geometrically decreasing weight.",
        invariants: [
            "Every score is positive when beta is positive and alpha is nonnegative.",
            "Each update is a linear map followed by the constant beta.",
            "The iterates converge to the unique solution of x equals alpha A x plus beta when alpha is small enough.",
        ],
        correctness:
            "The update is the affine map f(x) equals alpha A x plus beta times the all-ones vector. When alpha is below the reciprocal of the spectral radius of A, the Neumann series identity gives the unique fixed point as beta times the sum over k of alpha to the k times A to the k times ones, which is exactly a weighted count of walks ending at each vertex. Banach's fixed point theorem makes power iteration converge to that unique solution, so the reported scores are the Katz centralities.",
        complexityRationale:
            "Each iteration visits every edge when gathering incoming neighbor scores, giving O(k times E) time; only one score per vertex is stored beyond the graph itself, so the extra space is O(V).",
        uses: [
            "Ranking influence in social and citation networks",
            "Measuring node importance in biological interaction graphs",
            "A walk-based alternative to degree and eigenvector centrality",
        ],
        references: [
            "Katz, A New Status Index Derived from Sociometric Analysis, 1953",
            "Newman, Networks: An Introduction, Chapter 7",
        ],
        workedExample:
            "On the path A-B-C-D with alpha 0.4 and beta 1, A starts at 1 and B receives its own base plus 0.4 from A. After a few rounds the middle vertices B and C outrank the ends because more walks terminate there, and the scores stop changing once the walk discounts balance the incoming flow.",
    },
    id: "katz-centrality",
    name: "Katz Centrality",
    category: "graph",
    complexity: { time: "O(k * E)", space: "O(V)" },
    defaultInput: { edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"]], alpha: 0.4, beta: 1, iterations: 500 },
    visualType: "graph",
    run,
    pseudocode: [
        "build the symmetric adjacency of the undirected graph",
        "set every score to the base value beta",
        "for each vertex sum the current scores of its neighbors",
        "set the new score to beta plus alpha times that sum",
        "measure the largest change across all vertices",
        "repeat until the change falls below the tolerance",
        "done: report the converged Katz scores",
    ],
};

export default module;
