/**
 * bidirectional-a-star.ts - Bidirectional A* Search.
 *
 * Runs two heuristic-guided searches at once: one forward from the start and
 * one backward from the goal. Each side keeps its own frontier ordered by
 * f = g + h, and the side with the smaller minimum f is expanded. When the two
 * searches meet, their g values combine into a complete path; the loop stops
 * once the two minimum f values can no longer improve that path.
 *
 * Time:  O(E log V) worst case, often O(b^(d/2)) nodes expanded
 * Space: O(V)
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

interface Result {
    path: string[];
    cost: number;
    forward: string[];
    backward: string[];
}

function neighbors(wadj: WAdj, v: string): Array<[string, number]> {
    const out: Array<[string, number]> = [...(wadj[v] ?? [])];
    for (const [source, adj] of Object.entries(wadj)) {
        if (source === v) continue;
        for (const [target, weight] of adj) if (target === v) out.push([source, weight]);
    }
    return out;
}

function search(wadj: WAdj, coords: Coords, start: string, goal: string): Result {
    const heur = (v: string, t: string): number => {
        const a = coords[v];
        const b = coords[t];
        if (!a || !b) return 0;
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const gF = new Map<string, number>([[start, 0]]);
    const gB = new Map<string, number>([[goal, 0]]);
    const parentF = new Map<string, string>();
    const parentB = new Map<string, string>();
    const openF = new Set<string>([start]);
    const openB = new Set<string>([goal]);
    const closedF = new Set<string>();
    const closedB = new Set<string>();
    const forward: string[] = [];
    const backward: string[] = [];
    const bestF = (): number => {
        let best = Infinity;
        for (const v of openF) best = Math.min(best, (gF.get(v) ?? Infinity) + heur(v, goal));
        return best;
    };
    const bestB = (): number => {
        let best = Infinity;
        for (const v of openB) best = Math.min(best, (gB.get(v) ?? Infinity) + heur(v, start));
        return best;
    };
    let bestCost = Infinity;
    let meet: string | undefined;

    for (let guard = 0; guard < 1000 && (openF.size > 0 || openB.size > 0); guard += 1) {
        if (bestF() + bestB() >= bestCost) break;
        const useForward = bestF() <= bestB();
        const open = useForward ? openF : openB;
        const g = useForward ? gF : gB;
        const closed = useForward ? closedF : closedB;
        const parent = useForward ? parentF : parentB;
        let u: string | undefined;
        let min = Infinity;
        for (const v of open) {
            const priority = (g.get(v) ?? Infinity) + (useForward ? heur(v, goal) : heur(v, start));
            if (priority < min) [u, min] = [v, priority];
        }
        if (u === undefined) break;
        open.delete(u);
        closed.add(u);
        if (useForward) forward.push(u);
        else backward.push(u);
        if (g.has(u) && (useForward ? gB.has(u) : gF.has(u))) {
            const cost = (gF.get(u) ?? Infinity) + (gB.get(u) ?? Infinity);
            if (cost < bestCost) [bestCost, meet] = [cost, u];
        }
        for (const [next, weight] of neighbors(wadj, u)) {
            if (closed.has(next)) continue;
            const candidate = (g.get(u) as number) + weight;
            if (candidate < (g.get(next) ?? Infinity)) {
                g.set(next, candidate);
                parent.set(next, u);
                open.add(next);
                const otherG = useForward ? gB : gF;
                if (otherG.has(next)) {
                    const cost = (gF.get(next) ?? Infinity) + (gB.get(next) ?? Infinity);
                    if (cost < bestCost) [bestCost, meet] = [cost, next];
                }
            }
        }
    }
    if (meet === undefined) return { path: [], cost: Infinity, forward, backward };
    const first: string[] = [];
    let cursor: string | undefined = meet;
    while (cursor !== undefined) {
        first.unshift(cursor);
        cursor = parentF.get(cursor);
    }
    const second: string[] = [];
    cursor = parentB.get(meet);
    while (cursor !== undefined) {
        second.push(cursor);
        cursor = parentB.get(cursor);
    }
    return { path: [...first, ...second], cost: bestCost, forward, backward };
}

function dijkstra(wadj: WAdj, start: string, goal: string): number {
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
    const task = (input as { graph?: WAdj; coords?: Coords; start?: string; goal?: string } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 1], ["D", 4]],
        B: [["C", 1], ["E", 4]],
        C: [["F", 2]],
        D: [["E", 1]],
        E: [["F", 1]],
        F: [],
    };
    const coords: Coords = task.coords ?? {
        A: [0, 0], B: [1, 0], C: [2, 0], D: [0, 1], E: [1, 1], F: [2, 1],
    };
    const start = task.start ?? "A";
    const goal = task.goal ?? "F";
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
    const snap = (description: string, codeLineNumber: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    const result = search(wadj, coords, start, goal);
    clear();
    yield snap(
        `Bidirectional A* from ${start} and ${goal}; both frontiers are ordered by f = g + h.`,
        0,
        { cost: -1, optimal: dijkstra(wadj, start, goal) },
    );
    step += 1;
    for (let i = 0; i < Math.max(result.forward.length, result.backward.length); i += 1) {
        clear();
        const f = result.forward[i];
        const b = result.backward[i];
        if (f) {
            const n = byLabel.get(f);
            if (n) n.state = "active";
        }
        if (b) {
            const n = byLabel.get(b);
            if (n) n.state = "comparing";
        }
        const parts: string[] = [];
        if (f) parts.push(`forward expanded ${f}`);
        if (b) parts.push(`backward expanded ${b}`);
        yield snap(
            `Step ${i + 1}: ${parts.join(" and ")}; the side with the smaller minimum f is expanded next.`,
            1,
            { cost: -1, optimal: dijkstra(wadj, start, goal) },
        );
        step += 1;
    }
    clear();
    for (const v of result.path) {
        const n = byLabel.get(v);
        if (n) n.state = "path";
    }
    for (let i = 0; i + 1 < result.path.length; i += 1) {
        const e = edges.find(
            (x) =>
                (x.sourceId === `node-${result.path[i]}` && x.targetId === `node-${result.path[i + 1]}`) ||
                (x.sourceId === `node-${result.path[i + 1]}` && x.targetId === `node-${result.path[i]}`),
        );
        if (e) e.state = "path";
    }
    yield snap(
        `Frontiers met at ${result.path[Math.floor(result.path.length / 2)] ?? "?"}: path ${result.path.join(" -> ")} costs ${result.cost}.`,
        4,
        {
            cost: result.cost,
            optimal: dijkstra(wadj, start, goal),
            path: result.path,
            forwardExpanded: result.forward.length,
            backwardExpanded: result.backward.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of growing one search from the start all the way to the goal, bidirectional A* grows two smaller searches from both ends. Each uses an admissible heuristic toward its own target, and whenever the two frontiers meet their accumulated costs add up to a full route. The stop condition guarantees no cheaper route can still be found.",
        invariants: [
            "Each frontier orders its open vertices by f = g + h.",
            "A vertex's g value is always the best cost found from that side's origin.",
            "Once the two minimum f values sum to at least the best meeting cost, no better route exists.",
        ],
        correctness:
            "For consistent heuristics, A* expands vertices in nondecreasing f order. The sum of the two frontiers' minimum f values is a lower bound on any not-yet-discovered route, so when that bound reaches the best meeting cost the combined path is optimal. Combining the two g values at a meeting vertex yields that route's exact cost.",
        complexityRationale:
            "Each side expands at most O(V) vertices and relaxes O(E) edges with logarithmic frontier operations, giving O(E log V) time and O(V) space, though in practice only about half the search depth is explored.",
        uses: [
            "Point-to-point routing on road networks",
            "Pathfinding in game maps with a known goal",
            "Reducing search depth on large state graphs",
        ],
        references: [
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths (1968)",
            "Pohl, Bidirectional Search (1971)",
        ],
        workedExample:
            "On a six-node grid, the forward search leaves A while the backward search leaves F. After a few expansions from each side they meet at E: the forward g of 2 plus the backward g of 1 gives a route of cost 3, and the f bound confirms nothing cheaper remains.",
    },
    id: "bidirectional-a-star",
    name: "Bidirectional A*",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["D", 4]],
            B: [["C", 1], ["E", 4]],
            C: [["F", 2]],
            D: [["E", 1]],
            E: [["F", 1]],
            F: [],
        },
        coords: {
            A: [0, 0], B: [1, 0], C: [2, 0], D: [0, 1], E: [1, 1], F: [2, 1],
        },
        start: "A",
        goal: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize forward frontier at start and backward frontier at goal",
        "compute minimum f on each frontier using its own heuristic",
        "expand the frontier with the smaller minimum f",
        "relax neighbors and update that side's g values",
        "if a vertex is reached from both sides, update the best meeting cost",
        "stop when the sum of both minimum f values reaches the best cost",
        "splice the two predecessor chains at the meeting vertex",
        "done: report the combined path and its cost",
    ],
};

export default module;
