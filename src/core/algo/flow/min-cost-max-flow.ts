/**
 * min-cost-max-flow.ts – Minimum-Cost Maximum Flow (successive shortest paths)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The minimum-cost maximum flow problem adds edge *costs* to the classic
 * max-flow problem: among all maximum flows, find the one with the smallest
 * total cost. The successive-shortest-paths algorithm handles this by
 * repeatedly finding the *cheapest* augmenting path in the residual graph
 * (using Bellman-Ford, which copes with the negative-cost reverse edges) and
 * pushing flow along it until no more paths remain. Each iteration picks the
 * least-cost way to route one more unit of flow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(f × V × E) where f is the total flow value
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cheapest augmenting path is BLUE (active).
 *   - Edges show "flow/capacity (cost)".
 *   - The accumulated cost is reported each round.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Greedy in cost: always take the cheapest next path.
 *   - Requires a shortest-path algorithm that handles negative edges (the
 *     residual reverse edges have negative cost).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Min-Cost Max-Flow generator.
 *
 * @param input `{ edges, vertices, source, sink }` where each edge is
 *        `[from, to, capacity, cost]`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            edges?: Array<[string, string, number, number]>;
            vertices?: string[];
            source?: string;
            sink?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number, number]> = task.edges ?? [
        ["S", "A", 3, 2],
        ["S", "B", 2, 1],
        ["A", "B", 1, 1],
        ["A", "T", 2, 3],
        ["B", "T", 3, 2],
    ];
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";

    const nodes = makeFlowNodes(vertices);
    const edges = makeFlowEdges(edgeList.map(([a, b, c]) => [a, b, c]));

    // Residual capacity and per-unit cost per directed edge.
    const cap = new Map<string, number>();
    const cost = new Map<string, number>();
    for (const [u, v, capacity, c] of edgeList) {
        cap.set(`${u}→${v}`, capacity);
        cost.set(`${u}→${v}`, c);
        if (!cap.has(`${v}→${u}`)) {
            cap.set(`${v}→${u}`, 0);
            cost.set(`${v}→${u}`, -c); // reverse edges have negated cost
        }
    }

    const neighborMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighborMap.get(u) ?? [];
        listU.push(v);
        neighborMap.set(u, listU);
        const listV = neighborMap.get(v) ?? [];
        listV.push(u);
        neighborMap.set(v, listV);
    }

    const flow = new Map<string, number>();
    for (const [u, v] of edgeList) {
        flow.set(`${u}→${v}`, 0);
    }

    let step = 0;
    let totalFlow = 0;
    let totalCost = 0;

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            "Min-cost max-flow – sending flow along the cheapest augmenting path each time.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { flow: 0, cost: 0 },
    };
    step += 1;

    const refreshLabels = (): void => {
        edgeList.forEach(([u, v, capacity, c], index) => {
            const edge = edges[index];
            if (edge) {
                edge.label = `${flow.get(`${u}→${v}`) ?? 0}/${capacity} (${c})`;
            }
        });
    };

    // ------------------------------------------------------------------
    // Successive shortest paths: Bellman-Ford for the cheapest residual path.
    // ------------------------------------------------------------------
    for (;;) {
        // Bellman-Ford from source over residual edges with capacity > 0.
        const dist = new Map<string, number>();
        const parent = new Map<string, string | null>();
        for (const v of vertices) {
            dist.set(v, Infinity);
            parent.set(v, null);
        }
        dist.set(source, 0);

        for (let round = 0; round < vertices.length - 1; round += 1) {
            for (const u of vertices) {
                const du = dist.get(u) ?? Infinity;
                if (du === Infinity) {
                    continue;
                }
                for (const v of neighborMap.get(u) ?? []) {
                    if ((cap.get(`${u}→${v}`) ?? 0) > 0) {
                        const alt = du + (cost.get(`${u}→${v}`) ?? 0);
                        if (alt < (dist.get(v) ?? Infinity)) {
                            dist.set(v, alt);
                            parent.set(v, u);
                        }
                    }
                }
            }
        }

        // Sink unreachable → max flow reached.
        if (dist.get(sink) === Infinity) {
            break;
        }

        // Reconstruct the cheapest path and find its bottleneck.
        const path: string[] = [];
        let cursor: string | null = sink;
        while (cursor !== null) {
            path.push(cursor);
            cursor = parent.get(cursor) ?? null;
        }
        path.reverse();

        let bottleneck = Infinity;
        for (let i = 0; i < path.length - 1; i += 1) {
            bottleneck = Math.min(bottleneck, cap.get(`${path[i]}→${path[i + 1]}`) ?? 0);
        }

        // Highlight the cheapest path.
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (let i = 0; i < path.length - 1; i += 1) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
            );
            if (edge) {
                edge.state = "active";
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Cheapest path ${path.join(" → ")} – bottleneck ${bottleneck}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow, cost: totalCost },
        };
        step += 1;

        // Push flow and accumulate the cost.
        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            const edgeCost = cost.get(`${u}→${v}`) ?? 0;
            cap.set(`${u}→${v}`, (cap.get(`${u}→${v}`) ?? 0) - bottleneck);
            cap.set(`${v}→${u}`, (cap.get(`${v}→${u}`) ?? 0) + bottleneck);
            if (flow.has(`${u}→${v}`)) {
                flow.set(`${u}→${v}`, (flow.get(`${u}→${v}`) ?? 0) + bottleneck);
            }
            if (flow.has(`${v}→${u}`)) {
                flow.set(`${v}→${u}`, Math.max(0, (flow.get(`${v}→${u}`) ?? 0) - bottleneck));
            }
            totalCost += edgeCost * bottleneck;
        }

        totalFlow += bottleneck;
        refreshLabels();

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Pushed ${bottleneck} – flow ${totalFlow}, total cost ${totalCost}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { flow: totalFlow, cost: totalCost },
        };
        step += 1;
    }

    // Saturate-color edges.
    for (const edge of edges) {
        edge.state = "idle";
    }
    for (let i = 0; i < edgeList.length; i += 1) {
        const [u, v, capacity] = edgeList[i] ?? [];
        if (!u || !v) {
            continue;
        }
        if ((flow.get(`${u}→${v}`) ?? 0) >= capacity) {
            const edge = edges[i];
            if (edge) {
                edge.state = "path";
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum-cost max flow: ${totalFlow} units at cost ${totalCost}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { flow: totalFlow, cost: totalCost },
    };
}

/** The Min-Cost Max-Flow module, registered with the engine. */
const module: AlgorithmModule = {
    id: "min-cost-max-flow",
    name: "Min-Cost Max-Flow",
    category: "flow",
    complexity: { time: "O(f·V·E)", space: "O(V + E)" },
    // Same topology as the other flow algorithms, plus per-edge costs.
    defaultInput: {
        edges: [
            ["S", "A", 3, 2],
            ["S", "B", 2, 1],
            ["A", "B", 1, 1],
            ["A", "T", 2, 3],
            ["B", "T", 3, 2],
        ],
        vertices: ["S", "A", "B", "T"],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
};

export default module;
