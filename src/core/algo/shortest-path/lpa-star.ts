/**
 * lpa-star.ts - Lifelong Planning A*
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lifelong Planning A* (LPA*) finds a shortest path and then repairs it cheaply
 * when edge costs change. It keeps two estimates per vertex: g, the best known
 * cost from the start, and rhs, the best cost through a predecessor. A vertex
 * is locally consistent when g equals rhs; inconsistent vertices sit in a
 * priority queue ordered by the smaller of the two plus a heuristic. Expanding
 * inconsistent vertices restores consistency and yields the true distances.
 * When an edge cost changes, only the affected vertex and its descendants are
 * marked inconsistent, so most of the previous search tree is reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) for a full search; typically far less per repair
 *   Space: O(V + E) for the estimates, predecessor map, and queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices show search state: expanded, inconsistent, or on the final path.
 *   - A changed edge flashes RED; path edges are CYAN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type Costs = Record<string, Array<[string, number]>>;

/** Replace one directed edge cost, appending it when the edge is new. */
function setCost(graph: Costs, u: string, v: string, cost: number): void {
    const list = graph[u] ?? [];
    const existing = list.find(([to]) => to === v);
    if (existing) {
        existing[1] = cost;
    } else {
        list.push([v, cost]);
    }
    graph[u] = list;
}

/** Get the cost of a directed edge, or Infinity when it does not exist. */
function edgeCost(graph: Costs, u: string, v: string): number {
    return (graph[u] ?? []).find(([to]) => to === v)?.[1] ?? Infinity;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Costs;
            start?: string;
            goal?: string;
            heuristic?: Record<string, number>;
            changes?: Array<[string, string, number]>;
        } | null) ?? {};
    const graph: Costs = JSON.parse(
        JSON.stringify(
            task.graph ?? {
                A: [
                    ["B", 2],
                    ["C", 5],
                ],
                B: [
                    ["C", 1],
                    ["D", 4],
                ],
                C: [["D", 1]],
                D: [],
            },
        ),
    ) as Costs;
    const start = task.start ?? "A";
    const goal = task.goal ?? "D";
    const heuristic = task.heuristic ?? {};
    const changes = task.changes ?? [];

    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((list) => list.map(([to]) => to)),
        ]),
    ];
    if (!labels.includes(start)) labels.push(start);
    if (!labels.includes(goal)) labels.push(goal);

    const g = new Map<string, number>(labels.map((v) => [v, Infinity]));
    const rhs = new Map<string, number>(labels.map((v) => [v, Infinity]));
    const parent = new Map<string, string | null>(labels.map((v) => [v, null]));
    const expanded = new Set<string>();
    const inconsistent = new Set<string>();
    const h = (v: string): number => Math.max(0, heuristic[v] ?? 0);
    const gv = (v: string): number => g.get(v) ?? Infinity;
    const rv = (v: string): number => rhs.get(v) ?? Infinity;
    const minOf = (v: string): number => Math.min(gv(v), rv(v));
    const key = (v: string): [number, number] => [minOf(v) + h(v), minOf(v)];
    const lessKey = (a: [number, number], b: [number, number]): boolean =>
        a[0] < b[0] - 1e-12 || (Math.abs(a[0] - b[0]) <= 1e-12 && a[1] < b[1] - 1e-12);

    const preds = new Map<string, string[]>(labels.map((v) => [v, []]));
    const succ = new Map<string, string[]>(labels.map((v) => [v, []]));
    for (const [u, list] of Object.entries(graph)) {
        for (const [v] of list) {
            succ.get(u)?.push(v);
            preds.get(v)?.push(u);
        }
    }

    let queue: string[] = [];
    const removeFromQueue = (v: string): void => {
        queue = queue.filter((node) => node !== v);
    };
    const updateVertex = (v: string): void => {
        if (v !== start) {
            let best = Infinity;
            let bestParent: string | null = null;
            for (const p of preds.get(v) ?? []) {
                const candidate = gv(p) + edgeCost(graph, p, v);
                if (candidate < best) {
                    best = candidate;
                    bestParent = p;
                }
            }
            rhs.set(v, best);
            parent.set(v, bestParent);
        }
        removeFromQueue(v);
        if (gv(v) !== rv(v)) {
            queue.push(v);
            inconsistent.add(v);
        } else {
            inconsistent.delete(v);
        }
    };

    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(graph);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const snapshot = (
        description: string,
        codeLine: number,
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: codeLine,
        layout: "graph",
        meta: {
            start,
            goal,
            gValues: labels.map((v) => (Number.isFinite(gv(v)) ? gv(v) : "inf")),
            rhsValues: labels.map((v) => (Number.isFinite(rv(v)) ? rv(v) : "inf")),
            expansions: expansionsThisSearch,
            ...extra,
        },
    });

    const colorPath = (path: string[]): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const v of path) {
            const node = byId.get(`node-${v}`);
            if (node) node.state = "path";
        }
        for (const e of edges) {
            e.state = "idle";
            const from = e.sourceId.slice(5);
            const to = e.targetId.slice(5);
            for (let i = 1; i < path.length; i += 1) {
                if (from === path[i - 1] && to === path[i]) e.state = "path";
            }
        }
    };

    const pathTo = (): string[] => {
        if (!Number.isFinite(gv(goal))) return [];
        const path: string[] = [goal];
        const seen = new Set<string>([goal]);
        let current = goal;
        while (current !== start) {
            const next = parent.get(current);
            if (!next || seen.has(next)) break;
            path.push(next);
            seen.add(next);
            current = next;
        }
        return path.reverse();
    };

    let step = 0;
    let expansionsThisSearch = 0;

    rhs.set(start, 0);
    queue.push(start);
    inconsistent.add(start);
    yield snapshot(`Initialized LPA* from ${start} to ${goal}; rhs(${start}) is zero and all g values are infinite.`, 1, {
        phase: "init",
    });
    step += 1;

    /** Restore local consistency, emitting a frame for each expansion. */
    function* search(): Generator<VisualFrame, void, unknown> {
        let guard = 0;
        while (queue.length > 0 && guard < 10000) {
            guard += 1;
            queue.sort((a, b) => {
                const ka = key(a);
                const kb = key(b);
                return lessKey(ka, kb) ? -1 : lessKey(kb, ka) ? 1 : 0;
            });
            const goalKey = key(goal);
            const minKey = key(queue[0] ?? goal);
            if (!lessKey(minKey, goalKey) && rv(goal) === gv(goal)) break;
            const u = queue.shift();
            if (!u) break;
            expanded.add(u);
            inconsistent.delete(u);
            expansionsThisSearch += 1;
            const node = byId.get(`node-${u}`);
            if (node) node.state = "visited";
            if (gv(u) > rv(u)) {
                g.set(u, rv(u));
                for (const v of succ.get(u) ?? []) updateVertex(v);
            } else {
                g.set(u, Infinity);
                updateVertex(u);
                for (const v of succ.get(u) ?? []) updateVertex(v);
            }
            yield snapshot(
                `Expanded ${u}: g=${Number.isFinite(gv(u)) ? gv(u).toFixed(2) : "inf"}, rhs=${Number.isFinite(rv(u)) ? rv(u).toFixed(2) : "inf"}; ${queue.length} inconsistent vertex(es) remain.`,
                4,
                { phase: "search", expanded: u },
            );
            step += 1;
        }
    }

    yield* search();

    let path = pathTo();
    colorPath(path);
    yield snapshot(
        Number.isFinite(gv(goal))
            ? `First path found with cost ${gv(goal).toFixed(2)} after ${expansionsThisSearch} expansion(s).`
            : `No path from ${start} to ${goal} after ${expansionsThisSearch} expansion(s).`,
        6,
        { phase: "path", cost: Number.isFinite(gv(goal)) ? gv(goal) : "inf", path },
    );
    step += 1;

    for (let ci = 0; ci < changes.length; ci += 1) {
        const change = changes[ci];
        if (!change) continue;
        const [u, v, cost] = change;
        setCost(graph, u, v, cost);
        const target = v;
        updateVertex(target);
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) {
            e.state = "idle";
            if (e.sourceId === `node-${u}` && e.targetId === `node-${v}`) {
                e.state = "swapped";
                e.label = String(cost);
            }
        }
        expansionsThisSearch = 0;
        yield snapshot(
            `Edge ${u} to ${v} changed to ${cost}; marked ${target} inconsistent and reused the rest of the tree.`,
            8,
            { phase: "change", changedEdge: `${u}-${v}`, newCost: cost },
        );
        step += 1;

        yield* search();
        path = pathTo();
        colorPath(path);
        yield snapshot(
            Number.isFinite(gv(goal))
                ? `Repaired path cost ${gv(goal).toFixed(2)} using only ${expansionsThisSearch} expansion(s).`
                : `Goal ${goal} is now unreachable after the cost change.`,
            10,
            { phase: "repaired", cost: Number.isFinite(gv(goal)) ? gv(goal) : "inf", path },
        );
        step += 1;
    }

    path = pathTo();
    colorPath(path);
    yield snapshot(
        Number.isFinite(gv(goal))
            ? `Final shortest path ${path.join(" -> ")} with cost ${gv(goal).toFixed(2)}.`
            : `Final result: ${goal} is unreachable from ${start}.`,
        11,
        { phase: "done", cost: Number.isFinite(gv(goal)) ? gv(goal) : "inf", path },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Replanning from scratch after every map update wastes work that was already done. LPA* remembers the search tree from the previous query and keeps each vertex's g and rhs estimates. When an edge cost changes, only vertices made inconsistent by that change are reinserted into the queue. Expanding them repairs the distances while untouched parts of the tree are reused, so small edits cost far less than a fresh search.",
        invariants: [
            "A vertex is locally consistent exactly when its g equals its rhs.",
            "Inconsistent vertices are the only ones held in the priority queue.",
            "When the queue empties under the stop rule, every vertex is locally consistent and g equals the true distance.",
        ],
        correctness:
            "The rhs value of a vertex is the smallest one-step cost through a predecessor using their current g values, so g greater than rhs means the best-known path has improved and g less than rhs means its supporting predecessor changed. Processing the minimum-key inconsistent vertex restores its consistency and propagates the change to its successors, mirroring a Dijkstra-style relaxation with the heuristic as a tie-breaking lower bound. When the minimum key reaches the goal's key and the goal is consistent, no inconsistent vertex remains with a bound small enough to lower the goal, so the g values equal the true shortest distances and following predecessor pointers reconstructs an optimal path.",
        complexityRationale:
            "A full search expands each vertex a bounded number of times with logarithmic queue operations, giving O(E log V). A repair touches only the changed vertex and the inconsistent subtree it creates, so its cost is proportional to the affected region rather than the whole graph; the maps and queue use O(V plus E) space.",
        uses: [
            "Robot path planning when obstacles appear or move",
            "Route recalculation in maps with changing traffic costs",
            "Replanning in game AI and dynamic logistics networks",
        ],
        references: [
            "Likhachev, Gordon and Stentz, LPA*: Lifelong Planning A*, Artificial Intelligence, 2004",
            "Stentz, The Focused D* Algorithm for Real-Time Replanning, 1995",
        ],
        workedExample:
            "On a diamond graph from A to D via B and C, the first search expands A, then C with cost one, then B, settling D at cost three. If edge C to D rises from one to six, only C and D become inconsistent. Reexpanding C raises D to eight, and the repaired path switches to A, B, D with cost six, without revisiting unrelated vertices.",
    },
    id: "lpa-star",
    name: "Lifelong Planning A* (LPA*)",
    category: "shortest-path",
    complexity: { time: "O(E log V) first search; less per repair", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [
                ["C", 1],
                ["D", 4],
            ],
            C: [["D", 1]],
            D: [],
        },
        start: "A",
        goal: "D",
        changes: [["C", "D", 6]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set all g and rhs values to infinity and rhs of start to zero",
        "place every locally inconsistent vertex in a priority queue",
        "while the best queue key precedes the goal key or the goal is inconsistent",
        "remove the minimum-key vertex and mark it consistent",
        "if g exceeds rhs raise g to rhs and update successors",
        "otherwise set g to infinity and update the vertex and its successors",
        "follow predecessor pointers to reconstruct the shortest path",
        "when an edge cost changes update only the affected vertex",
        "mark that vertex inconsistent for the repair pass",
        "reexpand only the inconsistent vertices",
        "follow predecessors again for the repaired path",
        "done: report the final path and its cost",
    ],
};

export default module;
