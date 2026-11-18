/**
 * weighted-a-star.ts - Weighted A* Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Weighted A* speeds up A* by multiplying the heuristic by a weight greater
 * than one, making the search greedy about reaching the goal. The result is no
 * longer guaranteed optimal, but with a consistent heuristic its cost is at
 * most w times the optimal cost. Setting w to one recovers ordinary A*. This
 * module derives an exact remaining-cost heuristic by a reverse Dijkstra pass,
 * then runs the weighted search and compares the found cost with the optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) for the reverse pass plus O(E log V) for the search
 *   Space: O(V + E) for distances, bookkeeping and entity lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being expanded is BLUE (comparing).
 *   - Edges relaxed in the current step are ACTIVE (blue).
 *   - Closed nodes are GREEN (sorted); the final path is CYAN (path).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type Graph = Record<string, Array<[string, number]>>;

interface Input {
    graph?: Graph;
    start?: string;
    target?: string;
    weight?: number;
}

const DEFAULT_GRAPH: Graph = {
    A: [["B", 4], ["C", 2]],
    B: [["D", 5], ["E", 3]],
    C: [["B", 1], ["D", 8]],
    D: [["E", 2], ["F", 6]],
    E: [["F", 1]],
    F: [],
};

/** Exact remaining cost from every node to the target (an admissible heuristic). */
function reverseDijkstra(graph: Graph, target: string): Map<string, number> {
    const reverse: Graph = {};
    for (const vertex of Object.keys(graph)) {
        reverse[vertex] = [];
    }
    for (const [from, neighbors] of Object.entries(graph)) {
        for (const [to, cost] of neighbors) {
            reverse[to]?.push([from, cost]);
        }
    }
    const distance = new Map<string, number>();
    for (const vertex of Object.keys(graph)) {
        distance.set(vertex, Number.POSITIVE_INFINITY);
    }
    distance.set(target, 0);
    const visited = new Set<string>();
    while (true) {
        let current: string | undefined;
        let best = Number.POSITIVE_INFINITY;
        for (const [vertex, value] of distance) {
            if (!visited.has(vertex) && value < best) {
                best = value;
                current = vertex;
            }
        }
        if (current === undefined) {
            break;
        }
        visited.add(current);
        for (const [neighbor, cost] of reverse[current] ?? []) {
            const candidate = best + cost;
            if (candidate < (distance.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
                distance.set(neighbor, candidate);
            }
        }
    }
    return distance;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const graph: Graph = raw.graph ?? DEFAULT_GRAPH;
    const start = raw.start ?? "A";
    const target = raw.target ?? "F";
    const weight = typeof raw.weight === "number" ? Math.max(1, raw.weight) : 2;

    const vertices = Object.keys(graph);
    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);
    const heuristic = reverseDijkstra(graph, target);
    const optimal = heuristic.get(start) ?? Number.POSITIVE_INFINITY;

    const gScore = new Map<string, number>();
    const parent = new Map<string, string>();
    const closed = new Set<string>();
    for (const vertex of vertices) {
        gScore.set(vertex, Number.POSITIVE_INFINITY);
    }
    gScore.set(start, 0);
    const hAt = (node: string): number => {
        const value = heuristic.get(node) ?? Number.POSITIVE_INFINITY;
        return Number.isFinite(value) ? value : 0;
    };
    const open: Array<{ node: string; priority: number }> = [{ node: start, priority: weight * hAt(start) }];
    let expanded = 0;
    let path: string[] = [];
    let cost = Number.POSITIVE_INFINITY;

    const styledNodes = (active?: string): VisualEntity[] =>
        nodes.map((node) => ({
            ...node,
            state: (active !== undefined && node.value === active
                ? "comparing"
                : closed.has(String(node.value))
                  ? "sorted"
                  : "unvisited") as EntityState,
        }));
    const styledEdges = (activeEdges: Set<string>, pathEdges: Set<string>) =>
        edges.map((edge) => ({
            ...edge,
            state: (pathEdges.has(edge.id) ? "path" : activeEdges.has(edge.id) ? "active" : "idle") as EntityState,
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: styledNodes(),
        edges: styledEdges(new Set(), new Set()),
        description: `Weighted A* from ${start} to ${target} with weight ${weight}; f(n) = g(n) + ${weight} times h(n).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { start, target, weight, expanded, optimal, cost, path },
    };
    step += 1;

    while (open.length > 0) {
        open.sort((a, b) => a.priority - b.priority);
        const current = open.shift();
        if (current === undefined) {
            break;
        }
        if (closed.has(current.node)) {
            continue;
        }
        closed.add(current.node);
        expanded += 1;
        const activeEdges = new Set<string>();
        if (current.node === target) {
            const chain: string[] = [];
            let cursor: string | undefined = target;
            while (cursor !== undefined) {
                chain.unshift(cursor);
                if (cursor === start) {
                    break;
                }
                cursor = parent.get(cursor);
            }
            path = chain;
            cost = gScore.get(target) ?? Number.POSITIVE_INFINITY;
            yield {
                stepNumber: step,
                entities: nodes.map((node) => ({
                    ...node,
                    state: (path.includes(String(node.value)) ? "path" : "sorted") as EntityState,
                })),
                edges: styledEdges(activeEdges, new Set()),
                description: `Reached ${target} after expanding ${expanded} node(s); path cost ${cost} versus optimal ${optimal}.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: { start, target, weight, expanded, cost, optimal, path },
            };
            step += 1;
            break;
        }
        for (const [neighbor, edgeCost] of graph[current.node] ?? []) {
            const tentative = (gScore.get(current.node) ?? Number.POSITIVE_INFINITY) + edgeCost;
            if (tentative < (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
                gScore.set(neighbor, tentative);
                parent.set(neighbor, current.node);
                open.push({ node: neighbor, priority: tentative + weight * hAt(neighbor) });
                activeEdges.add(`edge-${current.node}-${neighbor}`);
            }
        }
        yield {
            stepNumber: step,
            entities: styledNodes(current.node),
            edges: styledEdges(activeEdges, new Set()),
            description: `Expanded ${current.node} with g=${(gScore.get(current.node) ?? 0).toFixed(2)}; relaxed ${activeEdges.size} outgoing edge(s).`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { expanded, current: current.node, g: gScore.get(current.node) ?? 0, relaxed: activeEdges.size, optimal },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({
            ...node,
            state: (path.includes(String(node.value)) ? "path" : "unvisited") as EntityState,
        })),
        edges: styledEdges(new Set(), new Set()),
        description: `Search finished: cost ${Number.isFinite(cost) ? cost : "unreachable"} with weight ${weight}; ${expanded} node(s) expanded.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { start, target, weight, expanded, cost, optimal, path },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary A* balances distance traveled against estimated distance remaining. Multiplying the estimate by a weight above one makes the search trust its guess more and rush toward the goal, often expanding far fewer nodes. The price is a possibly longer route, bounded by the weight times the best possible route.",
        invariants: [
            "The heuristic is the exact remaining cost from each node, so it never overestimates.",
            "When a node is expanded, its g-score is the best cost found so far.",
            "With weight one the found cost equals the optimal cost.",
        ],
        correctness:
            "The reverse Dijkstra pass gives the true shortest distance to the goal, which is consistent and admissible. Weighted A* orders nodes by g plus w times h. A standard bound shows that any node on an optimal path with an f-value at most the optimal cost will be expanded before a goal whose f-value exceeds w times the optimum, so the returned cost is at most w times optimal. Setting w to one reduces the ordering to ordinary A* and restores optimality.",
        complexityRationale:
            "Reverse Dijkstra and the weighted search each examine every edge once, with priority operations costing logarithmic time, so both are O(E log V) and the space is linear in vertices and edges.",
        uses: [
            "Real-time pathfinding in video games",
            "Robot navigation where a quick near-optimal route is preferred",
            "Any A* application that trades solution quality for speed",
        ],
        references: [
            "Hart, Nilsson and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
            "Pohl, Heuristic Search Viewed as Path Finding in a Graph, 1970",
        ],
        workedExample:
            "On a small map where the optimal route costs ten, running weighted A* with weight two may expand only a few nodes and return a route costing fourteen. That is above ten but within twice ten, and the same search with weight one returns exactly ten.",
    },
    id: "weighted-a-star",
    name: "Weighted A*",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: { graph: DEFAULT_GRAPH, start: "A", target: "F", weight: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "compute true remaining costs to the goal by reverse Dijkstra",
        "set each node's g-score to infinity except the start at zero",
        "push the start with priority weight times its remaining cost",
        "pop the node with smallest priority and mark it closed",
        "relax each outgoing edge using g of the current node plus its cost",
        "push updated neighbors with priority g plus weight times remaining cost",
        "when the goal is popped reconstruct the path and report its cost",
    ],
};

export default module;
