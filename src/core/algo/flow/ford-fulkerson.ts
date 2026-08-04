/**
 * ford-fulkerson.ts – Ford-Fulkerson Algorithm (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ford-Fulkerson computes the maximum flow from a source s to a sink t in a
 * directed capacity network. It repeatedly finds *any* s→t path in the
 * residual graph (a path along edges that still have spare capacity), pushes
 * as much flow as that path allows (the bottleneck), and repeats. The residual
 * graph includes reverse edges so that later augmenting paths can "cancel"
 * earlier suboptimal routing.
 *
 * When no augmenting path remains, the flow is maximal (this is the content
 * of the max-flow / min-cut theorem).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E × f) where f is the maximum flow value – with integer
 *          capacities the number of augmentations is bounded by f
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The augmenting path edges are BLUE (active).
 *   - Edges saturated at full capacity are CYAN (path).
 *   - The flow value shown on each edge is "flow / capacity".
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The foundational max-flow algorithm (Edmonds-Karp makes it polynomial
 *     by always picking the shortest augmenting path).
 *   - Requires integer or rational capacities to terminate.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Ford-Fulkerson generator.
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
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Residual capacity per directed edge, keyed "u→v". Reverse edges start
    // at 0 so flow can later be pushed back.
    const cap = new Map<string, number>();
    for (const [u, v, capacity] of edgeList) {
        cap.set(`${u}→${v}`, capacity);
        if (!cap.has(`${v}→${u}`)) {
            cap.set(`${v}→${u}`, 0);
        }
    }

    // Neighbour list for the residual search (u → all possible v with an edge).
    const neighborMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighborMap.get(u) ?? [];
        listU.push(v);
        neighborMap.set(u, listU);
        const listV = neighborMap.get(v) ?? [];
        listV.push(u); // reverse edges are always possible neighbors
        neighborMap.set(v, listV);
    }

    // Flow pushed along each original edge.
    const flow = new Map<string, number>();
    for (const [u, v] of edgeList) {
        flow.set(`${u}→${v}`, 0);
    }

    let step = 0;
    let totalFlow = 0;
    let augmentations = 0;

    // Frame 0: the untouched network.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Finding max flow from ${source} to ${sink} – looking for augmenting paths.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { flow: 0 },
    };
    step += 1;

    // Update every edge label to show "flow / capacity".
    const refreshLabels = (): void => {
        edgeList.forEach(([u, v, capacity], index) => {
            const edge = edges[index];
            if (edge) {
                edge.label = `${flow.get(`${u}→${v}`) ?? 0}/${capacity}`;
            }
        });
    };

    // Reset edge states to idle (path edges stay cyan).
    const resetEdgeStates = (): void => {
        for (const edge of edges) {
            if (edge.state !== "path") {
                edge.state = "idle";
            }
        }
    };

    // ------------------------------------------------------------------
    // Augmenting loop: find a path with residual capacity, then push flow.
    // ------------------------------------------------------------------
    for (;;) {
        // BFS for any s→t path along edges with residual capacity.
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

        // No augmenting path – the flow is maximal.
        if (!parent.has(sink)) {
            break;
        }

        // Reconstruct the path and find the bottleneck (minimum residual).
        const path: string[] = [];
        let cursor: string | null = sink;
        while (cursor !== null) {
            path.push(cursor);
            cursor = parent.get(cursor) ?? null;
        }
        path.reverse();

        let bottleneck = Infinity;
        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            bottleneck = Math.min(bottleneck, cap.get(`${u}→${v}`) ?? 0);
        }

        // Highlight the augmenting path edges.
        resetEdgeStates();
        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            const edge = edges.find(
                (e) => e.sourceId === `node-${u}` && e.targetId === `node-${v}`,
            );
            if (edge) {
                edge.state = "active";
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Augmenting path ${path.join(" → ")} – bottleneck ${bottleneck}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow },
        };
        step += 1;

        // Push the bottleneck flow along every edge of the path.
        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            cap.set(`${u}→${v}`, (cap.get(`${u}→${v}`) ?? 0) - bottleneck);
            cap.set(`${v}→${u}`, (cap.get(`${v}→${u}`) ?? 0) + bottleneck);
            // Record flow on the original forward edge (if u→v is original).
            if (flow.has(`${u}→${v}`)) {
                flow.set(`${u}→${v}`, (flow.get(`${u}→${v}`) ?? 0) + bottleneck);
            }
            // If this was a reverse edge, cancel flow on the original edge.
            if (flow.has(`${v}→${u}`)) {
                flow.set(`${v}→${u}`, Math.max(0, (flow.get(`${v}→${u}`) ?? 0) - bottleneck));
            }
        }

        totalFlow += bottleneck;
        augmentations += 1;
        refreshLabels();

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Pushed ${bottleneck} units – total flow is now ${totalFlow}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { flow: totalFlow, augmentations },
        };
        step += 1;
    }

    // Colour fully-saturated original edges.
    resetEdgeStates();
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
        description: `Maximum flow from ${source} to ${sink} is ${totalFlow} (${augmentations} augmentations).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { flow: totalFlow, augmentations },
    };
}

/** The Ford-Fulkerson module, registered with the engine. */
const module: AlgorithmModule = {
    id: "ford-fulkerson",
    name: "Ford-Fulkerson",
    category: "flow",
    complexity: { time: "O(E·f)", space: "O(V + E)" },
    // Classic small network with two parallel-ish routes S→T.
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
