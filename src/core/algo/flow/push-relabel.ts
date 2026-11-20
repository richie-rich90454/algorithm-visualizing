/**
 * push-relabel.ts – Push-Relabel Algorithm (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Push-relabel is a *preflow-push* max-flow algorithm. Unlike the
 * augmenting-path algorithms, it never searches for s→t paths. Instead, every
 * vertex maintains an excess of flow and a height; flow is *pushed* from a
 * vertex to a lower neighbor, and when a vertex has excess but no lower
 * neighbor it is *relabeled* (its height increases). When all excess has
 * drained into the sink, the flow is maximal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²·E) with the basic variant; O(V³) and better with heuristics
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being processed (with excess) is YELLOW (comparing).
 *   - The edge carrying a push is BLUE (active).
 *   - Vertex height is shown next to the label.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A fundamentally different paradigm from augmenting-path algorithms.
 *   - Local operations (push/label) instead of global path searches.
 *   - The height function is the "potential" that keeps the algorithm sane.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Push-Relabel generator.
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

    const neighborMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighborMap.get(u) ?? [];
        listU.push(v);
        neighborMap.set(u, listU);
        const listV = neighborMap.get(v) ?? [];
        listV.push(u);
        neighborMap.set(v, listV);
    }

    // Excess flow and height per vertex.
    const excess = new Map<string, number>();
    const height = new Map<string, number>();
    for (const v of vertices) {
        excess.set(v, 0);
        height.set(v, 0);
    }

    let step = 0;
    let pushes = 0;
    let relabels = 0;

    // Frame 0: the untouched network.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Push-relabel from ${source} to ${sink} – preflow, then local pushes.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { pushes, relabels },
    };
    step += 1;

    // Refresh node labels to show height:excess.
    const refreshNodes = (): void => {
        for (const v of vertices) {
            const node = nodes.find((n) => n.label === v || n.label.startsWith(v));
            if (node) {
                node.label = `${v} (h=${height.get(v) ?? 0})`;
            }
        }
    };

    // ------------------------------------------------------------------
    // Initialization: saturate all source edges into the preflow.
    // ------------------------------------------------------------------
    height.set(source, vertices.length);
    for (const [u, v] of edgeList) {
        if (u !== source) {
            continue;
        }
        const capacity = cap.get(`${u}→${v}`) ?? 0;
        cap.set(`${u}→${v}`, 0);
        cap.set(`${v}→${u}`, (cap.get(`${v}→${u}`) ?? 0) + capacity);
        excess.set(v, (excess.get(v) ?? 0) + capacity);
        excess.set(source, (excess.get(source) ?? 0) - capacity);
        pushes += 1;
    }

    refreshNodes();
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Initialized – saturated all source edges into the preflow.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { pushes, relabels },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Main loop: push excess to lower neighbors, relabel when stuck.
    // ------------------------------------------------------------------
    for (;;) {
        // Find a vertex (not source/sink) with positive excess.
        let current = "";
        for (const v of vertices) {
            if (v !== source && v !== sink && (excess.get(v) ?? 0) > 0) {
                current = v;
                break;
            }
        }

        // No excess anywhere → the preflow is a valid max flow.
        if (current === "") {
            break;
        }

        // Try to push to a neighbor of strictly lower height.
        let pushed = false;
        const neighbors = neighborMap.get(current) ?? [];
        for (const neighbor of neighbors) {
            if ((height.get(neighbor) ?? 0) < (height.get(current) ?? 0)) {
                const available = cap.get(`${current}→${neighbor}`) ?? 0;
                if (available > 0) {
                    const amount = Math.min(excess.get(current) ?? 0, available);
                    cap.set(`${current}→${neighbor}`, available - amount);
                    cap.set(
                        `${neighbor}→${current}`,
                        (cap.get(`${neighbor}→${current}`) ?? 0) + amount,
                    );
                    excess.set(current, (excess.get(current) ?? 0) - amount);
                    excess.set(neighbor, (excess.get(neighbor) ?? 0) + amount);
                    pushes += 1;
                    pushed = true;

                    // Highlight the pushed edge.
                    const edge = edges.find(
                        (e) =>
                            e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
                    );
                    if (edge) {
                        for (const e of edges) {
                            e.state = "idle";
                        }
                        edge.state = "active";
                    }
                    refreshNodes();
                    yield {
                        stepNumber: step,
                        entities: nodes.map((n) => ({ ...n })),
                        edges: edges.map((e) => ({ ...e })),
                        description: `Pushed ${amount} from ${current} to ${neighbor}.`,
                        codeLineNumber: 3,
                        layout: "graph",
                        meta: { pushes, relabels },
                    };
                    step += 1;
                    break;
                }
            }
        }

        // No push was possible – relabel the vertex one level higher.
        if (!pushed) {
            height.set(current, (height.get(current) ?? 0) + 1);
            relabels += 1;
            refreshNodes();
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Relabeled ${current} to height ${height.get(current)}.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: { pushes, relabels },
            };
            step += 1;
        }
    }

    // The max flow value is the excess drained into the sink (or, equivalently,
    // the total pushed out of the source).
    const maxFlow = vertices
        .filter((v) => v !== source)
        .reduce((sum, v) => sum + Math.max(0, excess.get(v) ?? 0), 0);

    // Reset edge labels to final flow/capacity and saturate-color edges.
    for (let i = 0; i < edgeList.length; i += 1) {
        const [u, v, capacity] = edgeList[i] ?? [];
        if (!u || !v) {
            continue;
        }
        const flow = capacity - (cap.get(`${u}→${v}`) ?? 0);
        const edge = edges[i];
        if (edge) {
            edge.label = `${Math.max(0, flow)}/${capacity}`;
            if (flow >= capacity) {
                edge.state = "path";
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Maximum flow from ${source} to ${sink} is ${maxFlow} (${pushes} pushes, ${relabels} relabels).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { flow: maxFlow, pushes, relabels },
    };
}

/** The Push-Relabel module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Push-relabel abandons augmenting paths entirely. It starts by saturating all edges out of the source, giving neighbors excess flow. A vertex with excess either pushes it to a neighbor that is lower according to a height labeling, or, if none exists, is relabeled to a greater height so a push becomes possible. When all excess reaches the sink, the flow is maximum.",
        "invariants": [
            "Heights respect the valid-labeling condition: h(u) is at most h(v)+1 on every residual arc u-v.",
            "Excess is conserved except at source and sink, which absorb or supply it.",
            "The height of any vertex only increases over time."
        ],
        "correctness": "A push along an admissible residual arc preserves the height condition because the target is exactly one level lower. Relabeling restores the condition when no admissible arc exists. When no vertex other than source and sink has excess, the flow satisfies conservation and is a feasible flow; the valid labeling then certifies that no augmenting path exists, so the flow is maximum.",
        "complexityRationale": "The basic variant performs O(V^2) relabels and O(V^2 E) pushes, giving O(V^2 E); gap and highest-label heuristics improve this sharply in practice. Heights, excesses, and residual arcs use O(V + E) space.",
        "uses": [
            "Fast maximum flow on large dense networks",
            "A core engine for image segmentation graph cuts",
            "Bipartite matching and other flow reductions needing high performance"
        ],
        "references": [
            "Goldberg and Tarjan, A New Approach to the Maximum-Flow Problem (1988)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, max-flow chapter"
        ],
        "workedExample": "Network S-A 3, S-B 2, A-B 1, A-T 2, B-T 3. Saturating S-A and S-B gives A excess 3 and B excess 2. A pushes 2 to T and 1 to B; B then pushes its accumulated 3 to T. All excess is drained, total flow is 5, equal to the source out-capacity."
    },
    id: "push-relabel",
    name: "Push-Relabel",
    category: "flow",
    complexity: { time: "O(V²·E)", space: "O(V + E)" },
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
    pseudocode: [
        "initialize heights and excesses with source preflow setup",
        "saturate all source edges to build the initial preflow",
        "while an active vertex with excess remains outside sink",
        "push excess to a lower neighbor when residual allows",
        "relabel vertex higher when no push is possible",
        "report maximum flow as excess drained into sink",
    ],
};

export default module;
