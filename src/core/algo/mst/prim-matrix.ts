/**
 * prim-matrix.ts – Prim's Algorithm (Matrix / O(V²))
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Prim's algorithm grows the minimum spanning tree one vertex at a time,
 * starting from an arbitrary root. At every step it adds the cheapest edge
 * that connects a vertex already in the tree to a vertex outside it. This
 * "matrix" variant scans the whole outside set to find the cheapest frontier
 * edge on each iteration, giving O(V²) – ideal for dense graphs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²) – V iterations, each scanning O(V)
 *   Space: O(V) for the key/predecessor arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being added to the tree is YELLOW (comparing).
 *   - The edge that joins it is BLUE (active).
 *   - Tree vertices are GREEN (sorted).
 *   - Tree edges are CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Vertex-centric: grows the tree outward, unlike Kruskal's edge-centric
 *     approach.
 *   - Dense-graph favorite; the heap variant is better on sparse graphs.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

/**
 * The Prim (Matrix) generator.
 *
 * @param input `{ edges, vertices, start? }` – an undirected weighted edge list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            edges?: Array<[string, string, number]>;
            vertices?: string[];
            start?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["A", "B", 4],
        ["A", "C", 2],
        ["B", "C", 1],
        ["B", "D", 5],
        ["C", "D", 8],
        ["C", "E", 10],
        ["D", "E", 2],
        ["D", "F", 6],
        ["E", "F", 3],
    ];
    const start = task.start ?? "A";

    const nodes = makeGraphNodes(vertices);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Index edges by their two endpoints for quick lookup.
    const edgesByPair = new Map<string, VisualEdge>();
    edgeList.forEach(([a, b, weight], index) => {
        const key = [a, b].sort().join("-");
        edgesByPair.set(key, {
            id: `edge-${index}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: String(weight),
            state: "idle",
            directed: false,
        });
    });
    const edges = [...edgesByPair.values()];

    let step = 0;
    const inTree = new Set<string>();
    const key = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const v of vertices) {
        key.set(v, Infinity);
        parent.set(v, null);
    }
    key.set(start, 0);

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Prim's algorithm on ${vertices.length} vertices, ${edgeList.length} edges starting from vertex ${start} – growing the MST outward.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { inTree: 0, accepted: 0, totalWeight: 0 },
    };
    step += 1;

    // Helper to find the weight of an edge between two vertices.
    const edgeWeight = (a: string, b: string): number => {
        const edge = edgesByPair.get([a, b].sort().join("-"));
        return edge ? Number(edge.label) : Infinity;
    };

    // Repeat until every vertex is in the tree.
    while (inTree.size < vertices.length) {
        // Pick the outside vertex with the smallest key (cheapest frontier edge).
        let current = "";
        let bestKey = Infinity;
        for (const v of vertices) {
            if (!inTree.has(v) && (key.get(v) ?? Infinity) < bestKey) {
                bestKey = key.get(v) ?? Infinity;
                current = v;
            }
        }

        if (current === "") {
            break; // Disconnected graph – remaining vertices unreachable.
        }

        // Add the vertex and its joining edge to the tree.
        inTree.add(current);
        const parentVertex = parent.get(current);
        if (parentVertex) {
            const edge = edgesByPair.get([parentVertex, current].sort().join("-"));
            if (edge) {
                edge.state = "path";
            }
        }

        const node = nodeById.get(`node-${current}`);
        if (node) {
            node.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: parentVertex
                ? `Adding ${parentVertex}–${current} (weight ${edgeWeight(parentVertex, current)}) to the MST.`
                : `Starting the tree at vertex ${current}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { inTree: inTree.size, accepted: inTree.size - 1, totalWeight: 0 },
        };
        step += 1;

        // Update the keys of all outside neighbors of the new vertex.
        for (const v of vertices) {
            if (inTree.has(v)) {
                continue;
            }
            const w = edgeWeight(current, v);
            if (w < (key.get(v) ?? Infinity)) {
                key.set(v, w);
                parent.set(v, current);
            }
        }

        if (node) {
            node.state = "sorted";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Updated frontier keys around vertex ${current}: cheapest links into the tree refreshed.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { inTree: inTree.size, accepted: inTree.size - 1, totalWeight: 0 },
        };
        step += 1;
    }

    // Total MST weight: sum of the tree edges' weights.
    const totalWeight = [...edgesByPair.values()]
        .filter((e) => e.state === "path")
        .reduce((sum, e) => sum + Number(e.label), 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum spanning tree complete – ${inTree.size} vertices, total weight ${totalWeight}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { inTree: inTree.size, accepted: inTree.size - 1, totalWeight },
    };
}

/** The Prim (Matrix) module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Prim's algorithm grows a minimum spanning tree one vertex at a time from a start vertex. At each step it adds the cheapest edge connecting the tree to a vertex outside it. This matrix variant scans the entire outside set to find the cheapest frontier edge, giving O(V^2), which is ideal for dense graphs.",
        "invariants": [
            "Vertices in the tree are permanently included and never reconsidered.",
            "Each outside vertex's key is the cheapest edge connecting it to the tree.",
            "The edge chosen at each step is the lightest crossing the current cut."
        ],
        "correctness": "The lightest edge crossing the cut between the tree and the rest is safe by the cut property, so adding it keeps the tree contained in some MST. Repeating until all vertices are included yields a spanning tree that is minimum because every added edge was safe.",
        "complexityRationale": "V iterations each scan O(V) outside vertices for the minimum key, O(V^2) time, with O(V) space for key, parent, and in-tree arrays.",
        "uses": [
            "Minimum spanning trees on dense graphs",
            "Network design with a natural starting hub",
            "A stepping stone to the heap-based Prim algorithm"
        ],
        "references": [
            "Prim, Shortest Connection Networks and Some Generalizations (1957)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning trees"
        ],
        "workedExample": "Starting at A, keys for B and C are 4 and 2, so C is added first through A-C. Keys update using C's edges; next B joins through B-C of weight 1, then D through B-D or C-D. The accumulated edges form the MST."
    },
    id: "prim-matrix",
    name: "Prim's MST (Matrix)",
    category: "mst",
    complexity: { time: "O(V²)", space: "O(V)" },
    // Same graph as Kruskal so the two MST algorithms can be compared.
    defaultInput: {
        edges: [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "C", 1],
            ["B", "D", 5],
            ["C", "D", 8],
            ["C", "E", 10],
            ["D", "E", 2],
            ["D", "F", 6],
            ["E", "F", 3],
        ],
        vertices: ["A", "B", "C", "D", "E", "F"],
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from the start vertex with key 0 and no parent",
        "scan outside vertices for the smallest key vertex",
        "add the vertex to the tree through its cheapest edge",
        "update keys of outside neighbors using the new vertex",
        "mark the vertex finished and keep growing the tree",
        "repeat until every vertex joins the tree or it disconnects",
        "done: tree edges form the MST with minimum total weight",
    ],
};

export default module;
