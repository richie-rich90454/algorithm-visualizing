/**
 * adaptive-a-star.ts - Adaptive A*
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adaptive A* is an incremental heuristic search method for repeated searches
 * that share a goal. After each search it replaces the heuristic value of every
 * expanded node with g(goal) minus g(node). That value is exact for nodes on the
 * found path and admissible for all others, so the next search toward the same
 * goal expands fewer nodes while still returning an optimal path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * (V + E) log V) for S searches with an array-based open list
 *   Space: O(V + E) for the graph, g values, and the shared heuristic table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Graph vertices are circles with weighted directed edges.
 *   - The node being expanded is ACTIVE, open nodes are COMPARING, and closed
 *     nodes are VISITED; after the heuristic update expanded nodes turn GREEN.
 *   - The final frame reports each search's optimal cost and the learned h.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

type SearchRecord = {
    start: string;
    pathCost: number;
    updated: Record<string, number>;
    g: Record<string, number>;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { graph?: WAdj; coords?: Coords; start?: string; goal?: string; searches?: string[] } | null
    ) ?? {};
    const graph: WAdj = task.graph ?? {
        A: [["B", 1], ["C", 4]],
        B: [["A", 1], ["D", 5], ["E", 2]],
        C: [["A", 4], ["E", 1]],
        D: [["B", 5], ["F", 1]],
        E: [["B", 2], ["C", 1], ["F", 3]],
        F: [["D", 1], ["E", 3]],
    };
    const labelsSet = new Set<string>(Object.keys(graph));
    for (const pairs of Object.values(graph)) for (const [v] of pairs) labelsSet.add(v);
    const labels = [...labelsSet].sort();
    const goal = task.goal ?? "F";
    const first = task.start ?? "A";
    const starts = Array.isArray(task.searches) && task.searches.length > 0
        ? task.searches.filter((s) => labels.includes(s))
        : [first];

    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(graph);
    const makeEntities = (states: Map<string, EntityState>): VisualEntity[] =>
        nodes.map((n) => ({ ...n, state: states.get(String(n.value)) ?? "unvisited" }));

    // Scale straight-line distance so the initial heuristic never overestimates.
    const coords = task.coords;
    let scale = 0;
    if (coords) {
        let best = Infinity;
        for (const [u, pairs] of Object.entries(graph)) {
            const cu = coords[u];
            if (!cu) continue;
            for (const [v, cost] of pairs) {
                const cv = coords[v];
                if (!cv) continue;
                const d = Math.hypot(cu[0] - cv[0], cu[1] - cv[1]);
                if (d > 0) best = Math.min(best, cost / d);
            }
        }
        scale = Number.isFinite(best) ? best : 0;
    }
    const initialH = (v: string): number => {
        const c = coords?.[v];
        const g = coords?.[goal];
        if (!c || !g) return 0;
        return scale * Math.hypot(c[0] - g[0], c[1] - g[1]);
    };
    const h: Record<string, number> = {};
    for (const v of labels) h[v] = initialH(v);

    const records: SearchRecord[] = [];
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        extra: Record<string, number | string | boolean | Record<string, number> | SearchRecord[]> = {},
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeEntities(states),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta: { ...extra },
    });

    if (labels.length === 0) {
        yield snap("Empty graph – no search can be run.", 0, new Map());
        return;
    }

    for (let si = 0; si < starts.length; si += 1) {
        const start = starts[si] as string;
        const g: Record<string, number> = {};
        for (const v of labels) g[v] = Infinity;
        g[start] = 0;
        const cameFrom: Record<string, string> = {};
        const closed = new Set<string>();
        const open = new Set<string>([start]);
        let expanded = 0;

        yield snap(
            `Search ${si + 1} of ${starts.length}: A* from ${start} to ${goal} with the current heuristic.`,
            1,
            new Map<string, EntityState>([[start, "comparing"]]),
            { searchIndex: si, start, goal, expanded: 0, h: { ...h } },
        );

        while (open.size > 0) {
            let current: string | null = null;
            let bestF = Infinity;
            let bestG = Infinity;
            for (const v of open) {
                const f = (g[v] ?? Infinity) + (h[v] ?? 0);
                if (f < bestF - 1e-12 || (Math.abs(f - bestF) <= 1e-12 && (g[v] ?? Infinity) < bestG)) {
                    bestF = f;
                    bestG = g[v] ?? Infinity;
                    current = v;
                }
            }
            if (current === null) break;
            open.delete(current);
            if (closed.has(current)) continue;
            closed.add(current);
            expanded += 1;

            const states = new Map<string, EntityState>();
            for (const v of closed) states.set(v, "visited");
            for (const v of open) states.set(v, "comparing");
            states.set(current, "active");
            yield snap(
                `Expand ${current}: g=${(g[current] ?? 0).toFixed(1)}, f=${(bestF).toFixed(1)}.`,
                3,
                states,
                { searchIndex: si, start, goal, expanded, h: { ...h } },
            );

            if (current === goal) break;
            for (const [v, cost] of graph[current] ?? []) {
                if (!labels.includes(v)) continue;
                const next = (g[current] ?? 0) + cost;
                if (next < (g[v] ?? Infinity)) {
                    g[v] = next;
                    cameFrom[v] = current;
                    if (closed.has(v)) closed.delete(v);
                    open.add(v);
                }
            }
        }

        const pathCost = g[goal] ?? Infinity;
        const updated: Record<string, number> = {};
        const gAtClose: Record<string, number> = {};
        if (Number.isFinite(pathCost)) {
            for (const v of closed) {
                const newH = Math.max(0, pathCost - (g[v] ?? 0));
                h[v] = newH;
                updated[v] = newH;
                gAtClose[v] = g[v] ?? 0;
            }
        }
        records.push({ start, pathCost, updated, g: gAtClose });

        const learnedStates = new Map<string, EntityState>();
        for (const v of closed) learnedStates.set(v, "sorted");
        yield snap(
            `Update h for ${closed.size} expanded node(s) using g(goal) minus g(v).`,
            5,
            learnedStates,
            { searchIndex: si, start, goal, pathCost, expanded, h: { ...h } },
        );
    }

    // Reconstruct the last search's path with a fresh run so the final frame can color it.
    const pathStates = new Map<string, EntityState>();
    const lastStart = starts[starts.length - 1] as string;
    const parents: Record<string, string> = {};
    const g: Record<string, number> = {};
    for (const v of labels) g[v] = Infinity;
    g[lastStart] = 0;
    const open = new Set<string>([lastStart]);
    const closed = new Set<string>();
    while (open.size > 0) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of open) if ((g[v] ?? Infinity) < best) { best = g[v] as number; u = v; }
        if (u === null) break;
        open.delete(u);
        if (closed.has(u)) continue;
        closed.add(u);
        if (u === goal) break;
        for (const [v, cost] of graph[u] ?? []) {
            const next = (g[u] ?? 0) + cost;
            if (next < (g[v] ?? Infinity)) { g[v] = next; parents[v] = u; open.add(v); }
        }
    }
    pathStates.clear();
    let cursor = goal;
    const seen = new Set<string>();
    while (labels.includes(cursor) && !seen.has(cursor)) {
        seen.add(cursor);
        pathStates.set(cursor, "path");
        const parent = parents[cursor];
        if (!parent) break;
        cursor = parent;
    }

    yield snap(
        `Finished ${records.length} search(es); path costs ${records.map((r) => Number.isFinite(r.pathCost) ? r.pathCost.toFixed(1) : "unreachable").join(", ")}.`,
        7,
        pathStates,
        { searches: records, h: { ...h }, goal, totalSearches: records.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When many searches share one goal, the work done by an earlier search is useful later. Adaptive A* runs ordinary A* once, then rewrites each expanded node's estimate to the exact remaining cost measured along the path it just found. Those sharper estimates guide the next search with far fewer expansions while never hiding the optimal route.",
        invariants: [
            "Each search returns a shortest path under the current heuristic.",
            "For every expanded node, the updated h equals g(goal) minus g(node).",
            "The updated heuristic stays admissible because g(node) plus the true remaining cost is at least g(goal).",
        ],
        correctness:
            "A* with an admissible heuristic and reopening computes exact g values for all nodes it expands. For an expanded node v, the path start to v to goal costs g(v) plus the true distance from v to goal and is a valid start-to-goal route, so it cannot beat the optimal cost g(goal); hence g(goal) minus g(v) never exceeds the true remaining distance and is admissible. Reusing it keeps A* optimal, and nodes on the chosen optimal path receive the exact remaining cost.",
        complexityRationale:
            "Each search expands at most every vertex and relaxes every edge once per reopening; with an array scan for the minimum f value this is O((V + E) log V) per search or O(S (V + E) log V) for S searches. The graph, g values, and one shared heuristic table occupy O(V + E) space.",
        uses: [
            "Repeated route queries toward a fixed destination in maps and games",
            "Incremental pathfinding as a robot moves through a known environment",
            "Teaching the link between admissible heuristics and search efficiency",
        ],
        references: [
            "Koenig and Likhachev, Incremental A*, Advances in Neural Information Processing Systems 15, 2002",
            "Koenig and Likhachev, A Adaptive A*, Proceedings of the International Joint Conference on Autonomous Agents and Multiagent Systems, 2006",
        ],
        workedExample:
            "A first A* search from A to F expands A, B, C, and E and finds cost six. It sets h(B) to six minus g(B), h(C) to six minus g(C), and so on. A second search from C now uses an almost exact h and heads toward F with only a couple of expansions, still returning the same optimal cost.",
    },
    id: "adaptive-a-star",
    name: "Adaptive A*",
    category: "shortest-path",
    complexity: { time: "O(S * (V + E) log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["C", 4]],
            B: [["A", 1], ["D", 5], ["E", 2]],
            C: [["A", 4], ["E", 1]],
            D: [["B", 5], ["F", 1]],
            E: [["B", 2], ["C", 1], ["F", 3]],
            F: [["D", 1], ["E", 3]],
        },
        coords: { A: [0, 0], B: [1, 0], C: [0, 1], D: [2, 0], E: [1, 1], F: [2, 1] },
        start: "A",
        goal: "F",
        searches: ["A", "C", "B"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize every heuristic h(v) from scaled straight-line distance",
        "for each start in the requested search sequence",
        "set g(start) to zero and place it on the open list",
        "pop the open node of smallest f equal to g plus h",
        "relax outgoing edges and reopen a closed node when g improves",
        "on reaching the goal set h(v) to g(goal) minus g(v) for expanded nodes",
        "reconstruct and record the optimal path for this search",
        "report every path cost and the learned heuristic table",
    ],
};

export default module;
