/**
 * edmonds-karp.ts – Edmonds-Karp Algorithm (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Edmonds-Karp is Ford-Fulkerson with one crucial refinement: every augmenting
 * path is the *shortest* s→t path (fewest edges), found with BFS. This turns
 * the potentially exponential Ford-Fulkerson into a guaranteed polynomial
 * algorithm: with O(V) BFS passes per augmentation and O(E) work per BFS, the
 * total is O(V·E²). The BFS-shortest-path choice is what makes the difference.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V × E²) – O(E) BFS runs at most O(V·E) times
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The shortest augmenting path found by BFS is BLUE (active).
 *   - Saturated edges are CYAN (path).
 *   - Each edge shows "flow / capacity".
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A concrete, polynomial-time instance of the Ford-Fulkerson template.
 *   - The "always shortest path" rule is a beautiful small change with a big
 *     complexity payoff.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Edmonds-Karp generator.
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

    // Residual capacities with reverse edges.
    const cap = new Map<string, number>();
    for (const [u, v, capacity] of edgeList) {
        cap.set(`${u}→${v}`, capacity);
        if (!cap.has(`${v}→${u}`)) {
            cap.set(`${v}→${u}`, 0);
        }
    }

    const neighbourMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighbourMap.get(u) ?? [];
        listU.push(v);
        neighbourMap.set(u, listU);
        const listV = neighbourMap.get(v) ?? [];
        listV.push(u);
        neighbourMap.set(v, listV);
    }

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
        description: `Edmonds-Karp from ${source} to ${sink} – always picking the shortest augmenting path.`,
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

    const resetEdgeStates = (): void => {
        for (const edge of edges) {
            if (edge.state !== "path") {
                edge.state = "idle";
            }
        }
    };

    // ------------------------------------------------------------------
    // Augmenting loop using BFS for the shortest residual path.
    // ------------------------------------------------------------------
    for (;;) {
        // BFS: discover the parent of every vertex at minimum edge distance.
        const queue: string[] = [source];
        const parent = new Map<string, string | null>();
        parent.set(source, null);
        const visited = new Set<string>([source]);

        while (queue.length > 0 && !parent.has(sink)) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            for (const neighbor of neighbourMap.get(current) ?? []) {
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

        // Reconstruct the shortest path and compute the bottleneck.
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

        // Highlight the shortest augmenting path.
        resetEdgeStates();
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
            description: `Shortest augmenting path ${path.join(" → ")} – bottleneck ${bottleneck}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow },
        };
        step += 1;

        // Push flow along the path.
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
        augmentations += 1;
        refreshLabels();

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Pushed ${bottleneck} – total flow is now ${totalFlow}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { flow: totalFlow, augmentations },
        };
        step += 1;
    }

    // Color saturated edges.
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

/** The Edmonds-Karp module, registered with the engine. */
const module: AlgorithmModule = {
    id: "edmonds-karp",
    name: "Edmonds-Karp",
    category: "flow",
    complexity: { time: "O(V·E²)", space: "O(V + E)" },
    // Same network as Ford-Fulkerson for a direct comparison.
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
