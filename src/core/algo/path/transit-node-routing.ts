/**
 * transit-node-routing.ts - Transit Node Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * On a large road network most long trips pass through a small set of important
 * junctions. Transit node routing precomputes distances between those hubs and,
 * for every vertex, a short access list of the nearest hubs. A query then tries
 * only hub pairs from the two access lists and combines the precomputed pieces:
 * source to hub, hub to hub, hub to target. With every vertex available as a
 * hub the answer is exact; with fewer hubs it is a fast upper bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) preprocessing; O(a^2) per query for access lists of size a
 *   Space: O(V^2) for the all-pairs table and access lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Transit vertices are GREEN; query endpoints are YELLOW.
 *   - The selected source hub and target hub are highlighted and the route is
 *     drawn with active edges.
 *   - meta reports the query distance and the chosen transfer hubs.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualFrame } from "@/types";

const defaultGraph: Record<string, Array<[string, number]>> = {
    A: [
        ["B", 2],
        ["C", 6],
    ],
    B: [
        ["C", 1],
        ["D", 4],
        ["E", 8],
    ],
    C: [["D", 2]],
    D: [["E", 3]],
    E: [],
};

function makeNodes(labels: string[], states: Map<string, EntityState>): VisualFrame["entities"] {
    return labels.map((v) => ({
        id: `node-${v}`,
        type: "node" as const,
        label: v,
        value: v,
        state: states.get(v) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: v },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            graph?: Record<string, Array<[string, number]>>;
            queries?: Array<[string, string]>;
            transit?: string[];
            accessCount?: number;
        } | null
    ) ?? {};
    const graph = task.graph && typeof task.graph === "object" ? task.graph : defaultGraph;
    const labels = [...new Set([
        ...Object.keys(graph),
        ...Object.values(graph).flatMap((list) => (Array.isArray(list) ? list.map(([v]) => String(v)) : [])),
    ])];
    const n = labels.length;
    const index = new Map(labels.map((v, i) => [v, i]));
    const queries = Array.isArray(task.queries) && task.queries.length > 0
        ? task.queries.map((q) => [String(q[0]), String(q[1])] as [string, string])
        : ([["A", "E"], ["C", "E"], ["D", "A"]] as Array<[string, string]>);
    const transit = Array.isArray(task.transit) && task.transit.length > 0
        ? task.transit.filter((v) => index.has(v))
        : [...labels];
    const accessCount = Math.max(1, Math.min(transit.length || 1, Math.floor(task.accessCount ?? (transit.length || 1))));

    const d: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    const next: Array<Array<number | null>> = Array.from({ length: n }, () => Array.from({ length: n }, () => null));
    for (const [u, list] of Object.entries(graph)) {
        const i = index.get(u);
        if (i === undefined || !Array.isArray(list)) {
            continue;
        }
        for (const [v, weight] of list) {
            const j = index.get(String(v));
            const w = Number(weight);
            if (j !== undefined && Number.isFinite(w) && w >= 0) {
                d[i]![j] = w;
                next[i]![j] = j;
            }
        }
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                if ((d[i]![k] ?? Infinity) + (d[k]![j] ?? Infinity) < (d[i]![j] ?? Infinity)) {
                    d[i]![j] = (d[i]![k] ?? Infinity) + (d[k]![j] ?? Infinity);
                    next[i]![j] = next[i]![k];
                }
            }
        }
    }

    const pathBetween = (from: string, to: string): string[] => {
        let i = index.get(from);
        const target = index.get(to);
        if (i === undefined || target === undefined || next[i]![target] === null) {
            return [];
        }
        const result = [from];
        let guard = 0;
        while (i !== target && guard < n + 1) {
            i = next[i]![target]!;
            result.push(labels[i]!);
            guard += 1;
        }
        return result;
    };
    const access = new Map<string, string[]>(
        labels.map((v) => [
            v,
            [...transit].sort((a, b) => (d[index.get(v)!]![index.get(a)!] ?? Infinity) - (d[index.get(v)!]![index.get(b)!] ?? Infinity)).slice(0, accessCount),
        ]),
    );

    const edgeList: Array<{ from: string; to: string; weight: number }> = [];
    for (const [u, list] of Object.entries(graph)) {
        for (const [v, weight] of Array.isArray(list) ? list : []) {
            edgeList.push({ from: u, to: String(v), weight: Number(weight) });
        }
    }
    const makeEdges = (activePath: string[]): VisualEdge[] =>
        edgeList.map((e, i) => {
            const active = activePath.some((v, k) => k + 1 < activePath.length && activePath[k] === e.from && activePath[k + 1] === e.to);
            return {
                id: `edge-${i}`,
                sourceId: `node-${e.from}`,
                targetId: `node-${e.to}`,
                label: String(e.weight),
                state: (active ? "active" : "idle") as EntityState,
                directed: true,
            };
        });

    let step = 0;
    const frame = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        activePath: string[],
        results: Array<{ query: string; distance: number; hubs: string }>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeNodes(labels, states),
        edges: makeEdges(activePath),
        description,
        codeLineNumber,
        layout: "graph",
        meta: {
            transitCount: transit.length,
            accessCount,
            queries: results.map((r) => r.query),
            answers: results.map((r) => (r.distance === Infinity ? -1 : r.distance)),
            lastHubs: results.length > 0 ? (results[results.length - 1]?.hubs ?? "") : "",
            resultsComplete: results.length,
        },
    });

    const initialStates = new Map<string, EntityState>(transit.map((v) => [v, "sorted" as EntityState]));
    if (n === 0) {
        yield frame("Empty graph - there are no routes to precompute.", 0, new Map(), [], []);
        return;
    }
    yield frame(
        `Transit node routing with ${transit.length} hub(s) and access lists of ${accessCount}; all-pairs preprocessing is done.`,
        0,
        initialStates,
        [],
        [],
    );

    const results: Array<{ query: string; distance: number; hubs: string }> = [];
    for (const [source, target] of queries) {
        if (!index.has(source) || !index.has(target)) {
            results.push({ query: `${source}->${target}`, distance: Infinity, hubs: "none" });
            yield frame(`Query ${source} to ${target} is invalid because an endpoint is not in the graph.`, 2, initialStates, [], results);
            continue;
        }
        let best = Infinity;
        let bestA = "";
        let bestB = "";
        for (const a of access.get(source) ?? []) {
            for (const b of access.get(target) ?? []) {
                const ia = index.get(a)!;
                const ib = index.get(b)!;
                const total = (d[index.get(source)!]![ia] ?? Infinity) + (d[ia]![ib] ?? Infinity) + (d[ib]![index.get(target)!] ?? Infinity);
                if (total < best) {
                    best = total;
                    bestA = a;
                    bestB = b;
                }
            }
        }
        const states = new Map<string, EntityState>(initialStates);
        states.set(source, "comparing");
        states.set(target, "comparing");
        if (bestA) {
            states.set(bestA, "path");
        }
        if (bestB) {
            states.set(bestB, "path");
        }
        const route = [
            ...pathBetween(source, bestA),
            ...pathBetween(bestA, bestB).slice(1),
            ...pathBetween(bestB, target).slice(1),
        ].filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
        results.push({
            query: `${source}->${target}`,
            distance: best,
            hubs: `${bestA || "-"} to ${bestB || "-"}`,
        });
        yield frame(
            `Query ${source} to ${target} via hubs ${bestA || "?"} and ${bestB || "?"} costs ${best === Infinity ? "unreachable" : best}.`,
            4,
            states,
            route,
            results,
        );
    }

    yield frame(
        `Answered ${results.length} query(s) using ${transit.length} transit node(s); distances are combined from the precomputed table.`,
        7,
        initialStates,
        [],
        results,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Long routes tend to funnel through a handful of major junctions. Precompute the distance between every pair of those junctions and, for each ordinary vertex, remember only its nearest few junctions. To answer a query, combine the three precomputed legs: get to a hub near the source, jump between hubs, then leave a hub near the target.",
        invariants: [
            "Every access list contains only declared transit vertices.",
            "The combined cost is the sum of a source leg, a hub leg, and a target leg.",
            "Using the full transit set makes the query distance an exact shortest path.",
        ],
        correctness:
            "The all-pairs table gives exact distances for each leg, so every candidate combination is the length of a real walk from source to target and the reported value is an upper bound on the true distance. When all vertices are transit nodes and access lists include all of them, choosing the source and target themselves makes one candidate equal the optimal path, and no candidate can be shorter than optimal, so the minimum is exactly the shortest distance.",
        complexityRationale:
            "All-pairs preprocessing is O(V^3) time and O(V^2) space. Building each access list sorts the transit set, O(V log V) per vertex. A query tries every pair of access hubs, O(a^2), which is a small constant when a is limited.",
        uses: [
            "Fast route planning in road networks and navigation services",
            "Spatial query acceleration with precomputed landmarks",
            "A teaching bridge between plain Dijkstra and full contraction hierarchies",
        ],
        references: [
            "Bast, Funke, and Matijevic, Transit Nodes Routing in Road Networks, 2007",
            "Dijkstra, A Note on Two Problems in Connexion with Graphs, 1959",
        ],
        workedExample:
            "On a small graph, picking every vertex as a hub makes the access list of A include E indirectly through the all-pairs table. The query A to E compares combinations such as A-B plus B-E and A-C plus C-E, and the smallest combination is exactly the shortest path.",
    },
    id: "transit-node-routing",
    name: "Transit Node Routing",
    category: "shortest-path",
    complexity: { time: "O(V^3) preprocessing, O(a^2) per query", space: "O(V^2)" },
    defaultInput: { graph: defaultGraph, queries: [["A", "E"], ["C", "E"], ["D", "A"]] },
    visualType: "graph",
    run,
    pseudocode: [
        "precompute all-pairs shortest distances and next hops",
        "select a set of transit vertices or use all vertices",
        "for each vertex store its closest access transit nodes",
        "for each query from s to t",
        "try every pair of access hubs a near s and b near t",
        "combine distance s-a plus a-b plus b-t",
        "keep the smallest combined distance as the answer",
        "done: report the query distances and chosen hubs",
    ],
};

export default module;
