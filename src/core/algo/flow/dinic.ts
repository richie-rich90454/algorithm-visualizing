/**
 * dinic.ts – Dinic's Algorithm (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dinic's algorithm is the fastest classic max-flow algorithm in practice.
 * It works in phases over a *level graph*:
 *
 *   1. BFS from the source assigns each reachable vertex a level (distance).
 *   2. If the sink is unreachable, stop – the flow is maximal.
 *   3. Repeatedly push flow along the level graph with DFS (blocking-flow
 *      search), respecting the rule that flow only moves one level up.
 *
 * The blocking flow saturates at least one path per BFS, and each BFS phase
 * strictly increases the sink's level, so there are at most O(V) phases.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²·E) general, O(E·√V) on unit-capacity networks
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The BFS levels are shown on the nodes.
 *   - The DFS pushing flow is BLUE (active).
 *   - Saturated edges are CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The layered structure is the key teaching idea.
 *   - Built-in blocking-flow terminology is the standard vocabulary for
 *     advanced flow algorithms.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Dinic generator.
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
    const vertices = task.vertices ?? ["S", "A", "B", "C", "T"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["S", "A", 3],
        ["S", "B", 2],
        ["A", "B", 1],
        ["A", "C", 2],
        ["B", "C", 3],
        ["B", "T", 1],
        ["C", "T", 4],
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
    let phases = 0;

    // Frame 0: the untouched network.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Dinic's algorithm from ${source} to ${sink} – building level graphs phase by phase.`,
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

    // The level map: vertex → BFS distance (Infinity when unreachable).
    let level = new Map<string, number>();

    // ------------------------------------------------------------------
    // Phase loop: BFS levels, then push blocking flow.
    // ------------------------------------------------------------------
    for (;;) {
        // --- BFS to build the level graph. ---
        const nextLevel = new Map<string, number>();
        const queue: string[] = [source];
        nextLevel.set(source, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            const currentLevel = nextLevel.get(current) ?? 0;
            for (const neighbor of neighborMap.get(current) ?? []) {
                if (!nextLevel.has(neighbor) && (cap.get(`${current}→${neighbor}`) ?? 0) > 0) {
                    nextLevel.set(neighbor, currentLevel + 1);
                    queue.push(neighbor);
                }
            }
        }

        level = nextLevel;

        // Show the current level graph.
        for (const [v, lvl] of level) {
            const node = nodes.find((n) => n.label === v);
            if (node) {
                node.label = `${v}:${lvl}`;
            }
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `BFS phase ${phases + 1} – sink level is ${level.get(sink) ?? "∞"}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow, phases },
        };
        step += 1;

        // Sink unreachable → no more augmenting paths.
        if (level.get(sink) === undefined) {
            break;
        }
        phases += 1;

        // --- Push flow along the level graph with repeated DFS. ---
        // A pointer per vertex speeds the DFS by skipping dead edges.
        const nextPtr = new Map<string, number>();
        for (const v of vertices) {
            nextPtr.set(v, 0);
        }

        const dfs = (v: string, incoming: number): number => {
            if (v === sink) {
                return incoming;
            }
            const neighbors = neighborMap.get(v) ?? [];
            let pushed = 0;
            while (pushed < incoming && (nextPtr.get(v) ?? 0) < neighbors.length) {
                const ptr = nextPtr.get(v) ?? 0;
                const neighbor = neighbors[ptr];
                if (!neighbor) {
                    nextPtr.set(v, ptr + 1);
                    continue;
                }
                const residual = cap.get(`${v}→${neighbor}`) ?? 0;
                // Only advance strictly along the level graph.
                if (residual > 0 && (level.get(neighbor) ?? -1) === (level.get(v) ?? -2) + 1) {
                    const amount = dfs(neighbor, Math.min(incoming - pushed, residual));
                    if (amount > 0) {
                        cap.set(`${v}→${neighbor}`, residual - amount);
                        cap.set(`${neighbor}→${v}`, (cap.get(`${neighbor}→${v}`) ?? 0) + amount);
                        if (flow.has(`${v}→${neighbor}`)) {
                            flow.set(
                                `${v}→${neighbor}`,
                                (flow.get(`${v}→${neighbor}`) ?? 0) + amount,
                            );
                        }
                        if (flow.has(`${neighbor}→${v}`)) {
                            flow.set(
                                `${neighbor}→${v}`,
                                Math.max(0, (flow.get(`${neighbor}→${v}`) ?? 0) - amount),
                            );
                        }
                        pushed += amount;

                        // Highlight the edge that carried flow.
                        const edge = edges.find(
                            (e) => e.sourceId === `node-${v}` && e.targetId === `node-${neighbor}`,
                        );
                        if (edge) {
                            edge.state = "active";
                        }
                        refreshLabels();
                    } else {
                        // The neighbor's subtree pushed nothing – this edge is
                        // dead within the current level graph, so skip it.
                        nextPtr.set(v, ptr + 1);
                    }
                } else {
                    // No residual capacity (or level mismatch) – move on.
                    nextPtr.set(v, ptr + 1);
                }
            }
            return pushed;
        };

        // Run the DFS from the source repeatedly until it pushes nothing.
        let pushedThisPhase = 0;
        for (;;) {
            const amount = dfs(source, Infinity);
            if (amount === 0) {
                break;
            }
            pushedThisPhase += amount;
            totalFlow += amount;
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Pushed ${amount} in phase ${phases} – total flow ${totalFlow}.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: { flow: totalFlow, phases },
            };
            step += 1;
        }

        resetEdgeStates();
    }

    // Color saturated edges.
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
        description: `Maximum flow from ${source} to ${sink} is ${totalFlow} across ${phases} phase(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { flow: totalFlow, phases },
    };
}

/** The Dinic module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Dinic improves on simple augmenting paths by working in layers. A breadth-first search builds a level graph of shortest residual distances, and a depth-first search pushes a blocking flow that saturates at least one path in that level graph. Repeating the phases until the sink is unreachable yields the maximum flow much faster than one path at a time.",
        "invariants": [
            "Flow only moves from a vertex to one at the next level of the current level graph.",
            "After each blocking flow, at least one edge on a shortest path is saturated.",
            "The sink's level strictly increases between phases, so there are at most V phases."
        ],
        "correctness": "A blocking flow saturates every shortest source-to-sink path in the level graph, so no augmenting path of that length remains. Because levels strictly increase, when the sink becomes unreachable there is no augmenting path of any length, and by max-flow min-cut the flow is maximum.",
        "complexityRationale": "Each phase costs O(V^2 E) in the general bound for DFS blocking-flow searches, and there are at most V phases, giving O(V^2 E); on unit-capacity networks the bound improves to O(E sqrt(V)). The residual graph and level arrays use O(V + E) space.",
        "uses": [
            "Maximum throughput in communication and transport networks",
            "Bipartite matching and other reductions solved as max flow",
            "Image segmentation energy minimization"
        ],
        "references": [
            "Dinic, Algorithm for Solution of a Problem of Maximum Flow in Networks with Power Estimation (1970)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, max-flow chapter"
        ],
        "workedExample": "Network S-A 3, S-B 2, A-B 1, A-C 2, B-C 3, B-T 1, C-T 4. Phase 1 builds levels S, then A and B, then C and T, and pushes a blocking flow through S-A-C-T, S-B-T, and S-B-C-T. Later phases find no new level path; total flow is 5, equal to the source out-capacity."
    },
    id: "dinic",
    name: "Dinic's Algorithm",
    category: "flow",
    complexity: { time: "O(V²·E)", space: "O(V + E)" },
    // A slightly deeper network where the level structure really matters.
    defaultInput: {
        edges: [
            ["S", "A", 3],
            ["S", "B", 2],
            ["A", "B", 1],
            ["A", "C", 2],
            ["B", "C", 3],
            ["B", "T", 1],
            ["C", "T", 4],
        ],
        vertices: ["S", "A", "B", "C", "T"],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize zero flow and residual graph with reverse edges",
        "run BFS from source to build level graph distances",
        "BFS builds level graph and stops if sink is unreachable",
        "push blocking flow with DFS along level edges",
        "repeat BFS phases until sink is unreachable",
        "report maximum flow value across all phases",
    ],
};

export default module;
