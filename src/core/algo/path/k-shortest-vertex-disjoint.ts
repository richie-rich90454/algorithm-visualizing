/**
 * k-shortest-vertex-disjoint.ts - K Shortest Vertex-Disjoint Paths
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This greedy method builds up to k routes from a source to a target such that
 * no two routes share an intermediate vertex. It repeatedly runs Dijkstra on
 * the graph with previously used internal vertices deleted, keeps the cheapest
 * remaining path, and then forbids those internal vertices for later rounds.
 * The output is a set of vertex-disjoint routes ordered by discovery cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * V^2) for k array-scanned Dijkstra searches
 *   Space: O(V + E) for distances, predecessors, and the banned set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current shortest path is CYAN; banned vertices are RED.
 *   - Previously accepted paths fade to SORTED.
 *   - meta reports each path, its cost, and the running total.
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Weighted = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { graph?: Weighted; source?: string; target?: string; k?: number } | null
    ) ?? {};
    const graph: Weighted = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
            ["D", 1],
        ],
        B: [
            ["C", 1],
            ["E", 4],
        ],
        C: [["E", 2]],
        D: [
            ["C", 1],
            ["F", 6],
        ],
        E: [["G", 2]],
        F: [["G", 1]],
        G: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((ns) => ns.map(([v]) => v)),
        ]),
    ].sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no path to find.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { count: 0, totalCost: 0, paths: [] },
        };
        return;
    }
    const source = task.source && labels.includes(task.source) ? task.source : (labels[0] as string);
    const target = task.target && labels.includes(task.target) ? task.target : labels[labels.length - 1] as string;
    const k = typeof task.k === "number" ? Math.max(0, Math.min(6, Math.floor(task.k))) : 3;
    const banned = new Set<string>();
    const accepted: Array<{ path: string[]; cost: number }> = [];
    const nodes = makeGraphNodes(labels);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let step = 0;

    const dijkstra = (): { path: string[]; cost: number } | null => {
        const dist = new Map(labels.map((v) => [v, Infinity]));
        const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
        const done = new Set<string>();
        dist.set(source, 0);
        for (;;) {
            let u: string | null = null;
            let best = Infinity;
            for (const v of labels) {
                if (done.has(v) || banned.has(v)) continue;
                if ((dist.get(v) as number) < best) {
                    best = dist.get(v) as number;
                    u = v;
                }
            }
            if (u === null || !Number.isFinite(best)) break;
            if (u === target) break;
            done.add(u);
            for (const [v, w] of graph[u] ?? []) {
                if (banned.has(v) || done.has(v)) continue;
                const candidate = best + w;
                if (candidate < (dist.get(v) as number)) {
                    dist.set(v, candidate);
                    prev.set(v, u);
                }
            }
        }
        if (!Number.isFinite(dist.get(target) as number)) return null;
        const path: string[] = [];
        let cursor: string | null = target;
        const guard = new Set<string>();
        while (cursor !== null && !guard.has(cursor)) {
            guard.add(cursor);
            path.unshift(cursor);
            if (cursor === source) break;
            cursor = prev.get(cursor) ?? null;
        }
        if (path[0] !== source) return null;
        return { path, cost: dist.get(target) as number };
    };

    const snap = (description: string, line: number, current: string[] | null): VisualFrame => {
        for (const node of nodes) {
            const v = String(node.value);
            node.state = banned.has(v) ? "error" : "unvisited";
        }
        for (const solution of accepted) {
            for (const v of solution.path) {
                const node = byId.get(`node-${v}`);
                if (node && node.state !== "error") node.state = "sorted";
            }
        }
        if (current) {
            for (const v of current) {
                const node = byId.get(`node-${v}`);
                if (node) node.state = "path";
            }
        }
        const currentArcs = new Set<string>();
        if (current) {
            for (let i = 0; i + 1 < current.length; i += 1) currentArcs.add(`${current[i]}|${current[i + 1]}`);
        }
        const edges: VisualEdge[] = [];
        for (const [from, neighbors] of Object.entries(graph)) {
            for (const [to, weight] of neighbors) {
                if (!labels.includes(to)) continue;
                edges.push({
                    id: `edge-${from}-${to}`,
                    sourceId: `node-${from}`,
                    targetId: `node-${to}`,
                    label: String(weight),
                    state: currentArcs.has(`${from}|${to}`) ? "path" : "idle",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                count: accepted.length,
                totalCost: accepted.reduce((sum, p) => sum + p.cost, 0),
                paths: accepted.map((p) => `${p.path.join(">")}=${p.cost}`),
                banned: [...banned].sort(),
                source,
                target,
            },
        };
    };

    yield snap(`Find up to ${k} vertex-disjoint routes from ${source} to ${target}.`, 0, null);
    step += 1;

    for (let round = 0; round < k; round += 1) {
        const found = dijkstra();
        if (found === null) {
            yield snap(`Round ${round + 1}: no route remains after banning ${banned.size} vertex(es).`, 4, null);
            step += 1;
            break;
        }
        accepted.push(found);
        yield snap(
            `Round ${round + 1}: cheapest remaining route ${found.path.join(" -> ")} costs ${found.cost}.`,
            3,
            found.path,
        );
        step += 1;
        const internals = found.path.slice(1, -1);
        for (const v of internals) banned.add(v);
        yield snap(
            `Ban ${internals.length} internal vertex(es) so later routes stay disjoint.`,
            5,
            found.path,
        );
        step += 1;
    }

    yield snap(
        `Found ${accepted.length} vertex-disjoint route(s) with total cost ${accepted.reduce((sum, p) => sum + p.cost, 0)}.`,
        7,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Take the cheapest route first, then remove every intermediate vertex it uses and take the cheapest route that is left. Because later routes cannot pass through vertices already consumed, the collected routes never share an internal vertex, even though they still share the endpoints.",
        invariants: [
            "Every accepted route starts at the source and ends at the target.",
            "A vertex banned after one route is never used internally by a later route.",
            "Routes are discovered in nondecreasing cost order.",
        ],
        correctness:
            "Dijkstra returns a cheapest path in the graph with banned vertices removed, assuming nonnegative weights. Banning all internal vertices of an accepted path means no later path can share them, so the routes are pairwise vertex-disjoint apart from the endpoints. Repeating until k routes exist or no path remains terminates because each round either bans a new vertex or stops.",
        complexityRationale:
            "Each round runs one Dijkstra search that scans all V vertices to find the next minimum, so a round costs O(V^2 + E) and there are at most k rounds. Distances, predecessors, the banned set, and entities use O(V + E) space.",
        uses: [
            "Provisioning disjoint backup circuits in communication networks",
            "Finding independent routes for fail-over traffic engineering",
            "Packing non-overlapping paths in grid-based maze solving",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, shortest paths",
            "Ahuja, Magnanti and Orlin, Network Flows, chapter on disjoint paths",
        ],
        workedExample:
            "From A to G with A-D cost 1, D-C cost 1, C-E cost 2, E-G cost 2, the first route is A-D-C-E-G costing 6. Banning D, C and E leaves A-B-E-G impossible, so A-B-C-E-G is also blocked and only one disjoint route exists.",
    },
    id: "k-shortest-vertex-disjoint",
    name: "K Shortest Vertex-Disjoint Paths",
    category: "shortest-path",
    complexity: { time: "O(k * V^2)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
                ["D", 1],
            ],
            B: [
                ["C", 1],
                ["E", 4],
            ],
            C: [["E", 2]],
            D: [
                ["C", 1],
                ["F", 6],
            ],
            E: [["G", 2]],
            F: [["G", 1]],
            G: [],
        },
        source: "A",
        target: "G",
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with no banned vertices and an empty route list",
        "while fewer than k routes have been accepted",
        "run Dijkstra avoiding all banned vertices",
        "if no route reaches the target, stop",
        "append the cheapest route to the accepted list",
        "ban every internal vertex of that route",
        "continue to the next round",
        "report the routes and their combined cost",
    ],
};

export default module;
