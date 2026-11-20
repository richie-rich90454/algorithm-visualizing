/**
 * k-shortest-edge-disjoint.ts - K Shortest Edge-Disjoint Paths
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This finds up to k routes from a source to a target that share no edge,
 * minimizing the total travel cost. The problem reduces to a min-cost flow:
 * give each undirected road a capacity of one and a cost equal to its length,
 * hook a super source to the source and the target to a super sink, and push
 * k units of flow. Successive shortest augmenting paths produce a minimum-cost
 * flow, which is then decomposed into the individual edge-disjoint routes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * V * E) for k Bellman-Ford augmentations on the residual graph
 *   Space: O(V + E) for residual arcs and per-arc flow counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Arcs on the current augmenting path are CYAN.
 *   - Edges used by finalized routes turn GREEN.
 *   - meta reports each route with its cost and the running total.
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Weighted = Record<string, Array<[string, number]>>;

interface Arc {
    from: number;
    to: number;
    rev: number;
    cap: number;
    cost: number;
    tracksKey: string | null;
    edgeId: string | null;
    direction: 1 | -1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { graph?: Weighted; source?: string; target?: string; k?: number } | null
    ) ?? {};
    const graph: Weighted = task.graph ?? {
        A: [
            ["B", 1],
            ["C", 2],
            ["D", 5],
        ],
        B: [
            ["A", 1],
            ["C", 1],
            ["E", 3],
        ],
        C: [
            ["A", 2],
            ["B", 1],
            ["D", 1],
            ["F", 4],
        ],
        D: [
            ["A", 5],
            ["C", 1],
            ["G", 2],
        ],
        E: [
            ["B", 3],
            ["F", 1],
            ["G", 2],
        ],
        F: [
            ["C", 4],
            ["E", 1],
            ["G", 1],
        ],
        G: [
            ["D", 2],
            ["E", 2],
            ["F", 1],
        ],
    };
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((neighbors) => neighbors.map(([vertex]) => String(vertex))),
        ]),
    ].sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no route to find.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { count: 0, totalCost: 0, routes: [], source: "", target: "" },
        };
        return;
    }
    const source = task.source && labels.includes(task.source) ? task.source : (labels[0] as string);
    const target = task.target && labels.includes(task.target) ? task.target : labels[labels.length - 1] as string;
    const k = typeof task.k === "number" ? Math.max(0, Math.min(6, Math.floor(task.k))) : 3;

    const index = new Map(labels.map((label, i) => [label, i] as [string, number]));
    const sourceIdx = index.get(source)!;
    const targetIdx = index.get(target)!;
    const arcList: Arc[] = [];
    const flow = new Map<string, number>();

    const addArc = (
        from: number,
        to: number,
        cap: number,
        cost: number,
        tracksKey: string | null,
        edgeId: string | null,
    ): number => {
        const forward: Arc = { from, to, rev: arcList.length + 1, cap, cost, tracksKey, edgeId, direction: 1 };
        const reverse: Arc = { from: to, to: from, rev: arcList.length, cap: 0, cost: -cost, tracksKey, edgeId, direction: -1 };
        arcList.push(forward, reverse);
        if (tracksKey !== null) {
            flow.set(tracksKey, 0);
        }
        return arcList.length - 2;
    };

    const superSource = labels.length;
    const superSink = labels.length + 1;
    const totalNodes = labels.length + 2;
    addArc(superSource, sourceIdx, k, 0, null, null);
    addArc(targetIdx, superSink, k, 0, null, null);

    const edgeVisuals: VisualEdge[] = [];
    const seenEdges = new Set<string>();
    for (const [from, neighbors] of Object.entries(graph)) {
        const fromIdx = index.get(from);
        if (fromIdx === undefined) {
            continue;
        }
        for (const [toRaw, weight] of neighbors) {
            const to = String(toRaw);
            const toIdx = index.get(to);
            if (toIdx === undefined || fromIdx === toIdx) {
                continue;
            }
            const undirected = [from, to].sort().join("|");
            const key = `${from}->${to}`;
            addArc(fromIdx, toIdx, 1, weight, key, undirected);
            if (!seenEdges.has(undirected)) {
                seenEdges.add(undirected);
                edgeVisuals.push({
                    id: `edge-${undirected}`,
                    sourceId: `node-${from}`,
                    targetId: `node-${to}`,
                    label: String(weight),
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    const nodes = makeGraphNodes(labels);
    let step = 0;
    const snap = (
        description: string,
        line: number,
        activeEdges: Set<string>,
        routes: Array<{ path: string[]; cost: number }>,
        flowValue: number,
    ): VisualFrame => {
        const usedEdges = new Set<string>();
        for (const route of routes) {
            for (let i = 0; i + 1 < route.path.length; i += 1) {
                usedEdges.add([route.path[i], route.path[i + 1]].sort().join("|"));
            }
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: edgeVisuals.map((edge) => ({
                ...edge,
                state: activeEdges.has(edge.id)
                    ? "path"
                    : usedEdges.has(edge.id)
                      ? "sorted"
                      : "idle",
            })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                count: routes.length,
                totalCost: routes.reduce((sum, route) => sum + route.cost, 0),
                routes: routes.map((route) => `${route.path.join(">")}=${route.cost}`),
                flowValue,
                source,
                target,
            },
        };
    };

    yield snap(`Find up to ${k} edge-disjoint routes from ${source} to ${target}.`, 0, new Set(), [], 0);
    step += 1;

    if (k === 0 || source === target) {
        yield snap("No positive number of distinct routes is possible.", 7, new Set(), [], 0);
        return;
    }

    const outgoing: number[][] = Array.from({ length: totalNodes }, () => []);
    arcList.forEach((arc, i) => outgoing[arc.from]!.push(i));

    let flowValue = 0;
    let augmentations = 0;
    while (flowValue < k) {
        const dist = Array<number>(totalNodes).fill(Infinity);
        const prevArc = Array<number>(totalNodes).fill(-1);
        dist[superSource] = 0;
        for (let iteration = 0; iteration < totalNodes; iteration += 1) {
            let changed = false;
            for (let u = 0; u < totalNodes; u += 1) {
                if (!Number.isFinite(dist[u]!)) {
                    continue;
                }
                for (const arcId of outgoing[u]!) {
                    const arc = arcList[arcId]!;
                    if (arc.cap <= 0) {
                        continue;
                    }
                    const candidate = dist[u]! + arc.cost;
                    if (candidate < dist[arc.to]!) {
                        dist[arc.to] = candidate;
                        prevArc[arc.to] = arcId;
                        changed = true;
                    }
                }
            }
            if (!changed) {
                break;
            }
        }
        if (!Number.isFinite(dist[superSink]!)) {
            break;
        }

        let bottleneck = Infinity;
        let cursor = superSink;
        while (cursor !== superSource) {
            const arcId = prevArc[cursor]!;
            if (arcId < 0) {
                break;
            }
            bottleneck = Math.min(bottleneck, arcList[arcId]!.cap);
            cursor = arcList[arcId]!.from;
        }
        if (!Number.isFinite(bottleneck) || bottleneck <= 0) {
            break;
        }

        const pathEdges = new Set<string>();
        cursor = superSink;
        let augmentationCost = 0;
        while (cursor !== superSource) {
            const arcId = prevArc[cursor]!;
            if (arcId < 0) {
                break;
            }
            const arc = arcList[arcId]!;
            arc.cap -= bottleneck;
            arcList[arc.rev]!.cap += bottleneck;
            augmentationCost += arc.cost * bottleneck;
            if (arc.tracksKey !== null) {
                flow.set(arc.tracksKey, (flow.get(arc.tracksKey) ?? 0) + arc.direction * bottleneck);
            }
            if (arc.edgeId !== null) {
                pathEdges.add(arc.edgeId);
            }
            cursor = arc.from;
        }
        flowValue += bottleneck;
        augmentations += 1;
        yield snap(
            `Augmentation ${augmentations}: shortest residual route costs ${augmentationCost} per unit; flow is now ${flowValue}.`,
            3,
            pathEdges,
            [],
            flowValue,
        );
        step += 1;
    }

    const routes: Array<{ path: string[]; cost: number }> = [];
    for (let r = 0; r < flowValue; r += 1) {
        const path: string[] = [source];
        let cursor = sourceIdx;
        const guard = new Set<number>([cursor]);
        let cost = 0;
        for (;;) {
            let nextArc = -1;
            for (let i = 0; i < arcList.length; i += 1) {
                const arc = arcList[i]!;
                if (
                    arc.from === cursor &&
                    arc.tracksKey !== null &&
                    arc.direction === 1 &&
                    (flow.get(arc.tracksKey) ?? 0) > 0
                ) {
                    nextArc = i;
                    break;
                }
            }
            if (nextArc < 0) {
                break;
            }
            const arc = arcList[nextArc]!;
            flow.set(arc.tracksKey!, (flow.get(arc.tracksKey!) ?? 0) - 1);
            cost += arc.cost;
            cursor = arc.to;
            if (guard.has(cursor)) {
                break;
            }
            guard.add(cursor);
            path.push(labels[cursor] as string);
            if (cursor === targetIdx) {
                break;
            }
        }
        if (path[path.length - 1] === target) {
            routes.push({ path, cost });
        }
    }

    yield snap(
        `Decomposed the flow into ${routes.length} edge-disjoint route(s) with total cost ${routes.reduce((sum, route) => sum + route.cost, 0)}.`,
        6,
        new Set(),
        routes,
        flowValue,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat every road as a single-use slot and send several units of flow from the source to the target. Because each unit pays the road cost and capacity is one, no two units can share an edge. Repeatedly augment along the cheapest remaining route in the residual network, then read the final flow back as a set of paths.",
        invariants: [
            "Each undirected road has capacity one, so its flow is zero or one.",
            "Every augmentation follows a shortest path in the residual graph.",
            "The accumulated flow conserves at every intermediate vertex.",
        ],
        correctness:
            "Modeling edge-disjoint paths as unit-capacity flow is exact: any set of k edge-disjoint paths is a feasible flow of value k, and any integral flow of value k decomposes into k edge-disjoint paths. Successive shortest augmenting paths yields a minimum-cost maximum flow when original costs are nonnegative, because the residual network has no negative-cost cycles. The decomposition walks positive-flow arcs from the source to the target and therefore recovers the minimizing routes.",
        complexityRationale:
            "Each of at most k augmentations finds a shortest residual path with Bellman-Ford, costing O(V * E), so the total time is O(k * V * E). Residual arcs, flow counts, and entities occupy O(V + E) space.",
        uses: [
            "Provisioning edge-disjoint backup circuits in transport networks",
            "Routing independent multicast or fail-over paths",
            "Packing non-overlapping corridors in map and circuit design",
        ],
        references: [
            "Ahuja, Magnanti and Orlin, Network Flows, chapters on min-cost flow",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, maximum flow",
        ],
        workedExample:
            "From A to G, suppose A-B-G and A-C-D-G are edge-disjoint with costs 4 and 6, while the cheapest single route A-D-G costs 7. Sending two flow units selects the two cheaper disjoint routes for a total of 10, even though one of them is not the individually shortest path.",
    },
    id: "k-shortest-edge-disjoint",
    name: "K Shortest Edge-Disjoint Paths",
    category: "shortest-path",
    complexity: { time: "O(k * V * E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["C", 2],
                ["D", 5],
            ],
            B: [
                ["A", 1],
                ["C", 1],
                ["E", 3],
            ],
            C: [
                ["A", 2],
                ["B", 1],
                ["D", 1],
                ["F", 4],
            ],
            D: [
                ["A", 5],
                ["C", 1],
                ["G", 2],
            ],
            E: [
                ["B", 3],
                ["F", 1],
                ["G", 2],
            ],
            F: [
                ["C", 4],
                ["E", 1],
                ["G", 1],
            ],
            G: [
                ["D", 2],
                ["E", 2],
                ["F", 1],
            ],
        },
        source: "A",
        target: "G",
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a flow network with a super source and super sink",
        "give every undirected road capacity one and cost equal to its length",
        "find a cheapest source-to-sink path in the residual network",
        "if no path remains, stop augmenting",
        "augment flow along that path by its bottleneck capacity",
        "repeat until k units flow or no path remains",
        "walk positive-flow arcs to decompose the flow into routes",
        "report the routes and their combined cost",
    ],
};

export default module;
