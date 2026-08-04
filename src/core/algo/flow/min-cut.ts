/**
 * min-cut.ts – Minimum Cut (via max-flow / min-cut theorem)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A cut partitions the vertices into two sets (S, T) with the source in S and
 * the sink in T; its capacity is the total capacity of edges crossing from S
 * to T. The max-flow / min-cut theorem states that the maximum flow equals the
 * *minimum* cut capacity. This algorithm finds the max flow with
 * Ford-Fulkerson, then performs one final reachability search in the residual
 * graph: the vertices reachable from the source form S, and the crossing edges
 * are the min cut.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E·f) – dominated by the max-flow phase
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices in the S-side are BLUE (active).
 *   - Vertices in the T-side are PINK (highlight).
 *   - Cut edges are RED (swapped).
 *   - Max-flow edges are CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The theorem connecting two superficially different problems.
 *   - The min cut itself is found by the residual reachability trick.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Min Cut generator.
 *
 * @param input `{ edges, vertices, source, sink }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            edges?: Array<[string, string, number]>;
            vertices?: string[];
            source?: string;
            sink?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["S", "A", 3],
        ["S", "B", 2],
        ["A", "B", 1],
        ["A", "T", 2],
        ["B", "T", 3],
    ];
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";

    const nodes = makeFlowNodes(vertices);
    const edges = makeFlowEdges(edgeList);

    const cap = new Map<string, number>();
    for (const [u, v, capacity] of edgeList) {
        cap.set(`${u}→${v}`, capacity);
        if (!cap.has(`${v}→${u}`)) {
            cap.set(`${v}→${u}`, 0);
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

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Min cut via max-flow – computing the maximum flow first.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { flow: 0 },
    };
    step += 1;

    const refreshLabels = (): void => {
        edgeList.forEach(([u, v, capacity], index) => {
            const edge = edges[index];
            if (edge) {
                edge.label = `${flow.get(`${u}→${v}`) ?? 0}/${capacity}`;
            }
        });
    };

    // ------------------------------------------------------------------
    // Phase 1: compute the maximum flow (Ford-Fulkerson style).
    // ------------------------------------------------------------------
    for (;;) {
        const queue: string[] = [source];
        const parent = new Map<string, string | null>();
        parent.set(source, null);
        const visited = new Set<string>([source]);

        while (queue.length > 0 && !parent.has(sink)) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            for (const neighbor of neighborMap.get(current) ?? []) {
                if (!visited.has(neighbor) && (cap.get(`${current}→${neighbor}`) ?? 0) > 0) {
                    visited.add(neighbor);
                    parent.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }

        if (!parent.has(sink)) {
            break;
        }

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

        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            cap.set(`${u}→${v}`, (cap.get(`${u}→${v}`) ?? 0) - bottleneck);
            cap.set(`${v}→${u}`, (cap.get(`${v}→${u}`) ?? 0) + bottleneck);
            if (flow.has(`${u}→${v}`)) {
                flow.set(`${u}→${v}`, (flow.get(`${u}→${v}`) ?? 0) + bottleneck);
            }
            if (flow.has(`${v}→${u}`)) {
                flow.set(`${v}→${u}`, Math.max(0, (flow.get(`${v}→${u}`) ?? 0) - bottleneck));
            }
        }
        totalFlow += bottleneck;
        refreshLabels();
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Maximum flow is ${totalFlow} – now finding the cut via residual reachability.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { flow: totalFlow },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Phase 2: residual reachability from the source defines the S-side.
    // ------------------------------------------------------------------
    const reachable = new Set<string>();
    const queue: string[] = [source];
    reachable.add(source);

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        for (const neighbor of neighborMap.get(current) ?? []) {
            if (!reachable.has(neighbor) && (cap.get(`${current}→${neighbor}`) ?? 0) > 0) {
                reachable.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    // Colour the two sides.
    for (const v of vertices) {
        const node = nodes.find((n) => n.label === v);
        if (!node) {
            continue;
        }
        if (reachable.has(v)) {
            node.state = "active";
        } else {
            node.state = "highlight";
        }
    }

    // The cut edges cross from S to T and are exactly the saturated original
    // edges pointing out of the S-side.
    let cutCapacity = 0;
    for (let i = 0; i < edgeList.length; i += 1) {
        const [u, v, capacity] = edgeList[i] ?? [];
        if (!u || !v) {
            continue;
        }
        if (reachable.has(u) && !reachable.has(v)) {
            cutCapacity += capacity;
            const edge = edges[i];
            if (edge) {
                edge.state = "swapped";
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum cut capacity ${cutCapacity} (equals max flow ${totalFlow}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { flow: totalFlow, cutCapacity },
    };
}

/** The Min Cut module, registered with the engine. */
const module: AlgorithmModule = {
    id: "min-cut",
    name: "Minimum Cut",
    category: "flow",
    complexity: { time: "O(E·f)", space: "O(V + E)" },
    // Same network as the other flow algorithms for comparison.
    defaultInput: {
        edges: [
            ["S", "A", 3],
            ["S", "B", 2],
            ["A", "B", 1],
            ["A", "T", 2],
            ["B", "T", 3],
        ],
        vertices: ["S", "A", "B", "T"],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
};

export default module;
