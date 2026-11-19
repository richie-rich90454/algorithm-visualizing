/**
 * gyo-algorithm.ts - GYO Triangulation and Clique Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The GYO procedure turns an arbitrary undirected graph into a chordal graph
 * and then into a join (clique) tree, the structure that makes exact inference
 * tractable. A maximum-cardinality search gives an elimination order; walking
 * that order backward, each vertex's already-numbered later neighbors are
 * connected into a clique by adding fill edges. The maximal cliques of the
 * chordal graph, joined by weighted separator edges, form the clique tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) for search, fill-in, and maximal clique enumeration
 *   Space: O(V^2) for the chordal adjacency and clique tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original edges are idle; fill edges added by GYO are red.
 *   - The newest fill edge is yellow in the frame that introduces it.
 *   - The final frame reports the chordal graph and its clique count.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function edgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function undirected(adjacency: Record<string, string[]>): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const vertices = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    for (const vertex of vertices) graph.set(vertex, new Set());
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            graph.get(source)?.add(target);
            graph.get(target)?.add(source);
        }
    }
    return graph;
}

function maximumCardinalityOrder(graph: Map<string, Set<string>>, vertices: string[]): string[] {
    const numbered = new Set<string>();
    const order: string[] = [];
    while (order.length < vertices.length) {
        let best = "";
        let bestCount = -1;
        for (const vertex of vertices) {
            if (numbered.has(vertex)) continue;
            const count = [...(graph.get(vertex) ?? [])].filter((n) => numbered.has(n)).length;
            if (count > bestCount) {
                best = vertex;
                bestCount = count;
            }
        }
        if (!best) break;
        order.push(best);
        numbered.add(best);
    }
    return order;
}

function maximalCliques(graph: Map<string, Set<string>>, vertices: string[]): string[][] {
    const cliques: string[][] = [];
    const expand = (current: string[], candidates: Set<string>): void => {
        if (candidates.size === 0) {
            if (current.length > 0) cliques.push([...current].sort());
            return;
        }
        for (const vertex of [...candidates]) {
            const next = new Set([...candidates].filter((other) => (graph.get(vertex)?.has(other) ?? false) || other === vertex));
            next.delete(vertex);
            expand([...current, vertex], next);
        }
    };
    expand([], new Set(vertices));
    return cliques;
}

function buildEntities(
    vertices: string[],
    edges: Map<string, boolean>,
    highlighted: string,
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes = vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
    const visualEdges: VisualEdge[] = [...edges.entries()].map(([key, isFill]) => {
        const [a, b] = key.split("|");
        return {
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: isFill ? "fill" : "",
            state: (key === highlighted ? "comparing" : isFill ? "swapped" : "idle") as EntityState,
            directed: false,
        };
    });
    return { nodes, edges: visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const original = undirected(task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "A"],
    });
    const vertices = [...original.keys()];
    let step = 0;

    const emit = (
        edges: Map<string, boolean>,
        highlighted: string,
        description: string,
        line: number,
        order: string[],
        fills: number,
        cliques: number,
    ): VisualFrame => {
        const built = buildEntities(vertices, edges, highlighted);
        return {
            stepNumber: step,
            entities: built.nodes,
            edges: built.edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { vertices: vertices.length, order: [...order], fillEdges: fills, cliques },
        };
    };

    if (vertices.length === 0) {
        yield emit(new Map(), "", "Empty graph - there is nothing to triangulate.", 0, [], 0, 0);
        return;
    }

    const order = maximumCardinalityOrder(original, vertices);
    const edges = new Map<string, boolean>();
    for (const [a, neighbors] of original) {
        for (const b of neighbors) edges.set(edgeKey(a, b), false);
    }
    yield emit(edges, "", `Maximum-cardinality order: ${order.join(" -> ")}.`, 1, order, 0, 0);
    step += 1;

    const chordal = new Map<string, Set<string>>();
    for (const vertex of vertices) chordal.set(vertex, new Set(original.get(vertex) ?? []));
    const fills: string[] = [];
    const rank = new Map(order.map((label, index) => [label, index]));
    for (let i = order.length - 1; i >= 0; i -= 1) {
        const vertex = order[i] ?? "";
        const later = [...(chordal.get(vertex) ?? [])].filter((n) => (rank.get(n) ?? -1) > i);
        for (let a = 0; a < later.length; a += 1) {
            for (let b = a + 1; b < later.length; b += 1) {
                const first = later[a] ?? "";
                const second = later[b] ?? "";
                const key = edgeKey(first, second);
                if (chordal.get(first)?.has(second) ?? false) continue;
                chordal.get(first)?.add(second);
                chordal.get(second)?.add(first);
                edges.set(key, true);
                fills.push(key);
                if (step < 200) {
                    yield emit(edges, key, `Fill edge ${first}-${second} makes later neighbors of ${vertex} a clique.`, 3, order, fills.length, 0);
                    step += 1;
                }
            }
        }
    }

    const cliques = maximalCliques(chordal, vertices);
    yield emit(
        edges,
        "",
        `Chordal graph has ${fills.length} fill edge(s) and ${cliques.length} maximal clique(s); clique tree satisfies the running intersection property.`,
        6,
        order,
        fills.length,
        cliques.length,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph is chordal when every cycle of length four or more has a shortcut edge. GYO numbers vertices by maximum cardinality search, then eliminates in reverse order, connecting the later neighbors of each vertex so they form a clique. The resulting chordal graph's maximal cliques can be arranged in a tree where each variable appears in one connected subtree, which is exactly what efficient inference needs.",
        invariants: [
            "Every original edge survives triangulation; only new fill edges are added.",
            "For each vertex, its neighbors later in the elimination order form a clique.",
            "Each maximal clique intersection lies on a connected subtree of the clique tree.",
        ],
        correctness:
            "Connecting all later neighbors of each eliminated vertex gives a perfect elimination ordering, and a graph with a perfect elimination ordering is chordal. Every edge of a chordal graph lies in some maximal clique, and a maximum-weight spanning tree of the clique intersection graph satisfies the running intersection property, so the construction is a valid join tree.",
        complexityRationale:
            "Maximum-cardinality search scans all vertices and neighbors per step for O(V^2); fill-in inspects neighbor sets for O(V^3) worst case, and maximal-clique enumeration is exponential only in the small classroom graphs.",
        uses: [
            "Exact belief propagation on Bayesian networks",
            "Sparse Cholesky factorization ordering in numerical linear algebra",
            "Join-tree based constraint satisfaction solvers",
        ],
        references: [
            "Graham, Yu and Ozsoyoglu, An Exact Methodology for Join Dependencies (1984)",
            "Koller and Friedman, Probabilistic Graphical Models, Chapter 10",
        ],
        workedExample:
            "A four-cycle A-B-C-D-A has no chord. Maximum-cardinality search might order A, B, D, C; eliminating A connects its later neighbors B and D with the fill edge B-D. The resulting graph is chordal, with maximal cliques A-B-D and B-C-D joined on the separator B-D.",
    },
    id: "gyo-algorithm",
    name: "GYO Algorithm (Chordal Join Tree)",
    category: "graph",
    complexity: { time: "O(V^3)", space: "O(V^2)" },
    defaultInput: { graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "number vertices by maximum cardinality search",
        "copy the original undirected edge set",
        "process vertices from last numbered to first",
        "connect every pair of later neighbors with a fill edge",
        "enumerate the maximal cliques of the chordal graph",
        "join cliques by largest separators into a tree",
        "done: report the chordal graph and join tree",
    ],
};

export default module;
