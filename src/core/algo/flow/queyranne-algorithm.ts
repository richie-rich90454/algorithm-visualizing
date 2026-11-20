/**
 * queyranne-algorithm.ts - Queyranne Minimum Directed Cut
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Queyranne's algorithm finds the minimum directed cut of an undirected graph
 * using only n-1 maximum-flow computations. It fixes one root vertex r and,
 * for every other vertex v, computes the minimum v-to-r cut. The smallest of
 * those cut values equals the minimum over all nontrivial vertex subsets of
 * the total capacity leaving the subset, and the corresponding cut realizes
 * that optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * MF(n, m)) for n-1 max-flow computations
 *   Space: O(n^2) for the residual capacity matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Vertices on the source side of the current best cut are GREEN (sorted).
 *   - Edges crossing the best cut are YELLOW (comparing).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    edges?: Array<[string, string, number?]>;
    root?: string;
}

interface FlowResult {
    flow: number;
    reachable: boolean[];
}

/** Edmonds-Karp max flow on a capacity matrix; returns flow and source side. */
function maxFlow(capacity: number[][], source: number, sink: number): FlowResult {
    const n = capacity.length;
    const residual = capacity.map((row) => [...row]);
    let flow = 0;
    while (true) {
        const parent = new Array<number>(n).fill(-1);
        parent[source] = -2;
        const queue = [source];
        for (let head = 0; head < queue.length && parent[sink] === -1; head += 1) {
            const u = queue[head] as number;
            for (let v = 0; v < n; v += 1) {
                if (parent[v] !== -1 || (residual[u]?.[v] ?? 0) <= 0) continue;
                parent[v] = u;
                queue.push(v);
                if (v === sink) break;
            }
        }
        if (parent[sink] === -1) break;
        let bottleneck = Infinity;
        let v = sink;
        while (v !== source) {
            const u = parent[v] as number;
            bottleneck = Math.min(bottleneck, residual[u]?.[v] ?? 0);
            v = u;
        }
        v = sink;
        while (v !== source) {
            const u = parent[v] as number;
            residual[u]![v] = (residual[u]![v] ?? 0) - bottleneck;
            residual[v]![u] = (residual[v]![u] ?? 0) + bottleneck;
            v = u;
        }
        flow += bottleneck;
    }
    const reachable = new Array<boolean>(n).fill(false);
    reachable[source] = true;
    const queue = [source];
    for (let head = 0; head < queue.length; head += 1) {
        const u = queue[head] as number;
        for (let v = 0; v < n; v += 1) {
            if (!reachable[v] && (residual[u]?.[v] ?? 0) > 0) {
                reachable[v] = true;
                queue.push(v);
            }
        }
    }
    return { flow, reachable };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B", 2], ["A", "C", 1], ["B", "C", 3], ["C", "D", 2],
            ["D", "E", 4], ["E", "F", 1], ["F", "D", 2], ["G", "A", 3],
        ] as Array<[string, string, number?]>);
    const clean = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b, w]) => [a, b, typeof w === "number" && w > 0 ? w : 1] as [string, string, number]);
    const vertices = [...new Set(clean.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const rootIndex = typeof task.root === "string" && index.has(task.root)
        ? index.get(task.root) as number
        : n - 1;

    const base: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [a, b, w] of clean) {
        const u = index.get(a);
        const v = index.get(b);
        if (u === undefined || v === undefined || u === v) continue;
        base[u]![v] = (base[u]![v] ?? 0) + w;
        base[v]![u] = (base[v]![u] ?? 0) + w;
    }

    const edgeIds = clean
        .filter(([a, b]) => a !== b)
        .map(([a, b, w]) => ({ a, b, w, id: `edge-${a}-${b}` }));

    let bestValue = Infinity;
    let bestSide = new Array<boolean>(n).fill(false);
    let bestSource = -1;
    let step = 0;

    const makeFrame = (description: string, codeLine: number, phase: string, side: boolean[]): VisualFrame => {
        const cutEdges = new Set<string>();
        for (const e of edgeIds) {
            const u = index.get(e.a) as number;
            const v = index.get(e.b) as number;
            if (side[u] !== side[v]) cutEdges.add(e.id);
        }
        const entities: VisualEntity[] = vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (side[i] ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, side: side[i] },
        }));
        const edges: VisualEdge[] = edgeIds.map((e) => ({
            id: e.id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: String(e.w),
            state: (cutEdges.has(e.id) ? "comparing" : "idle") as EntityState,
            directed: false,
        }));
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                labels: vertices,
                bestValue: bestValue === Infinity ? -1 : bestValue,
                bestCut: edgeIds.filter((e) => {
                    const u = index.get(e.a) as number;
                    const v = index.get(e.b) as number;
                    return bestSide[u] !== bestSide[v];
                }).map((e) => `${e.a}-${e.b}`).join(","),
                bestSource: bestSource < 0 ? "" : vertices[bestSource] ?? "",
                checks: 0,
            },
        };
    };

    const initial = makeFrame(`Fix root ${vertices[rootIndex]}; scan every other vertex as a source.`, 0, "setup", new Array<boolean>(n).fill(false));
    yield initial;
    step += 1;

    let checks = 0;
    for (let source = 0; source < n; source += 1) {
        if (source === rootIndex) continue;
        const result = maxFlow(base.map((row) => [...row]), source, rootIndex);
        checks += 1;
        if (result.flow < bestValue) {
            bestValue = result.flow;
            bestSide = result.reachable;
            bestSource = source;
            const improved = makeFrame(
                `Source ${vertices[source]}: min cut ${result.flow} improves the best.`,
                2,
                "improve",
                result.reachable,
            );
            improved.meta["checks"] = checks;
            yield improved;
        } else {
            const checked = makeFrame(
                `Source ${vertices[source]}: min cut ${result.flow} does not improve ${bestValue}.`,
                1,
                "check",
                result.reachable,
            );
            checked.meta["checks"] = checks;
            yield checked;
        }
        step += 1;
    }

    const final = makeFrame(
        `Minimum directed cut is ${bestValue}, found from source ${vertices[bestSource] ?? "?"}.`,
        5,
        "done",
        bestSide,
    );
    final.meta["checks"] = checks;
    final.meta["root"] = vertices[rootIndex] ?? "";
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A directed cut of an undirected graph is the set of edges leaving some group of vertices toward the rest. Instead of trying every group, fix one root and ask how cheaply each other vertex can be separated from that root. The cheapest such separation is a globally minimum directed cut, because every nontrivial group omits at least one non-root vertex and contains at most all but the root.",
        invariants: [
            "A min s-root cut always separates s from the root.",
            "The recorded best value never increases as sources are scanned.",
            "Each undirected edge is modeled by two arcs of equal capacity, one in each direction.",
        ],
        correctness:
            "For any nontrivial subset S there is a vertex s in S different from the root r, so the minimum s-r cut is at most the capacity leaving S; taking the minimum over all s therefore cannot exceed the true optimum. Conversely, every s-r cut is a valid directed cut, so the minimum found is at least the optimum. The two inequalities force equality, and the source-side residual reachability at the best flow exhibits an optimal cut.",
        complexityRationale:
            "The algorithm performs n-1 max-flow computations; with Edmonds-Karp each costs O(V * E^2) in general, written here as MF(n, m). Residual matrices use O(n^2) space and are copied per source.",
        uses: [
            "Network reliability and vulnerability analysis",
            "Image segmentation via minimum graph cuts",
            "Finding the weakest separation in communication networks",
        ],
        references: [
            "Queyranne, Minimizing Symmetric Submodular Functions, Mathematical Programming, 1998",
            "CLRS, Introduction to Algorithms, Chapter 26 on maximum flow and minimum cut",
        ],
        workedExample:
            "On a triangle A-B-C with unit capacities and root C, separating A from C cuts one edge with capacity 1, and separating B from C also costs 1. The minimum directed cut is therefore 1, witnessed by the group containing only A.",
    },
    id: "queyranne-algorithm",
    name: "Queyranne Minimum Directed Cut",
    category: "flow",
    complexity: { time: "O(n * MF(n, m))", space: "O(n^2)" },
    defaultInput: {
        edges: [["A", "B", 2], ["A", "C", 1], ["B", "C", 3], ["C", "D", 2], ["D", "E", 4], ["E", "F", 1], ["F", "D", 2], ["G", "A", 3]],
        root: "G",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected capacity matrix with both arc directions",
        "choose an arbitrary root vertex",
        "for each other vertex as source",
        "compute the minimum source-to-root cut with max flow",
        "if its value beats the best, record its source side",
        "after all sources, take the smallest recorded cut",
        "read off the edges leaving the recorded source side",
        "done: report the minimum directed cut and its value",
    ],
};

export default module;
