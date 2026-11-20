/**
 * nucleus-decomposition.ts - (k, r) Nucleus Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A (k, r)-nucleus is a maximal vertex set in which every vertex takes part in
 * at least k different r-cliques entirely inside the set. Setting r = 2 gives
 * the k-core and r = 3 gives the k-truss; larger r generalizes both to denser
 * motifs. Peeling removes any vertex whose current r-clique count falls below
 * k, and the largest k at which a vertex survives is its nucleus number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * n * n^r) for K values of k, worst-case exponential in r
 *   Space: O(n + m) for the adjacency, counts, and survivor sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Graph vertices are circles; edges connect the undirected graph.
 *   - A peeled vertex flashes RED; survivors of the requested nucleus are GREEN.
 *   - The final frame reports the nucleus and every nucleus number.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

type Adjacency = Map<string, Set<string>>;

function buildAdjacency(graph: Record<string, string[]>): { labels: string[]; adj: Adjacency } {
    const seen = new Set<string>(Object.keys(graph));
    for (const neighbors of Object.values(graph)) {
        for (const n of neighbors) seen.add(n);
    }
    const labels = [...seen].sort();
    const adj: Adjacency = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const v of neighbors) {
            if (u === v) continue;
            adj.get(u)?.add(v);
            adj.get(v)?.add(u);
        }
    }
    return { labels, adj };
}

/** Count r-cliques inside `subset` that contain the vertex `v`. */
function countRCliques(v: string, subset: Set<string>, adj: Adjacency, r: number): number {
    if (r < 2) return 0;
    const others = [...subset].filter((x) => x !== v);
    if (others.length < r - 1) return 0;
    let count = 0;
    const combo: string[] = [];
    const choose = (start: number): void => {
        if (combo.length === r - 1) {
            const group = [v, ...combo];
            for (let i = 0; i < group.length; i += 1) {
                for (let j = i + 1; j < group.length; j += 1) {
                    if (!adj.get(group[i] as string)?.has(group[j] as string)) return;
                }
            }
            count += 1;
            return;
        }
        for (let i = start; i < others.length; i += 1) {
            combo.push(others[i] as string);
            choose(i + 1);
            combo.pop();
        }
    };
    choose(0);
    return count;
}

/** Peel vertices below threshold k, returning survivors and the peel order. */
function peel(
    k: number,
    r: number,
    labels: string[],
    adj: Adjacency,
): { survivors: string[]; removals: Array<{ v: string; count: number }> } {
    const alive = new Set(labels);
    const removals: Array<{ v: string; count: number }> = [];
    while (alive.size > 0) {
        let victim: string | null = null;
        let victimCount = Infinity;
        for (const v of [...alive].sort()) {
            const c = countRCliques(v, alive, adj, r);
            if (c < k) {
                victim = v;
                victimCount = c;
                break;
            }
        }
        if (victim === null) break;
        alive.delete(victim);
        removals.push({ v: victim, count: victimCount });
    }
    return { survivors: [...alive].sort(), removals };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; k?: number; r?: number } | null) ?? {};
    const graph = task.graph ?? {};
    const k = Number.isFinite(task.k) ? Math.max(1, Math.floor(task.k as number)) : 3;
    const r = Number.isFinite(task.r) ? Math.max(2, Math.floor(task.r as number)) : 4;
    const { labels, adj } = buildAdjacency(graph);

    const nodes = makeGraphNodes(labels);
    const undirected: Record<string, string[]> = {};
    for (const v of labels) undirected[v] = [...(adj.get(v) ?? [])].sort();
    const edges = makeGraphEdges(undirected);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setState = (v: string, s: EntityState): void => {
        const node = byId.get(`node-${v}`);
        if (node) node.state = s;
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | string[] | number[] | Record<string, number>> = {},
    ): VisualFrame => ({
        stepNumber: step++,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    if (labels.length === 0) {
        yield snap("Empty graph – there is no nucleus to decompose.", 0);
        return;
    }

    // Nucleus numbers: the last threshold k at which each vertex survives.
    const full = new Set(labels);
    let maxK = 0;
    for (const v of labels) maxK = Math.max(maxK, countRCliques(v, full, adj, r));
    maxK = Math.min(maxK, 64);
    const nucleusNumber = new Map<string, number>(labels.map((v) => [v, 0]));
    for (let level = 1; level <= maxK; level += 1) {
        const result = peel(level, r, labels, adj);
        for (const v of result.survivors) nucleusNumber.set(v, level);
    }

    yield snap(
        `Start with ${labels.length} vertices; peel below k=${k} r-cliques of size ${r}.`,
        0,
        { threshold: k, cliqueSize: r, vertices: labels.length },
    );

    const requested = peel(k, r, labels, adj);
    for (const removal of requested.removals) {
        setState(removal.v, "swapped");
        for (const edge of edges) {
            if (edge.sourceId === `node-${removal.v}` || edge.targetId === `node-${removal.v}`) {
                edge.state = "error";
            }
        }
        yield snap(
            `Peel ${removal.v}: only ${removal.count} r-clique(s), below ${k}.`,
            3,
            { removed: removal.v, cliqueCount: removal.count, remaining: labels.length - requested.removals.indexOf(removal) - 1 },
        );
    }

    for (const v of requested.survivors) setState(v, "sorted");
    const numbers: Record<string, number> = {};
    for (const v of labels) numbers[v] = nucleusNumber.get(v) ?? 0;
    yield snap(
        `The (${k}, ${r})-nucleus has ${requested.survivors.length} vertex(es): ${requested.survivors.join(", ") || "none"}.`,
        7,
        {
            nucleus: [...requested.survivors],
            nucleusNumbers: numbers,
            threshold: k,
            cliqueSize: r,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Density is not just degree: a vertex can have many neighbors yet sit in no tightly knit group. Nucleus decomposition measures how many small complete subgraphs, or r-cliques, each vertex belongs to. Peel away vertices that fall below a threshold, and the order in which they vanish reveals the dense core of the network.",
        invariants: [
            "Every surviving vertex has at least k r-cliques inside the current subgraph.",
            "Removing a vertex can only lower, never raise, the clique counts of the remaining vertices.",
            "Survivor sets shrink monotonically as the threshold k increases.",
        ],
        correctness:
            "The peel condition is exactly the nucleus condition, so when peeling stops every remaining vertex satisfies it and the result is a (k, r)-nucleus. Because removing vertices only destroys cliques, any other (k, r)-nucleus can be added back without breaking the condition, which makes the peeled set the unique maximal one. Recording the largest k at which a vertex survives therefore gives its exact nucleus number.",
        complexityRationale:
            "Counting r-cliques through a vertex requires enumerating r-subsets of its neighbors, O(n^r) in the worst case, and peeling can touch every vertex, giving O(K n n^r) across K thresholds. The adjacency sets, counts, and survivor sets use O(n + m) working space, with clique enumeration dominating the time.",
        uses: [
            "Detecting dense communities in social and biological networks",
            "Generalizing k-core and k-truss cohesion analysis to larger motifs",
            "Preprocessing large graphs for visualization and sparsification",
        ],
        references: [
            "Sariyuce, Seshadhri, Pinar, and Catalyurek, Nucleus Decomposition in Large Graphs, 2015",
            "Sariyuce, Pinar, and Catalyurek, Fast Peeling of Clique-Based Graph Decompositions, 2016",
        ],
        workedExample:
            "Take six vertices forming a complete graph plus a leaf joined to only two of them, with r = 4 and k = 3. Each member of the complete graph sits in ten four-cliques and survives. The leaf sits in none, so it peels first and the maximal (3, 4)-nucleus is the original complete graph.",
    },
    id: "nucleus-decomposition",
    name: "Nucleus Decomposition ((k, r)-Nucleus)",
    category: "graph",
    complexity: { time: "O(K * n * n^r)", space: "O(n + m)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D", "E", "F"],
            B: ["A", "C", "D", "E", "F"],
            C: ["A", "B", "D", "E", "F"],
            D: ["A", "B", "C", "E", "F"],
            E: ["A", "B", "C", "D", "F"],
            F: ["A", "B", "C", "D", "E"],
            G: ["A", "B"],
            H: ["G"],
        },
        k: 3,
        r: 4,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the graph and fix the clique size r",
        "for each threshold k from one up to the maximum clique count",
        "count r-cliques containing each alive vertex",
        "peel any vertex whose count is below k and stamp its nucleus number",
        "repeat peeling until no alive vertex falls below k",
        "the survivors form the maximal (k, r)-nucleus",
        "record the largest k at which every vertex survived",
        "report the nucleus and all nucleus numbers",
    ],
};

export default module;
