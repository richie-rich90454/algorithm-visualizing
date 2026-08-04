/**
 * boykov-kolmogorov.ts – Boykov-Kolmogorov Algorithm (Max-Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Boykov-Kolmogorov (BK) algorithm is a max-flow algorithm designed for
 * the vision/graphics "graph cuts" problem. It is an augmenting-path method,
 * but instead of rebuilding the whole residual graph every augmentation it
 * maintains two search trees – one rooted at the source, one at the sink –
 * and grows them through the residual graph until they meet. When they meet,
 * an augmenting path exists; after augmenting, the trees are rebuilt locally.
 *
 * This educational implementation captures the tree-growing idea with a
 * simpler two-frontier BFS that yields the same intuition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E·f) worst, but empirically excellent on vision instances
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Source-tree vertices are BLUE (active).
 *   - Sink-tree vertices are PINK (highlight).
 *   - The augmenting path between the trees is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Grows two search trees instead of searching from scratch each time.
 *   - The tree from the sink searches along *reverse* edges.
 *   - Widely used for interactive image segmentation (GrabCut-style).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Boykov-Kolmogorov generator.
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

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Boykov-Kolmogorov from ${source} to ${sink} – growing two search trees.`,
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
    // Augmenting loop with two growing frontiers.
    // ------------------------------------------------------------------
    for (;;) {
        // Grow the source tree: BFS from source along residual edges.
        const srcParent = new Map<string, string | null>();
        srcParent.set(source, null);
        const srcQueue: string[] = [source];

        while (srcQueue.length > 0) {
            const current = srcQueue.shift();
            if (!current) {
                continue;
            }
            for (const neighbor of neighbourMap.get(current) ?? []) {
                if (!srcParent.has(neighbor) && (cap.get(`${current}→${neighbor}`) ?? 0) > 0) {
                    srcParent.set(neighbor, current);
                    srcQueue.push(neighbor);
                }
            }
        }

        // Grow the sink tree: BFS from sink along reverse residual edges.
        const snkParent = new Map<string, string | null>();
        snkParent.set(sink, null);
        const snkQueue: string[] = [sink];

        while (snkQueue.length > 0) {
            const current = snkQueue.shift();
            if (!current) {
                continue;
            }
            for (const neighbor of neighbourMap.get(current) ?? []) {
                // Reverse edge: current ← neighbor has capacity when
                // neighbor→current has residual capacity.
                if (!snkParent.has(neighbor) && (cap.get(`${neighbor}→${current}`) ?? 0) > 0) {
                    snkParent.set(neighbor, current);
                    snkQueue.push(neighbor);
                }
            }
        }

        // Color the two trees.
        resetEdgeStates();
        for (const v of srcParent.keys()) {
            const node = nodes.find((n) => n.label === v);
            if (node) {
                node.state = "active";
            }
        }
        for (const v of snkParent.keys()) {
            const node = nodes.find((n) => n.label === v);
            if (node) {
                node.state = "highlight";
            }
        }

        // The trees meet at some vertex reachable from both.
        const meetPoint = [...srcParent.keys()].find((v) => snkParent.has(v));

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: meetPoint
                ? `The two trees met at ${meetPoint} – augmenting path found.`
                : "Trees cannot meet – the flow is maximal.",
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow },
        };
        step += 1;

        if (!meetPoint) {
            break;
        }

        // Reconstruct the path: source → meet via srcParent, then meet → sink
        // via snkParent (which stored the reverse-tree directions).
        const forwardPath: string[] = [];
        let cursor: string | null = meetPoint;
        while (cursor !== null) {
            forwardPath.push(cursor);
            cursor = srcParent.get(cursor) ?? null;
        }
        forwardPath.reverse();

        const backwardPath: string[] = [];
        cursor = snkParent.get(meetPoint) ?? null;
        while (cursor !== null) {
            backwardPath.push(cursor);
            cursor = snkParent.get(cursor) ?? null;
        }

        const path = [...forwardPath, ...backwardPath];

        // Bottleneck along the path.
        let bottleneck = Infinity;
        for (let i = 0; i < path.length - 1; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            bottleneck = Math.min(bottleneck, cap.get(`${u}→${v}`) ?? 0);
        }

        // Highlight the augmenting path.
        resetEdgeStates();
        for (let i = 0; i < path.length - 1; i += 1) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
            );
            if (edge) {
                edge.state = "path";
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Augmenting along ${path.join(" → ")} – bottleneck ${bottleneck}.`,
            codeLineNumber: 3,
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
            description: `Pushed ${bottleneck} – total flow ${totalFlow}.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { flow: totalFlow, augmentations },
        };
        step += 1;
    }

    // Saturate-color edges.
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
        codeLineNumber: 5,
        layout: "graph",
        meta: { flow: totalFlow, augmentations },
    };
}

/** The Boykov-Kolmogorov module, registered with the engine. */
const module: AlgorithmModule = {
    id: "boykov-kolmogorov",
    name: "Boykov-Kolmogorov",
    category: "flow",
    complexity: { time: "O(E·f)", space: "O(V + E)" },
    // Same small network as the other flow algorithms for comparison.
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
