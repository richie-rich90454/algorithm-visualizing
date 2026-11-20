/**
 * gated-graph-attention.ts - Gated Graph Attention Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A gated graph attention layer first scores how relevant each neighbor is to
 * a node, normalizes those scores with a softmax, and aggregates the neighbor
 * values. A learned-style gate then decides how much of the aggregated message
 * to keep versus how much of the node's original value to preserve. This module
 * replays the exact scalar-core computation on a small undirected graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for V nodes and E edges
 *   Space: O(V + E) for neighbor lists and attention weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show values; their labels become attention and gate readouts.
 *   - Edges are drawn between the connected node ids.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GatInput {
    values?: number[];
    edges?: Array<[number, number]>;
    selfLoop?: boolean;
    a?: number;
    leaky?: number;
    wg?: number;
    bg?: number;
}

export interface GatResult {
    neighbors: number[][];
    scores: number[][];
    alphas: number[][];
    aggregated: number[];
    gates: number[];
    output: number[];
}

function leakyRelu(value: number, slope: number): number {
    return value >= 0 ? value : slope * value;
}

function sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
}

function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const total = exps.reduce((sum, v) => sum + v, 0);
    return exps.map((v) => v / total);
}

/** Run one gated attention layer over scalar node values. */
export function gatedGraphAttention(
    values: number[],
    edges: Array<[number, number]>,
    opts: { selfLoop?: boolean; a?: number; leaky?: number; wg?: number; bg?: number } = {},
): GatResult {
    const n = values.length;
    const selfLoop = opts.selfLoop ?? true;
    const a = opts.a ?? 1;
    const leaky = opts.leaky ?? 0.2;
    const wg = opts.wg ?? 1;
    const bg = opts.bg ?? 0;
    const neighbors: number[][] = Array.from({ length: n }, () => []);
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n && u !== v) {
            neighbors[u]?.push(v);
            neighbors[v]?.push(u);
        }
    }
    if (selfLoop) {
        for (let i = 0; i < n; i += 1) {
            neighbors[i]?.unshift(i);
        }
    }

    const scores: number[][] = [];
    const alphas: number[][] = [];
    const aggregated: number[] = [];
    const gates: number[] = [];
    const output: number[] = [];

    for (let i = 0; i < n; i += 1) {
        const neigh = neighbors[i] ?? [];
        const row = neigh.map((j) => leakyRelu(a * (values[i] ?? 0) * (values[j] ?? 0), leaky));
        const alpha = softmax(row);
        let agg = 0;
        for (let k = 0; k < neigh.length; k += 1) {
            agg += (alpha[k] ?? 0) * (values[neigh[k] ?? 0] ?? 0);
        }
        const gate = sigmoid(wg * ((values[i] ?? 0) + agg) + bg);
        scores.push(row);
        alphas.push(alpha);
        aggregated.push(agg);
        gates.push(gate);
        output.push(gate * agg + (1 - gate) * (values[i] ?? 0));
    }
    return { neighbors, scores, alphas, aggregated, gates, output };
}

function nodes(values: number[], labels: string[], phase: string): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState =
            phase === "input" ? "idle" : phase === "message" ? "comparing" : phase === "gate" ? "active" : "sorted";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: labels[index] ?? value.toFixed(2),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, phase },
        };
    });
}

function makeEdges(edges: Array<[number, number]>): VisualEdge[] {
    return edges.map(([u, v], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GatInput | null) ?? {};
    const values: number[] = (task.values ?? [1, -0.5, 2, 0.3]).slice();
    const edges: Array<[number, number]> = (task.edges ?? [[0, 1], [0, 2], [2, 3], [1, 3]]).map(([u, v]) => [u, v]);
    const opts = { selfLoop: task.selfLoop ?? true, a: task.a ?? 1, leaky: task.leaky ?? 0.2, wg: task.wg ?? 1, bg: task.bg ?? 0 };
    const result = gatedGraphAttention(values, edges, opts);
    const edgeEntities = makeEdges(edges);
    const labels = values.map((v) => v.toFixed(2));
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes(values, labels, "input"),
        edges: edgeEntities,
        description: `Read ${values.length} node values and ${edges.length} undirected edges.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "input", n: values.length, values, edges, neighbors: result.neighbors },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(values, result.alphas.map((row) => row.length ? row[0].toFixed(2) : "0"), "message"),
        edges: edgeEntities,
        description: "Leaky scores over neighbors are normalized into attention weights.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { phase: "message", scores: result.scores, alphas: result.alphas },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(result.aggregated, result.aggregated.map((v) => v.toFixed(2)), "message"),
        edges: edgeEntities,
        description: "Each node averages its neighbors using the attention weights.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { phase: "aggregate", aggregated: result.aggregated },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(result.gates, result.gates.map((v) => v.toFixed(2)), "gate"),
        edges: edgeEntities,
        description: "A sigmoid gate decides how much of the message to keep.",
        codeLineNumber: 3,
        layout: "graph",
        meta: { phase: "gate", gates: result.gates },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(result.output, result.output.map((v) => v.toFixed(2)), "output"),
        edges: edgeEntities,
        description: `Done: each output blends the aggregated message with the node's own value.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { phase: "done", output: result.output, gates: result.gates },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In a graph, a node should listen more to some neighbors than others. Attention assigns each neighbor a weight, and the node takes a weighted average of their values. A gate adds a second decision: keep that neighborhood summary, or stay close to the node's original value. This is the core of gated graph attention networks.",
        invariants: [
            "Neighbor weights for one node are nonnegative and sum to one.",
            "A self-loop makes every node attend to at least itself.",
            "Each gate lies strictly between zero and one.",
        ],
        correctness:
            "Building the neighbor list from the undirected edges adds both endpoints and deduplicates nothing, which is fine because a repeated neighbor would simply receive two scores and be normalized consistently. The leaky score for each neighbor is passed through a softmax, so weights are positive and sum to one. The aggregated message is the defined weighted average, and the sigmoid gate produces a value in (0,1), making the final output a convex combination of the message and the original value.",
        complexityRationale:
            "Each undirected edge contributes two neighbor entries, and each node scores and normalizes its own neighbor list, so total work is O(V + E). Storing the lists and per-node weights uses O(V + E) space.",
        uses: [
            "Node classification on citation and social graphs",
            "Message passing where reliability of neighbors varies",
            "Teaching attention and gating on non-grid data",
        ],
        references: [
            "Velickovic et al., Graph Attention Networks, ICLR 2018",
            "Bresson and Laurent, Residual Gated Graph ConvNets, ICLR 2018 Workshop",
        ],
        workedExample:
            "For one node with value 1 and a single self-loop neighbor, the softmax over one score is 1, so the aggregated message is 1. With a gate of about 0.73, the output is 0.73 times 1 plus 0.27 times the original 1, which is still 1. With a large negative neighbor value the score becomes negative and the gate can drop toward zero, preserving the node's own value.",
    },
    id: "gated-graph-attention",
    name: "Gated Graph Attention",
    category: "ml-ai",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        values: [1, -0.5, 2, 0.3],
        edges: [[0, 1], [0, 2], [2, 3], [1, 3]],
        selfLoop: true,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read node values, undirected edges, and gate parameters",
        "build each node's neighbor list and add a self-loop",
        "score every neighbor with a leaky function",
        "normalize scores with a softmax over neighbors",
        "aggregate neighbor values into a message",
        "compute a sigmoid gate and blend message with the node value",
        "done: report each node's gated output",
    ],
};

export default module;
