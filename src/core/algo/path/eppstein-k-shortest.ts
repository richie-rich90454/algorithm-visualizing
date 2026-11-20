/**
 * eppstein-k-shortest.ts - Eppstein's K Shortest Paths
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lists the k cheapest paths from a source to a target in increasing cost
 * order. Instead of rerunning Dijkstra for every candidate (Yen), it builds a
 * single shortest-path tree once. Dijkstra distances d(v) assign every edge
 * (u, v) a nonnegative detour d(u) + w - d(v), and any path's length telescopes
 * to d(target) plus the sum of its edge detours. Expanding simple paths
 * best-first by that sum yields the k shortest paths in cost order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V + k * E) with a scanning heap for the demo
 *   Space: O(V + E + k) for the tree, sidetracks, and accepted paths
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The shortest-path tree edges are CYAN (path).
 *   - Non-tree sidetrack edges are YELLOW (comparing).
 *   - Each accepted path lights up its edges in order, with cost in `meta`.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type Adjacency = Record<string, Array<[string, number]>>;

interface Sidetrack {
    from: string;
    via: string;
    to: string;
    weight: number;
    extra: number;
    index: number;
}

export interface PathResult {
    cost: number;
    vertices: string[];
}

/** Single-source Dijkstra with deterministic label-order tie breaking. */
function dijkstra(
    graph: Adjacency,
    start: string,
    vertices: string[],
): { dist: Record<string, number>; parent: Record<string, string | null> } {
    const dist: Record<string, number> = Object.create(null) as Record<string, number>;
    const parent: Record<string, string | null> = Object.create(null) as Record<
        string,
        string | null
    >;
    for (const v of vertices) {
        dist[v] = Infinity;
        parent[v] = null;
    }
    if (dist[start] === undefined) {
        dist[start] = Infinity;
        parent[start] = null;
        vertices.push(start);
    }
    dist[start] = 0;
    const done = new Set<string>();
    for (;;) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of vertices) {
            if (!done.has(v) && (dist[v] ?? Infinity) < best) {
                best = dist[v] ?? Infinity;
                u = v;
            }
        }
        if (u === null) break;
        done.add(u);
        for (const [v, w] of graph[u] ?? []) {
            if (dist[v] === undefined) {
                dist[v] = Infinity;
                parent[v] = null;
                vertices.push(v);
            }
            const candidate = (dist[u] ?? Infinity) + w;
            if (candidate < (dist[v] ?? Infinity)) {
                dist[v] = candidate;
                parent[v] = u;
            }
        }
    }
    return { dist, parent };
}

/** Turn every non-tree edge into a sidetrack with its nonnegative extra cost. */
function buildSidetracks(
    graph: Adjacency,
    start: string,
    dist: Record<string, number>,
    parent: Record<string, string | null>,
    vertices: string[],
): Sidetrack[] {
    const result: Sidetrack[] = [];
    for (const u of [...vertices].sort()) {
        const edges = [...(graph[u] ?? [])].sort(
            (a, b) => a[0].localeCompare(b[0]) || a[1] - b[1],
        );
        for (const [v, w] of edges) {
            if ((dist[u] ?? Infinity) === Infinity || (dist[v] ?? Infinity) === Infinity) {
                continue;
            }
            if ((parent[v] ?? null) === u) continue;
            let extra = (dist[u] ?? Infinity) + w - (dist[v] ?? Infinity);
            if (extra < 0 && extra > -1e-9) extra = 0;
            if (extra < -1e-9) continue;
            result.push({
                from: u === start ? start : (parent[u] ?? start),
                via: u,
                to: v,
                weight: w,
                extra,
                index: result.length,
            });
        }
    }
    return result;
}

interface SearchNode {
    detour: number;
    walk: string[];
    current: string;
}

/**
 * The verified core: k cheapest loopless s-to-t paths using Eppstein's detour
 * potential. Dijkstra gives d(v); every edge (u,v) has detour d(u)+w-d(v) >= 0,
 * and a path's length telescopes to d(target) plus the sum of its detours.
 * Expanding paths best-first by that sum therefore yields them in cost order.
 */
export function eppsteinKShortest(
    graph: Adjacency,
    start: string,
    target: string,
    k: number,
): PathResult[] {
    const vertexSet = new Set<string>(Object.keys(graph));
    for (const list of Object.values(graph)) for (const [v] of list) vertexSet.add(v);
    vertexSet.add(start);
    vertexSet.add(target);
    const { dist } = dijkstra(graph, start, [...vertexSet]);
    if ((dist[target] ?? Infinity) === Infinity) return [];

    const heap: SearchNode[] = [];
    const less = (a: SearchNode, b: SearchNode): boolean => {
        if (Math.abs(a.detour - b.detour) > 1e-12) return a.detour < b.detour;
        return a.walk.join(">") < b.walk.join(">");
    };
    const push = (node: SearchNode): void => {
        heap.push(node);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            const cur = heap[i] as SearchNode;
            const par = heap[p] as SearchNode;
            if (!less(cur, par)) break;
            heap[i] = par;
            heap[p] = cur;
            i = p;
        }
    };
    const pop = (): SearchNode | undefined => {
        if (heap.length === 0) return undefined;
        const top = heap[0] as SearchNode;
        const last = heap.pop() as SearchNode;
        if (heap.length > 0) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let s = i;
                if (l < heap.length && less(heap[l] as SearchNode, heap[s] as SearchNode)) s = l;
                if (r < heap.length && less(heap[r] as SearchNode, heap[s] as SearchNode)) s = r;
                if (s === i) break;
                const cur = heap[i] as SearchNode;
                const child = heap[s] as SearchNode;
                heap[i] = child;
                heap[s] = cur;
                i = s;
            }
        }
        return top;
    };

    push({ detour: 0, walk: [start], current: start });
    const pushedKeys = new Set<string>([start]);
    const results: PathResult[] = [];
    let guard = 0;
    const maxIterations = 200000;

    while (heap.length > 0 && results.length < k && guard++ < maxIterations) {
        const node = pop() as SearchNode;
        if (node.current === target) {
            results.push({
                cost: (dist[target] ?? Infinity) + node.detour,
                vertices: node.walk,
            });
            continue;
        }
        for (const [next, weight] of graph[node.current] ?? []) {
            if (node.walk.includes(next)) continue;
            const candidate = [...node.walk, next];
            const key = candidate.join(">");
            if (pushedKeys.has(key)) continue;
            pushedKeys.add(key);
            let delta = weight - ((dist[next] ?? Infinity) - (dist[node.current] ?? Infinity));
            if (delta < 0 && delta > -1e-9) delta = 0;
            push({
                detour: node.detour + delta,
                walk: candidate,
                current: next,
            });
        }
    }
    return results;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        graph?: Adjacency;
        start?: string;
        target?: string;
        k?: number;
    } | null) ?? {};
    const graph: Adjacency = task.graph ?? {
        A: [
            ["B", 1],
            ["C", 2],
            ["D", 5],
        ],
        B: [
            ["D", 4],
            ["E", 6],
        ],
        C: [
            ["D", 2],
            ["E", 3],
        ],
        D: [["E", 1]],
        E: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((list) => list.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeWeightedEdges(graph);
    const byNode = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, state: EntityState): void => {
        const n = byNode.get(`node-${v}`);
        if (n) n.state = state;
    };
    const setE = (a: string, b: string, state: EntityState): void => {
        const e = edges.find(
            (x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`,
        );
        if (e) e.state = state;
    };
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });

    const start = task.start && graph[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? labels[labels.length - 1] ?? start;
    const k = typeof task.k === "number" && task.k > 0 ? Math.floor(task.k) : 3;

    if (labels.length === 0) {
        yield snap("Empty graph - nothing to route between.", 0);
        return;
    }

    yield snap(
        `Eppstein: find ${k} shortest paths from ${start} to ${target} by detours off one shortest-path tree.`,
        0,
        { k, start, target },
    );
    step += 1;

    const vertexSet = new Set<string>(Object.keys(graph));
    for (const list of Object.values(graph)) for (const [v] of list) vertexSet.add(v);
    vertexSet.add(start);
    vertexSet.add(target);
    const { dist, parent } = dijkstra(graph, start, [...vertexSet]);

    clear();
    for (const v of labels) {
        const p = parent[v] ?? null;
        if (p !== null) {
            setN(v, "visited");
            setE(p, v, "path");
        }
    }
    setN(start, "path");
    const sidetracks = buildSidetracks(graph, start, dist, parent, [...vertexSet]);
    yield snap(
        `Dijkstra built one shortest-path tree; d(${target}) = ${dist[target] ?? Infinity}. Tree edges are highlighted.`,
        1,
        { treeReached: [...vertexSet].filter((v) => (dist[v] ?? Infinity) < Infinity).length },
    );
    step += 1;

    clear();
    for (const st of sidetracks) setE(st.via, st.to, "comparing");
    for (const v of labels) setN(v, "visited");
    yield snap(
        `${sidetracks.length} non-tree edge(s) become sidetracks with extra cost d(u) + w - d(v) >= 0.`,
        2,
        { sidetracks: sidetracks.length },
    );
    step += 1;

    const results = eppsteinKShortest(graph, start, target, k);
    if (results.length === 0) {
        yield snap(`${target} is unreachable from ${start}; no paths exist.`, 6, {
            paths: 0,
            costs: [] as number[],
        });
        return;
    }

    const costs: number[] = [];
    const pathStrings: string[] = [];
    for (let i = 0; i < results.length; i += 1) {
        const result = results[i] as PathResult;
        clear();
        for (const v of result.vertices) setN(v, "path");
        for (let j = 0; j + 1 < result.vertices.length; j += 1) {
            setE(result.vertices[j] as string, result.vertices[j + 1] as string, "path");
        }
        costs.push(result.cost);
        pathStrings.push(result.vertices.join(" -> "));
        yield snap(
            `Path ${i + 1}: ${result.vertices.join(" -> ")} with cost ${result.cost}, the cheapest unexplored detour combination.`,
            i === 0 ? 4 : 5,
            {
                paths: costs.length,
                costs: [...costs],
                distance: result.cost,
                path: result.vertices.join("->"),
            },
        );
        step += 1;
    }

    clear();
    for (const v of (results[0] as PathResult).vertices) setN(v, "path");
    yield snap(
        `${results.length} shortest path(s) from ${start} to ${target}: costs ${costs.join(", ")}.`,
        6,
        {
            paths: results.length,
            costs,
            pathsFound: pathStrings,
            distance: (results[0] as PathResult).cost,
            path: (results[0] as PathResult).vertices.join("->"),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Eppstein's algorithm pays for one shortest-path search and reuses it. Dijkstra gives the true distance d(v) of every vertex from the source, which turns each edge (u,v) into a nonnegative detour d(u) + w - d(v): how much farther that edge leaves you from the optimum. Because a whole path's length is just d(target) plus the sum of its detours, expanding simple paths cheapest-detour-first produces the k shortest paths without a fresh search for every candidate.",
        invariants: [
            "The distance labels d(v) are true shortest distances from the source.",
            "Every edge has detour d(u) + w(u,v) - d(v), which is never negative.",
            "A path's full length equals d(target) plus the sum of the detours of its edges.",
            "Accepted paths appear in nondecreasing cost order and never repeat a vertex.",
        ],
        correctness:
            "For an edge (u,v) the detour is d(u) + w(u,v) - d(v), which is nonnegative because d(v) is a shortest distance. Summing this identity along any source-to-target path telescopes: the d(.) terms cancel and the path length equals d(target) plus the sum of its edge detours. Best-first expansion orders path prefixes by that accumulated detour, which never decreases as detours are nonnegative, so paths emerge in increasing length. Rejecting paths that revisit a vertex leaves the simple paths, and the first k accepted are the k cheapest simple source-to-target paths.",
        complexityRationale:
            "Dijkstra builds the tree and sidetrack list in O(E log V) time and O(V + E) space. Eppstein's indexed binary heaps then extract each successive path in amortized O(log k) time, for O(E log V + k log k) total. The classroom version uses one simpler scanning heap, so it does more work per extracted path but reports the same ordered results and still runs quickly for small demonstrations.",
        uses: [
            "Alternative-route suggestions in turn-by-turn navigation",
            "Backup paths and link diversity in communication networks",
            "Generating ranked itineraries and logistics options",
            "Seeding candidate sets for constrained path optimization",
        ],
        references: [
            "Eppstein, Finding the k Shortest Paths, SIAM Journal on Computing, 1998",
            "Yen, Finding the K Shortest Loopless Paths in a Network, Management Science, 1971",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, 3rd edition",
        ],
        workedExample:
            "On the default graph A-B(1), A-C(2), A-D(5), B-D(4), B-E(6), C-D(2), C-E(3), D-E(1), Dijkstra gives d(E) = 5. The tree route A-C-E costs 5. Detouring across D gives A-C-D-E, also cost 5, and the route through B and D gives A-B-D-E at cost 6, so k=3 returns the ordered costs 5, 5, 6.",
    },
    id: "eppstein-k-shortest",
    name: "Eppstein's K Shortest Paths",
    category: "shortest-path",
    complexity: { time: "O(E log V + k * E)", space: "O(V + E + k)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["C", 2],
                ["D", 5],
            ],
            B: [
                ["D", 4],
                ["E", 6],
            ],
            C: [
                ["D", 2],
                ["E", 3],
            ],
            D: [["E", 1]],
            E: [],
        },
        start: "A",
        target: "E",
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "run Dijkstra from the source to get the distance d(v) of every vertex",
        "give each edge (u,v) the nonnegative detour d(u)+w(u,v)-d(v)",
        "put the empty path at the source with detour zero in a min-heap",
        "pop the path with the smallest accumulated detour",
        "if that path ends at the target, accept it as the next shortest path",
        "otherwise append each edge to an unused neighbor, adding its detour",
        "discard paths that revisit a vertex and stop after k accepted paths",
    ],
};

export default module;
