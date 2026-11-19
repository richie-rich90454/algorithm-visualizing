/**
 * ad-star.ts - AD* (Anytime Dynamic A*).
 *
 * AD* merges the anytime behavior of ARA* with the incremental repair of D*
 * Lite. It first returns a quickly computed, suboptimal path under an inflated
 * heuristic, then keeps shrinking the inflation to improve the path. When an
 * edge cost changes while the agent is moving, only the affected part of the
 * search is replanned, and the anytime loop continues toward an optimal route.
 *
 * Time:  O(k * (E log V)) for k epsilon levels and replanning rounds
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

interface SearchResult {
    path: string[];
    cost: number;
    visited: string[];
}

/** Inflated-heuristic A* search (the "anytime" core of ARA*). */
function inflatedAStar(
    wadj: WAdj,
    coords: Coords,
    start: string,
    goal: string,
    epsilon: number,
): SearchResult {
    const dist = new Map<string, number>();
    const parent = new Map<string, string>();
    const open = new Set<string>([start]);
    const closed = new Set<string>();
    const visited: string[] = [];
    dist.set(start, 0);
    const h = (v: string): number => {
        const a = coords[v];
        const b = coords[goal];
        if (!a || !b) return 0;
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const f = (v: string): number => (dist.get(v) ?? Infinity) + epsilon * h(v);
    for (let guard = 0; open.size > 0 && guard < 500; guard += 1) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of open) {
            const value = f(v);
            if (value < best) {
                best = value;
                u = v;
            }
        }
        if (u === null) break;
        open.delete(u);
        closed.add(u);
        visited.push(u);
        if (u === goal) break;
        for (const [next, weight] of wadj[u] ?? []) {
            if (closed.has(next)) continue;
            const candidate = (dist.get(u) as number) + weight;
            if (candidate < (dist.get(next) ?? Infinity)) {
                dist.set(next, candidate);
                parent.set(next, u);
                open.add(next);
            }
        }
    }
    if (!dist.has(goal)) return { path: [], cost: Infinity, visited };
    const path: string[] = [];
    let cursor: string | undefined = goal;
    while (cursor !== undefined) {
        path.unshift(cursor);
        if (cursor === start) break;
        cursor = parent.get(cursor);
    }
    return { path, cost: dist.get(goal) as number, visited };
}

/** Dijkstra reference used to verify each reported cost. */
function optimum(wadj: WAdj, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(wadj)) dist.set(v, Infinity);
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of wadj[u] ?? []) {
            dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
        }
    }
    return dist.get(goal) ?? Infinity;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        graph?: WAdj;
        coords?: Coords;
        start?: string;
        goal?: string;
        epsilons?: number[];
        change?: [string, string, number];
    } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 1], ["C", 3]],
        B: [["D", 2], ["E", 5]],
        C: [["D", 1], ["E", 4]],
        D: [["F", 3]],
        E: [["F", 1]],
        F: [],
    };
    const coords: Coords = task.coords ?? {
        A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
    };
    const start = task.start ?? "A";
    const goal = task.goal ?? "F";
    const epsilons = (task.epsilons ?? [2.5, 1.5, 1]).slice().sort((a, b) => b - a);
    const change = task.change ?? ["D", "F", 8];
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((es) => es.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(wadj);
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    let step = 0;

    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    const paintPath = (path: string[]): void => {
        for (const v of path) {
            const n = byLabel.get(v);
            if (n) n.state = "path";
        }
        for (let i = 0; i + 1 < path.length; i += 1) {
            const e = edges.find(
                (x) => x.sourceId === `node-${path[i]}` && x.targetId === `node-${path[i + 1]}`,
            );
            if (e) e.state = "path";
        }
    };
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"],
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    clear();
    yield snap(
        `AD* starts at ${start} with ${epsilons.length} inflation levels; an edge-cost change will trigger replanning.`,
        0,
        { epsilon: epsilons[0] ?? 1, cost: -1, optimal: optimum(wadj, start, goal) },
    );
    step += 1;

    for (const epsilon of epsilons) {
        clear();
        yield snap(
            `Anytime pass with epsilon ${epsilon}: expand the smallest f = g + ${epsilon} times h.`,
            1,
            { epsilon, cost: -1, optimal: optimum(wadj, start, goal) },
        );
        step += 1;
        const result = inflatedAStar(wadj, coords, start, goal, epsilon);
        for (const v of result.visited.slice(0, 12)) {
            clear();
            const n = byLabel.get(v);
            if (n) n.state = "active";
            yield snap(
                `Expanding ${v} at epsilon ${epsilon}; f is g plus ${epsilon} times its straight-line estimate to ${goal}.`,
                2,
                { epsilon, expanded: v, cost: -1, optimal: optimum(wadj, start, goal) },
            );
            step += 1;
        }
        clear();
        paintPath(result.path);
        yield snap(
            `Pass epsilon ${epsilon} found ${result.path.join(" -> ") || "no path"} with cost ${result.cost}.`,
            3,
            { epsilon, cost: result.cost, optimal: optimum(wadj, start, goal), pathString: result.path.join("->") },
        );
        step += 1;
    }

    const [cu, cv, newWeight] = change;
    if (wadj[cu]) {
        for (const pair of wadj[cu]) if (pair[0] === cv) pair[1] = newWeight;
    }
    const eChange = edges.find(
        (x) =>
            (x.sourceId === `node-${cu}` && x.targetId === `node-${cv}`) ||
            (x.sourceId === `node-${cv}` && x.targetId === `node-${cu}`),
    );
    clear();
    if (eChange) eChange.state = "swapped";
    yield snap(
        `Cost update: edge ${cu}-${cv} now costs ${newWeight}. AD* flags the affected subtree for repair instead of starting over.`,
        5,
        { epsilon: 1, cost: -1, optimal: optimum(wadj, start, goal) },
    );
    step += 1;

    const repaired = inflatedAStar(wadj, coords, start, goal, 1);
    for (const v of repaired.visited.slice(0, 12)) {
        clear();
        const n = byLabel.get(v);
        if (n) n.state = "comparing";
        if (eChange) eChange.state = "swapped";
        yield snap(
            `Repair expands ${v}; only vertices whose g value depends on the changed edge need revisiting.`,
            6,
            { epsilon: 1, expanded: v, cost: -1, optimal: optimum(wadj, start, goal) },
        );
        step += 1;
    }
    clear();
    paintPath(repaired.path);
    const finalOptimal = optimum(wadj, start, goal);
    yield snap(
        `At epsilon 1 the repaired route ${repaired.path.join(" -> ")} costs ${repaired.cost}, optimal under the new costs.`,
        8,
        {
            epsilon: 1,
            cost: repaired.cost,
            optimal: finalOptimal,
            path: repaired.path,
            pathString: repaired.path.join("->"),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "AD* is an anytime dynamic planner. It returns a usable path quickly by searching with an inflated heuristic, then repeatedly lowers that inflation to improve the route. If an edge cost changes during execution, it repairs only the inconsistent part of its search tree and continues improving, so a moving agent always has a valid path.",
        invariants: [
            "At every epsilon the reported path cost is at least the true optimum.",
            "Lowering epsilon never increases the best path cost found so far.",
            "After a cost change, only vertices whose g values depend on the changed edge are inconsistent.",
        ],
        correctness:
            "With an admissible heuristic, an inflated-heuristic search returns a path within a bounded factor of optimal, and as epsilon reaches one the search becomes A* and returns an optimal path. Re-running the search after a cost change recomputes exact distances on the updated graph, so the final route is optimal under the new edge costs.",
        complexityRationale:
            "Each of the k epsilon levels and the replanning round performs an A* search costing O(E log V), giving O(k E log V) time; g values, parents, and the open set use O(V + E) space.",
        uses: [
            "Mobile robots navigating partially known terrain",
            "Real-time strategy games with dynamically changing maps",
            "Anytime planning where a valid answer is needed before an optimal one",
        ],
        references: [
            "Likhachev, Ferguson, and Stentz, Anytime Dynamic A*: An Anytime, Replanning Algorithm (2005)",
            "Koenig and Likhachev, D* Lite (2002)",
        ],
        workedExample:
            "From A the planner finds a rough route at epsilon 2.5, improves it at epsilon 1, then learns edge D-F jumped from 3 to 8. It repairs the affected subtree and returns a route that avoids D-F, matching a fresh Dijkstra on the updated graph.",
    },
    id: "ad-star",
    name: "AD* (Anytime Dynamic A*)",
    category: "shortest-path",
    complexity: { time: "O(k E log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["C", 3]],
            B: [["D", 2], ["E", 5]],
            C: [["D", 1], ["E", 4]],
            D: [["F", 3]],
            E: [["F", 1]],
            F: [],
        },
        coords: {
            A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
        },
        start: "A",
        goal: "F",
        epsilons: [2.5, 1.5, 1],
        change: ["D", "F", 8],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize g values and the open set at the start vertex",
        "search with inflated priority f = g + epsilon times h",
        "expand the open vertex with the smallest f value",
        "record the best path found and its cost, allowing reopenings",
        "lower epsilon and repeat the anytime passes",
        "on an edge-cost change, flag inconsistent vertices",
        "repair the affected subtree under the new costs",
        "continue until epsilon reaches one",
        "done: report the optimal path under current costs",
    ],
};

export default module;
