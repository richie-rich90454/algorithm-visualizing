/**
 * maximum-clique-branch-and-bound.ts - Maximum Clique (Branch and Bound)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A clique is a set of vertices that are all pairwise adjacent. Rather than
 * enumerate every maximal clique, this branch-and-bound algorithm grows one
 * clique at a time and uses a greedy vertex coloring of the remaining
 * candidates as an upper bound: a clique can take at most one vertex from each
 * color class, so if the current clique plus the number of colors cannot beat
 * the best found so far, the whole branch is pruned. This is the classical
 * Tomita-style MCQ maximum clique algorithm.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  exponential worst case, with strong pruning in practice
 *   Space: O(V) auxiliary for candidate sets, color classes, and recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes in the growing clique are green; candidates are yellow.
 *   - The vertex just added is active; pruned branches flash red.
 *   - Final frame paints the maximum clique green.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

type Neighbors = Map<string, Set<string>>;

function buildUndirected(graph: Record<string, string[]>): { labels: string[]; adj: Neighbors } {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const adj: Neighbors = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, list] of Object.entries(graph)) {
        if (!adj.has(u)) continue;
        for (const t of list) {
            if (u === t || !adj.has(t)) continue;
            adj.get(u)!.add(t);
            adj.get(t)!.add(u);
        }
    }
    return { labels, adj };
}

/** Greedy sequential coloring; returns vertices reordered by color plus each bound. */
function colorSort(candidates: string[], adj: Neighbors): { order: string[]; bounds: number[] } {
    const classes: string[][] = [];
    const assigned = new Map<string, number>();
    const degreeOrder = [...candidates].sort((a, b) => adj.get(b)!.size - adj.get(a)!.size);
    for (const v of degreeOrder) {
        let c = 0;
        while (c < classes.length && classes[c]!.some((u) => adj.get(v)!.has(u))) c += 1;
        if (!classes[c]) classes[c] = [];
        classes[c]!.push(v);
        assigned.set(v, c + 1);
    }
    const pairs = candidates.map((v) => ({ v, bound: assigned.get(v) as number }));
    pairs.sort((a, b) => a.bound - b.bound);
    return { order: pairs.map((p) => p.v), bounds: pairs.map((p) => p.bound) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["A", "B", "C", "E"],
        E: ["D", "F"],
        F: ["E"],
    };
    const { labels, adj } = buildUndirected(graph);
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(graph);
    let step = 0;
    let branches = 0;
    let prunes = 0;
    let best: string[] = [];

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        for (const n of nodes) n.state = states.get(String(n.value)) ?? "unvisited";
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                branches,
                prunes,
                bestSize: best.length,
                best: [...best],
                ...meta,
            },
        };
    };
    const statesFor = (clique: string[], candidates: string[], active?: string, pruned?: string): Map<string, EntityState> => {
        const s = new Map<string, EntityState>();
        for (const v of candidates) s.set(v, "comparing");
        for (const v of clique) s.set(v, "sorted");
        if (active) s.set(active, "active");
        if (pruned) s.set(pruned, "error");
        return s;
    };

    yield snap("Graph loaded; grow a clique and prune with a coloring bound.", 0, new Map(), { vertices: labels.length });
    step += 1;

    function* expand(clique: string[], candidates: string[]): Generator<VisualFrame, void, unknown> {
        branches += 1;
        const { order, bounds } = colorSort(candidates, adj);
        yield snap(
            `Branch ${branches}: clique {${clique.join(",")}}, ${order.length} candidate(s), coloring bound ${bounds[bounds.length - 1] ?? 0}.`,
            2,
            statesFor(clique, candidates),
            { clique: [...clique], candidates: [...order], bound: bounds[bounds.length - 1] ?? 0 },
        );
        step += 1;

        let pool = [...order];
        for (let i = order.length - 1; i >= 0; i -= 1) {
            if (clique.length + (bounds[i] as number) <= best.length) {
                prunes += 1;
                yield snap(
                    `Prune: ${clique.length} + bound ${bounds[i]} cannot exceed best size ${best.length}.`,
                    4,
                    statesFor(clique, pool, undefined, order[i]),
                    { prunedAt: order[i] },
                );
                step += 1;
                return;
            }
            const v = order[i] as string;
            const nextCandidates = pool.filter((u) => u !== v && adj.get(v)!.has(u));
            yield* expand([...clique, v], nextCandidates);
            pool = pool.filter((u) => u !== v);
        }
        if (pool.length === 0 && clique.length > best.length) {
            best = [...clique];
            yield snap(`New maximum clique of size ${best.length}: {${best.join(",")}}.`, 6, statesFor(best, []), { best: [...best] });
            step += 1;
        }
    }

    if (labels.length > 0) yield* expand([], labels);

    yield snap(
        `Done: maximum clique size ${best.length} with vertices {${best.join(",")}} after ${branches} branch(es).`,
        7,
        statesFor(best, []),
        { best: [...best], bestSize: best.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A clique is a group of vertices that are all directly connected. Growing a clique branch by branch is easy; the trick is knowing when to stop. Color the remaining candidate vertices so that no two vertices of the same color are adjacent. Since a clique can contain at most one vertex of each color, the number of colors is an upper bound on how much larger the clique could still get. If even that bound cannot beat the best clique already found, skip the branch entirely.",
        invariants: [
            "Every vertex in the growing clique is adjacent to every other vertex in it.",
            "Candidates at each branch are adjacent to all clique members and remain unprocessed.",
            "The greedy coloring number is a valid upper bound on any clique inside the candidate set.",
        ],
        correctness:
            "Coloring assigns different colors to adjacent candidates, so any clique uses at most one vertex per color and its size is at most the number of colors. If the current clique size plus that bound does not exceed the best known size, no completion of the branch can improve the answer, so pruning is safe. Otherwise the algorithm branches over every remaining candidate intersecting its neighbor set, which enumerates all maximal cliques in decreasing color order without duplication. Whenever a clique cannot be extended, it is compared with the best, so the largest clique is retained at termination.",
        complexityRationale:
            "Worst-case running time is exponential because maximum clique is NP-hard. Each branch performs a greedy coloring of the candidates, O(V+E), and the coloring bound sharply reduces the number of branches on sparse and structured graphs. Auxiliary space is O(V) for candidate lists, color classes, and the recursion stack.",
        uses: [
            "Finding the largest fully connected group in social or collaboration networks",
            "Clique-based bounds in graph coloring and scheduling",
            "Motif detection in protein interaction networks",
        ],
        references: [
            "Tomita, Tanaka and Takahashi, The Worst-Case Time Complexity for Generating All Maximal Cliques, 2006",
            "Carraghan and Pardalos, An Exact Algorithm for the Maximum Clique Problem, 1990",
        ],
        workedExample:
            "In a graph where A, B, C and D form a four-clique and E attaches only to D and F, the coloring of the six candidates produces at most six classes. Branching into A, B, C and D grows a clique of size four; branches that try to add E are pruned once the bound shows they cannot reach five. The reported maximum clique is A, B, C, D.",
    },
    id: "maximum-clique-branch-and-bound",
    name: "Maximum Clique (Branch and Bound)",
    category: "graph",
    complexity: { time: "exponential, pruned", space: "O(V)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["A", "B", "C", "E"],
            E: ["D", "F"],
            F: ["E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected graph and set best clique to empty",
        "color the candidate vertices greedily to get upper bounds",
        "visit candidates from last to first in color order",
        "if clique size plus the bound cannot beat best, prune",
        "add the chosen vertex to the growing clique",
        "recurse on candidates adjacent to the chosen vertex",
        "when no extension remains, update the best clique",
        "done: report the maximum clique",
    ],
};

export default module;
