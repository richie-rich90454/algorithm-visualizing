/**
 * reliable-shortest-path.ts - Most Reliable Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Every edge is labeled with the probability that it works. The reliability
 * of a path is the product of its edge probabilities, so maximizing it is the
 * same as minimizing the sum of the negated logarithms of those probabilities.
 * Bellman-Ford style relaxation on the transformed, nonnegative weights finds
 * the most reliable route from a source to a target.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E) for the relaxation passes
 *   Space: O(V + E) for distances, predecessors, and edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Relaxed edges are YELLOW (comparing).
 *   - The final most reliable path is CYAN (path).
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type Weighted = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Weighted; start?: string; target?: string } | null) ?? {};
    const graph: Weighted = task.graph ?? {
        A: [
            ["B", 0.9],
            ["C", 0.7],
        ],
        B: [
            ["C", 0.6],
            ["D", 0.8],
        ],
        C: [["D", 0.95]],
        D: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((pairs) => pairs.map(([v]) => v)),
        ]),
    ];
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no route to evaluate.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { reliability: 0, passes: 0 },
        };
        return;
    }
    const start = task.start && labels.includes(task.start) ? task.start : (labels[0] as string);
    const target = task.target && labels.includes(task.target) ? task.target : (labels[labels.length - 1] as string);

    const nodes = makeGraphNodes(labels);
    let edges = makeWeightedEdges(graph);
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
        for (const edge of edges) edge.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    yield snap(
        `Finding the most reliable route from ${start} to ${target} across ${edges.length} link(s).`,
        0,
        { edges: edges.length, vertices: labels.length },
    );
    step += 1;

    const cost = new Map(labels.map((v) => [v, Infinity]));
    const predecessor = new Map<string, string | null>(labels.map((v) => [v, null]));
    cost.set(start, 0);
    let passes = 0;
    for (let i = 0; i < labels.length - 1; i += 1) {
        let changed = false;
        for (const [from, pairs] of Object.entries(graph)) {
            for (const [to, probability] of pairs) {
                if (!cost.has(to) || probability <= 0) continue;
                const weight = -Math.log(Math.min(1, probability));
                const candidate = (cost.get(from) as number) + weight;
                if (candidate + 1e-12 < (cost.get(to) as number)) {
                    cost.set(to, candidate);
                    predecessor.set(to, from);
                    changed = true;
                }
            }
        }
        passes += 1;
        if (!changed) break;
    }

    const reached = labels.filter((v) => Number.isFinite(cost.get(v))).length;
    yield snap(
        `After ${passes} pass(es), ${reached} vertex/vertices have a finite transformed distance.`,
        5,
        { passes, reached, vertices: labels.length },
    );
    step += 1;

    if (!Number.isFinite(cost.get(target))) {
        yield snap(`No reliable path reaches ${target} from ${start}.`, 6, { reliability: 0, passes });
        return;
    }

    const path: string[] = [];
    let cursor: string | null = target;
    while (cursor !== null) {
        path.unshift(cursor);
        cursor = predecessor.get(cursor) ?? null;
    }
    let reliability = 1;
    for (let i = 0; i + 1 < path.length; i += 1) {
        const from = path[i] as string;
        const to = path[i + 1] as string;
        const pair = (graph[from] ?? []).find(([v]) => v === to);
        reliability *= pair?.[1] ?? 0;
    }

    reset();
    for (const node of labels) {
        const found = nodes.find((n) => n.id === `node-${node}`);
        if (found && path.includes(node)) found.state = "path";
    }
    for (let i = 0; i + 1 < path.length; i += 1) {
        const from = path[i] as string;
        const to = path[i + 1] as string;
        const edge = edges.find((e) => e.sourceId === `node-${from}` && e.targetId === `node-${to}`);
        if (edge) edge.state = "path";
    }
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const sourceNode = byId.get(`node-${start}`);
    if (sourceNode) sourceNode.state = "sorted";

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Most reliable path ${path.join(" -> ")} with reliability ${reliability.toFixed(4)} after ${passes} relaxation pass(es).`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            reliability: Math.round(reliability * 1e9) / 1e9,
            passes,
            path: path.join("->"),
            hops: path.length - 1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If each link works with its own probability and links fail independently, a route works only when every link on it works. Multiplying the link probabilities gives the route reliability. Taking negative logarithms turns that product into a sum, which shortest-path relaxation can minimize.",
        invariants: [
            "A link with probability zero cannot be used.",
            "Transformed link costs are nonnegative because probabilities are at most one.",
            "Each relaxation pass only lowers the transformed cost of a vertex.",
        ],
        correctness:
            "For a path P, the negative log of its reliability equals the sum of the transformed link costs. The path with minimum transformed cost therefore has maximum reliability, and Bellman-Ford relaxation finds that minimum because no negative-weight cycle can exist when all transformed weights are nonnegative.",
        complexityRationale:
            "At most V-1 passes each scan E links, so the time is O(V * E). The distance table, predecessor table, and edge list use O(V + E) space.",
        uses: [
            " routing through unreliable wireless links",
            " designing dependable supply and communication chains",
            " choosing a flight itinerary with the best on-time record",
        ],
        references: [
            "Bellman, On a Routing Problem (1958)",
            "Ahuja, Magnanti, and Orlin, Network Flows",
        ],
        workedExample:
            "From A to D, the route A-B-D has reliability 0.9 times 0.8, or 0.72, while A-C-D has 0.7 times 0.95, or 0.665. The most reliable route is A-B-D. The transformed costs add -log(0.9) plus -log(0.8), which is smaller than the alternative sum.",
    },
    id: "reliable-shortest-path",
    name: "Most Reliable Path",
    category: "shortest-path",
    complexity: { time: "O(V * E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 0.9],
                ["C", 0.7],
            ],
            B: [
                ["C", 0.6],
                ["D", 0.8],
            ],
            C: [["D", 0.95]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "replace each edge probability p with the cost minus log of p",
        "initialize all transformed distances to infinity except the source",
        "repeat for at most vertex count minus one passes",
        "relax every edge when a shorter transformed distance is found",
        "stop early if a pass makes no change",
        "reconstruct the path from predecessors and multiply its probabilities",
        "report the reliability of the reconstructed path",
        "done: the path with maximum reliability",
    ],
};

export default module;
