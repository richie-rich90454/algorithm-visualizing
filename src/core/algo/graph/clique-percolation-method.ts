/**
 * clique-percolation-method.ts - Clique Percolation Method (CPM)
 *
 * CPM finds overlapping communities by looking for maximal cliques of size k
 * and then joining cliques that share at least k-1 vertices. Connected groups
 * of cliques form communities, and a vertex can belong to several communities
 * when it sits in more than one percolating group.
 *
 * Time: O(3^(n/3) + c^2 * k) for small graphs, where c is the clique count
 * Space: O(c * k) for the clique overlap structure
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GraphInput {
    graph: { nodes: string[]; edges: Array<[string, string]> };
    k: number;
}

type Clique = string[];

function adjacencyOf(nodes: string[], edges: Array<[string, string]>): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) {
        adjacency.set(node, new Set());
    }
    for (const [a, b] of edges) {
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
    }
    return adjacency;
}

function* bronKerbosch(
    current: string[],
    candidates: Set<string>,
    excluded: Set<string>,
    adjacency: Map<string, Set<string>>,
): Generator<Clique, void, unknown> {
    if (candidates.size === 0 && excluded.size === 0) {
        yield [...current];
        return;
    }
    for (const vertex of [...candidates]) {
        const neighbors = adjacency.get(vertex) ?? new Set<string>();
        const nextCandidates = new Set([...candidates].filter((entry) => neighbors.has(entry)));
        const nextExcluded = new Set([...excluded].filter((entry) => neighbors.has(entry)));
        yield* bronKerbosch([...current, vertex], nextCandidates, nextExcluded, adjacency);
        candidates.delete(vertex);
        excluded.add(vertex);
    }
}

function overlap(left: Clique, right: Clique, k: number): boolean {
    const set = new Set(right);
    return left.filter((vertex) => set.has(vertex)).length >= k - 1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<GraphInput> | null) ?? {};
    const graph = task.graph ?? {
        nodes: ["A", "B", "C", "D", "E", "F", "G"],
        edges: [
            ["A", "B"],
            ["B", "C"],
            ["C", "A"],
            ["A", "D"],
            ["B", "D"],
            ["D", "E"],
            ["E", "F"],
            ["F", "D"],
        ] as Array<[string, string]>,
    };
    const nodes = [...graph.nodes];
    const edges = graph.edges.map((edge) => [...edge] as [string, string]);
    const k = Math.max(2, typeof task.k === "number" ? task.k : 3);
    const indexOf = new Map(nodes.map((node, index) => [node, index]));
    const adjacency = adjacencyOf(nodes, edges);

    const makeEntities = (states: Map<number, EntityState>): VisualEntity[] =>
        nodes.map((node, index) => ({
            id: `node-${index}`,
            type: "node" as const,
            label: node,
            value: node,
            state: states.get(index) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, name: node },
        }));
    const makeEdges = (states: Map<string, EntityState>): VisualEdge[] =>
        edges.map(([a, b], index) => ({
            id: `edge-${index}`,
            sourceId: `node-${indexOf.get(a)}`,
            targetId: `node-${indexOf.get(b)}`,
            label: "",
            state: states.get(`edge-${index}`) ?? "idle",
            directed: false,
        }));

    let step = 0;
    const frame = (
        states: Map<number, EntityState>,
        edgeStates: Map<string, EntityState>,
        description: string,
        line: number,
        communities: string[],
        cliques: string[],
        current: string,
    ): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeEntities(states),
            edges: makeEdges(edgeStates),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { k, communities, cliques, current, rows: nodes.length, cols: nodes.length },
        };
        step += 1;
        return result;
    };

    yield frame(
        new Map(),
        new Map(),
        `Finding maximal cliques of size at least ${k} before percolating overlaps.`,
        0,
        [],
        [],
        "",
    );

    const cliques: Clique[] = [];
    for (const clique of bronKerbosch([], new Set(nodes), new Set(), adjacency)) {
        if (clique.length >= k) {
            cliques.push([...clique].sort());
        }
    }
    for (const clique of cliques) {
        const states = new Map<number, EntityState>();
        const edgeStates = new Map<string, EntityState>();
        for (const node of clique) {
            states.set(indexOf.get(node) as number, "highlight");
        }
        for (let e = 0; e < edges.length; e += 1) {
            const [a, b] = edges[e] as [string, string];
            if (clique.includes(a) && clique.includes(b)) {
                edgeStates.set(`edge-${e}`, "active");
            }
        }
        yield frame(
            states,
            edgeStates,
            `Found maximal clique {${clique.join(", ")}} of size ${clique.length}.`,
            1,
            [],
            cliques.map((entry) => entry.join(",")),
            clique.join(","),
        );
    }

    const parent = cliques.map((_, index) => index);
    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) {
            root = parent[root] as number;
        }
        while (parent[x] !== root) {
            const next = parent[x] as number;
            parent[x] = root;
            x = next;
        }
        return root;
    };
    for (let i = 0; i < cliques.length; i += 1) {
        for (let j = i + 1; j < cliques.length; j += 1) {
            if (overlap(cliques[i] as Clique, cliques[j] as Clique, k)) {
                parent[find(j)] = find(i);
            }
        }
    }

    const groups = new Map<number, Set<string>>();
    cliques.forEach((clique, index) => {
        const root = find(index);
        const group = groups.get(root) ?? new Set<string>();
        for (const node of clique) {
            group.add(node);
        }
        groups.set(root, group);
    });
    const communities = [...groups.values()]
        .map((group) => [...group].sort())
        .sort((a, b) => a.join(",").localeCompare(b.join(",")));

    for (const community of communities) {
        const states = new Map<number, EntityState>();
        for (const node of community) {
            states.set(indexOf.get(node) as number, "path");
        }
        yield frame(
            states,
            new Map(),
            `Percolated clique overlap into community {${community.join(", ")}}.`,
            3,
            communities.map((entry) => entry.join(",")),
            cliques.map((entry) => entry.join(",")),
            community.join(","),
        );
    }

    yield frame(
        new Map(nodes.map((_, index) => [index, "sorted" as EntityState])),
        new Map(),
        `Found ${communities.length} overlapping community or communities at k = ${k}.`,
        5,
        communities.map((entry) => entry.join(",")),
        cliques.map((entry) => entry.join(",")),
        "",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Complex networks often contain tightly knit groups that overlap. CPM first lists every maximal clique of at least k vertices, then treats two cliques as connected when they share at least k-1 members. A connected chain of such cliques percolates into one community, and shared vertices naturally belong to more than one group.",
        invariants: [
            "Every reported clique is maximal and has at least k vertices.",
            "Cliques in one community form a connected chain under the overlap rule.",
            "A vertex may appear in several communities but never twice in one.",
        ],
        correctness:
            "Bron-Kerbosch enumerates each maximal clique exactly once by extending candidates and moving exhausted vertices to the excluded set. The overlap relation is symmetric, so its connected components are well defined; unioning the cliques in a component produces precisely the union of vertices that percolate together. Lowering k can only merge communities, matching the definition.",
        complexityRationale:
            "Enumerating maximal cliques takes O(3^(n/3)) time in the worst case, and comparing c cliques pairwise costs O(c^2 * k). Storage is O(c * k) for the clique list plus O(n + m) for the graph.",
        uses: [
            "Detecting overlapping groups in social and collaboration networks",
            "Finding protein complexes in interaction networks",
            "Teaching the difference between disjoint and overlapping communities",
        ],
        references: [
            "Palla, Derenyi, Farkas and Vicsek, Uncovering the Overlapping Community Structure, 2005",
            "Bron and Kerbosch, Algorithm 457 for Enumerating All Cliques, 1973",
        ],
        workedExample:
            "With k = 3, triangles {A, B, C} and {A, B, D} share the pair {A, B}, so they join into community {A, B, C, D}. Triangle {D, E, F} shares only D with the first pair, which is fewer than k-1 = 2 vertices, so it forms its own community {D, E, F}. D therefore belongs to two communities.",
    },
    id: "clique-percolation-method",
    name: "Clique Percolation Method",
    category: "graph",
    complexity: { time: "O(3^(n/3) + c^2 k)", space: "O(c k + n + m)" },
    defaultInput: {
        graph: {
            nodes: ["A", "B", "C", "D", "E", "F", "G"],
            edges: [
                ["A", "B"],
                ["B", "C"],
                ["C", "A"],
                ["A", "D"],
                ["B", "D"],
                ["D", "E"],
                ["E", "F"],
                ["F", "D"],
            ],
        },
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the adjacency map of the graph",
        "enumerate every maximal clique with Bron-Kerbosch",
        "keep only cliques of size at least k",
        "join two cliques when they share at least k minus one vertices",
        "collect each connected group of cliques into a community",
        "union the vertices of the cliques in each group",
        "done: report the overlapping communities",
    ],
};

export default module;
