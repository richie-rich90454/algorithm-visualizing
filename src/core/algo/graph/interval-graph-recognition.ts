/**
 * interval-graph-recognition.ts - Interval Graph Recognition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An interval graph is the intersection graph of intervals on a line. This
 * module decides whether a given graph is an interval graph using the
 * characterization "chordal and asteroidal-triple-free". It builds an
 * undirected graph, computes a maximum-cardinality-search elimination order,
 * checks that the order is perfect (which is equivalent to chordality), then
 * tests every independent triple for the asteroidal-triple property by
 * reachability in a subgraph. When the verdict is positive it also lays out
 * candidate intervals from the maximal cliques.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3 + V*E) in this straightforward implementation
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes in the current elimination order turn green; probe nodes yellow.
 *   - Edges of a tested path light up; a violating triple turns red.
 *   - Final node states are green when accepted, red when rejected.
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

function maximumCardinalityOrder(labels: string[], adj: Neighbors): string[] {
    const numbered = new Set<string>();
    const order: string[] = [];
    while (numbered.size < labels.length) {
        let best = "";
        let bestCount = -1;
        for (const v of labels) {
            if (numbered.has(v)) continue;
            let count = 0;
            for (const u of adj.get(v)!) if (numbered.has(u)) count += 1;
            if (count > bestCount) {
                bestCount = count;
                best = v;
            }
        }
        if (best === "") break;
        order.push(best);
        numbered.add(best);
    }
    return order;
}

function isPerfectOrder(order: string[], adj: Neighbors): boolean {
    const rank = new Map(order.map((v, i) => [v, i]));
    for (let i = 0; i < order.length; i += 1) {
        const v = order[i] as string;
        const later = [...adj.get(v)!].filter((u) => (rank.get(u) as number) > i);
        for (let a = 0; a < later.length; a += 1) {
            for (let b = a + 1; b < later.length; b += 1) {
                if (!adj.get(later[a] as string)!.has(later[b] as string)) return false;
            }
        }
    }
    return true;
}

/** BFS reachability in the graph with the forbidden vertices removed. */
function pathExists(adj: Neighbors, start: string, goal: string, forbidden: Set<string>): boolean {
    if (start === goal) return true;
    if (forbidden.has(start) || forbidden.has(goal)) return false;
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
        const v = queue.shift() as string;
        for (const u of adj.get(v)!) {
            if (u === goal) return true;
            if (!seen.has(u) && !forbidden.has(u)) {
                seen.add(u);
                queue.push(u);
            }
        }
    }
    return false;
}

function findAsteroidalTriple(labels: string[], adj: Neighbors): string[] | null {
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const a = labels[i] as string;
            const b = labels[j] as string;
            if (adj.get(a)!.has(b)) continue;
            for (let k = j + 1; k < labels.length; k += 1) {
                const c = labels[k] as string;
                if (adj.get(a)!.has(c) || adj.get(b)!.has(c)) continue;
                const avoidC = new Set([c, ...adj.get(c)!]);
                const avoidB = new Set([b, ...adj.get(b)!]);
                const avoidA = new Set([a, ...adj.get(a)!]);
                if (pathExists(adj, a, b, avoidC) && pathExists(adj, a, c, avoidB) && pathExists(adj, b, c, avoidA)) {
                    return [a, b, c];
                }
            }
        }
    }
    return null;
}

function candidateIntervals(order: string[], adj: Neighbors): string[] {
    const rank = new Map(order.map((v, i) => [v, i]));
    const seenCliques = new Set<string>();
    const cliques: string[][] = [];
    for (const v of order) {
        const clique = [v, ...[...adj.get(v)!].filter((u) => (rank.get(u) as number) > rank.get(v)!)];
        const key = [...clique].sort().join("|");
        if (seenCliques.has(key)) continue;
        seenCliques.add(key);
        cliques.push(clique);
    }
    cliques.sort((a, b) => {
        const ma = Math.min(...a.map((v) => rank.get(v) as number));
        const mb = Math.min(...b.map((v) => rank.get(v) as number));
        return ma - mb || b.length - a.length;
    });
    const out: string[] = [];
    for (const v of order) {
        let lo = Infinity;
        let hi = -1;
        cliques.forEach((c, i) => {
            if (c.includes(v)) {
                lo = Math.min(lo, i);
                hi = Math.max(hi, i);
            }
        });
        out.push(`${v}:[${lo},${hi}]`);
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A", "C", "D"],
        C: ["B", "D"],
        D: ["B", "C"],
    };
    const { labels, adj } = buildUndirected(graph);
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(graph);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let step = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        for (const n of nodes) n.state = states.get(String(n.value)) ?? "unvisited";
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber,
            layout: "graph",
            meta,
        };
    };
    const all = (state: EntityState): Map<string, EntityState> => new Map(labels.map((v) => [v, state]));

    yield snap("Graph loaded; test chordality and the asteroidal-triple condition.", 0, all("unvisited"), { vertices: labels.length, edges: edges.length });
    step += 1;

    if (labels.length === 0) {
        yield snap("Empty graph - it is trivially an interval graph.", 7, all("sorted"), { interval: true, chordal: true, atFree: true });
        return;
    }

    // MCS selects vertices in one order; reversed, it is a perfect elimination
    // order exactly when the graph is chordal.
    const order = [...maximumCardinalityOrder(labels, adj)].reverse();
    const chordal = isPerfectOrder(order, adj);
    const orderedStates = new Map<string, EntityState>();
    for (const v of order) orderedStates.set(v, "sorted");
    yield snap(
        `Elimination order [${order.join(", ")}] is ${chordal ? "perfect, so the graph is chordal" : "not perfect, so the graph has a chordless cycle"}.`,
        2,
        orderedStates,
        { peo: order, chordal },
    );
    step += 1;

    let atTriple: string[] | null = null;
    if (chordal) {
        atTriple = findAsteroidalTriple(labels, adj);
        const probe = new Map<string, EntityState>(all("visited"));
        if (atTriple) for (const v of atTriple) probe.set(v, "error");
        for (const e of edges) {
            if (atTriple && atTriple.includes(String(e.sourceId).replace("node-", "")) && atTriple.includes(String(e.targetId).replace("node-", ""))) {
                e.state = "active";
            }
        }
        yield snap(
            atTriple
                ? `Asteroidal triple {${atTriple.join(", ")}} found: the graph is not an interval graph.`
                : "No asteroidal triple found among independent vertex triples.",
            5,
            probe,
            { chordal, atFree: atTriple === null, atTriple: atTriple ?? [] },
        );
        step += 1;
        for (const e of edges) e.state = "idle";
    }

    const interval = chordal && atTriple === null;
    const intervals = interval ? candidateIntervals(order, adj) : [];
    yield snap(
        interval
            ? `Accepted: the graph is an interval graph. Candidate intervals ${intervals.join(" ")}.`
            : "Rejected: the graph is not an interval graph.",
        7,
        all(interval ? "sorted" : "error"),
        { interval, chordal, atFree: atTriple === null, peo: order, intervals },
    );
    void byId;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An interval graph draws a graph as overlapping intervals on a number line: two vertices are joined exactly when their intervals overlap. Rather than hunting for those intervals directly, use a structural test. A graph is an interval graph precisely when it is chordal, meaning every long cycle has a shortcut edge, and it has no asteroidal triple, meaning no three mutually nonadjacent vertices can each be reached from the other two without passing near the third.",
        invariants: [
            "The maximum-cardinality-search order is a perfect elimination order if and only if the graph is chordal.",
            "An asteroidal triple requires a path between each pair that avoids the closed neighborhood of the third.",
            "Chordal plus asteroidal-triple-free is exactly the class of interval graphs.",
        ],
        correctness:
            "Maximum cardinality search yields a perfect elimination order for every chordal graph, and a graph is chordal if and only if some elimination order is perfect, so the PEO test decides chordality. The asteroidal-triple test enumerates all independent triples and uses breadth-first reachability in the subgraph that removes one vertex and its neighbors; by definition the triple is asteroidal only when all three separating paths exist. Lekkerkerker and Boland proved that a graph is an interval graph exactly when it is chordal and asteroidal-triple-free, so the combined verdict is correct. The displayed intervals are laid out from the maximal cliques of a positive instance.",
        complexityRationale:
            "Maximum cardinality search and the PEO check take O(V^2) and O(V*E) respectively. Enumerating triples is O(V^3) and each of the three reachability searches is O(V+E), giving a straightforward O(V^3*(V+E)) bound, acceptable for teaching-sized graphs. Storing the undirected adjacency uses O(V+E) space.",
        uses: [
            "Scheduling tasks whose active time windows form intervals",
            "recognizing overlap structure in bioinformatics and genomics",
            "A first decision problem in graph class recognition",
        ],
        references: [
            "Lekkerkerker and Boland, Representation of a Finite Graph by a Set of Intervals, 1962",
            "Golumbic, Algorithmic Graph Theory and Perfect Graphs, Chapter 4",
        ],
        workedExample:
            "A path A-B-C-D is chordal because it has no cycle at all, and it has no independent triple whose three pairs can all be connected away from the third, so it is an interval graph. A four-cycle A-B-C-D-A is not chordal because the cycle of length four has no chord, so it is rejected without reaching the triple test.",
    },
    id: "interval-graph-recognition",
    name: "Interval Graph Recognition",
    category: "graph",
    complexity: { time: "O(V^3·(V+E))", space: "O(V+E)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C", "D"], C: ["B", "D"], D: ["B", "C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected version of the graph",
        "compute a maximum cardinality search elimination order",
        "check whether every later-neighbor set is a clique",
        "if not, report a chordless cycle and reject",
        "for each independent triple test three separating paths",
        "if all three paths exist, report an asteroidal triple and reject",
        "otherwise accept and build intervals from maximal cliques",
        "done: report interval graph verdict",
    ],
};

export default module;
