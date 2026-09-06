/**
 * karp-minimum-mean-cycle.ts – Karp's Minimum Mean Weight Cycle
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A directed cycle's *mean weight* is its total weight divided by its number
 * of edges. Karp's algorithm finds the cycle with the minimum mean weight in a
 * directed graph (a quantity related to optimal scheduling and rate analysis).
 *
 * The method uses dynamic programming: define `dp[k][v]` as the minimum total
 * weight of a walk of exactly k edges ending at v. For each vertex v, the
 * minimum mean cycle value λ* is
 *
 *   λ* = min over v of max over k of (dp[n][v] − dp[k][v]) / (n − k)
 *
 * computed over the n vertices (n = |V|). The educational implementation
 * below runs the DP table and highlights the best vertex at the end.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V × E)
 *   Space: O(V) per layer (only two layers kept)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being updated in the DP row is YELLOW (comparing).
 *   - The candidate minimum-mean vertex is PINK (highlight).
 *   - The final answer is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a directed graph; cycles must exist for a finite answer.
 *   - Connects graph algorithms with dynamic programming in a neat way.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "../graph/graph-util";

/**
 * The Karp Minimum Mean Cycle generator.
 *
 * @param input `{ graph, vertices? }` – a weighted adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [["B", 4]],
        B: [["C", 1]],
        C: [["A", 1]],
        D: [["C", 2]],
    };
    const vertices = task.vertices ?? ["A", "B", "C", "D"];

    const n = vertices.length;
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(
        Object.fromEntries(Object.entries(graph).map(([k, v]) => [k, v.map(([t]) => t)])),
    );

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Karp's minimum mean cycle – DP over walk lengths.",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: {},
    });

    // dp[v] = best walk cost of the current length ending at v.
    // Use a virtual source so every vertex starts at 0 with length 0.
    const dp: number[] = new Array(n).fill(0);
    const prev: number[] = new Array(n).fill(Infinity);
    // history[k] records dp after exactly k edges.
    const history: number[][] = [new Array(n).fill(0)];

    // Run the DP for exactly n edge counts (Karp's recipe).
    for (let k = 1; k <= n; k += 1) {
        const next: number[] = new Array(n).fill(Infinity);
        for (let i = 0; i < n; i += 1) {
            const fromVertex = vertices[i];
            if (!fromVertex) {
                continue;
            }
            if (dp[i] === Infinity) {
                continue;
            }
            for (const [to, weight] of graph[fromVertex] ?? []) {
                const j = vertices.indexOf(to);
                if (j < 0) {
                    continue;
                }
                const alt = dp[i] + weight;
                if (alt < (next[j] ?? Infinity)) {
                    next[j] = alt;
                }
            }
        }

        // Show the current DP row (clearing last row's highlights first).
        for (const node of nodes) {
            node.state = "unvisited";
        }
        for (let v = 0; v < n; v += 1) {
            if (next[v] !== Infinity) {
                const node = nodeById.get(`node-${vertices[v]}`);
                if (node) {
                    node.state = "comparing";
                    node.label = String(next[v]);
                }
            }
        }
        yield buildFrame(`DP row after ${k} edge(s).`);
        step += 1;

        dp.splice(0, dp.length, ...next);
        history.push([...next]);
    }

    // ------------------------------------------------------------------
    // Compute λ* = min over v of max over k of (dp[n][v] − dp[k][v]) / (n − k).
    // ------------------------------------------------------------------
    let bestVertex = "";
    let bestMean = Infinity;

    for (let v = 0; v < n; v += 1) {
        const dpN = dp[v];
        if (dpN === undefined || dpN === Infinity) {
            continue;
        }
        let worst = -Infinity;
        for (let k = 0; k < n; k += 1) {
            const dpK = history[k]?.[v];
            if (dpK === undefined || dpK === Infinity) {
                continue;
            }
            const candidate = (dpN - dpK) / (n - k);
            if (candidate > worst) {
                worst = candidate;
            }
        }
        if (worst < bestMean) {
            bestMean = worst;
            bestVertex = vertices[v] ?? "";
        }
    }

    // Highlight the winning vertex.
    if (bestVertex) {
        const winner = nodeById.get(`node-${bestVertex}`);
        if (winner) {
            winner.state = "highlight";
        }
        yield buildFrame(
            `Minimum mean cycle value λ* = ${bestMean.toFixed(2)}, achieved at vertex ${bestVertex}.`,
        );
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            bestVertex === ""
                ? "No cycle exists – no finite minimum mean."
                : `Minimum mean cycle weight ≈ ${bestMean.toFixed(2)} (vertex ${bestVertex}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { minMean: bestMean, vertex: bestVertex },
    };
}

/** The Karp Minimum Mean Cycle module, registered with the engine. */
const module: AlgorithmModule = {
    id: "karp-minimum-mean-cycle",
    name: "Karp Minimum Mean Cycle",
    category: "shortest-path",
    complexity: { time: "O(V × E)", space: "O(V)" },
    // Cycle A→B→C→A has mean (4+1+1)/3 = 2; D→C is a feeder edge.
    defaultInput: {
        graph: {
            A: [["B", 4]],
            B: [["C", 1]],
            C: [["A", 1]],
            D: [["C", 2]],
        },
        vertices: ["A", "B", "C", "D"],
    },
    visualType: "graph",
    run,
};

export default module;
