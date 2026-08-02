/**
 * push-relabel.ts – Push-Relabel Algorithm (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Push-relabel is a *preflow-push* max-flow algorithm. Unlike the
 * augmenting-path algorithms, it never searches for s→t paths. Instead, every
 * vertex maintains an excess of flow and a height; flow is *pushed* from a
 * vertex to a lower neighbour, and when a vertex has excess but no lower
 * neighbour it is *relabelled* (its height increases). When all excess has
 * drained into the sink, the flow is maximal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²·E) with the basic variant; O(V³) and better with heuristics
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
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

    const neighbourMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighbourMap.get(u) ?? [];
        listU.push(v);
        neighbourMap.set(u, listU);
        const listV = neighbourMap.get(v) ?? [];
        listV.push(u);
        neighbourMap.set(v, listV);
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
    // Initialisation: saturate all source edges into the preflow.
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
        description: "Initialised – saturated all source edges into the preflow.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { pushes, relabels },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Main loop: push excess to lower neighbours, relabel when stuck.
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

        // Try to push to a neighbour of strictly lower height.
        let pushed = false;
        const neighbours = neighbourMap.get(current) ?? [];
        for (const neighbour of neighbours) {
            if ((height.get(neighbour) ?? 0) < (height.get(current) ?? 0)) {
                const available = cap.get(`${current}→${neighbour}`) ?? 0;
                if (available > 0) {
                    const amount = Math.min(excess.get(current) ?? 0, available);
                    cap.set(`${current}→${neighbour}`, available - amount);
                    cap.set(
                        `${neighbour}→${current}`,
                        (cap.get(`${neighbour}→${current}`) ?? 0) + amount,
                    );
                    excess.set(current, (excess.get(current) ?? 0) - amount);
                    excess.set(neighbour, (excess.get(neighbour) ?? 0) + amount);
                    pushes += 1;
                    pushed = true;

                    // Highlight the pushed edge.
                    const edge = edges.find(
                        (e) =>
                            e.sourceId === `node-${current}` && e.targetId === `node-${neighbour}`,
                    );
                    if (edge) {
                        edge.state = "active";
                    }
                    refreshNodes();
                    yield {
                        stepNumber: step,
                        entities: nodes.map((n) => ({ ...n })),
                        edges: edges.map((e) => ({ ...e })),
                        description: `Pushed ${amount} from ${current} to ${neighbour}.`,
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
                description: `Relabelled ${current} to height ${height.get(current)}.`,
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

    // Reset edge labels to final flow/capacity and saturate-colour edges.
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
};

export default module;
