/**
 * minimum-spanning-forest.ts - Minimum Spanning Forest
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When an undirected weighted graph is disconnected, no single spanning tree
 * can reach every vertex. The minimum spanning forest is the union of one
 * minimum spanning tree per connected component. The algorithm first labels
 * the connected components, then runs Kruskal's greedy edge scan over the
 * whole graph: an edge joins the forest exactly when it connects two distinct
 * union-find sets. The result is an acyclic forest with one tree per component
 * and the smallest possible total weight.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log E) to sort the edges, plus near-linear union-find work
 *   Space: O(V + E) for the graph, the union-find sets, and the forest
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices and weighted edges use the graph layout.
 *   - The edge currently scanned is YELLOW; accepted edges turn GREEN.
 *   - Rejected cycle-forming edges flash RED and are left out of the forest.
 *   - The final frame reports one tree and its weight per component.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Edge = { id: number; a: string; b: string; w: number };
type Input = { vertices?: string[]; edges?: [string, string, number][] };

class DSU {
    private parent = new Map<string, string>();

    add(x: string): void {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
        }
    }

    find(x: string): string {
        const p = this.parent.get(x);
        if (p === undefined) {
            this.add(x);
            return x;
        }
        if (p !== x) {
            const root = this.find(p);
            this.parent.set(x, root);
            return root;
        }
        return x;
    }

    union(a: string, b: string): boolean {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb) {
            return false;
        }
        this.parent.set(ra, rb);
        return true;
    }
}

const FR = (
    step: number,
    entities: VisualEntity[],
    edges: VisualEdge[],
    description: string,
    codeLineNumber: number,
    meta: VisualFrame["meta"],
): VisualFrame => ({ stepNumber: step, entities, edges, description, codeLineNumber, layout: "graph", meta });

const nodes = (vertices: string[], states: Map<string, EntityState> = new Map()): VisualEntity[] =>
    vertices.map((v) => ({
        id: `node-${v}`,
        type: "node" as const,
        label: v,
        value: v,
        state: states.get(v) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: v },
    }));

const linkEdges = (
    edges: Edge[],
    forest: Set<number>,
    scanned: number,
    decision: "accept" | "reject" | "none",
): VisualEdge[] =>
    edges.map((e) => ({
        id: `edge-${e.id}`,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: String(e.w),
        state:
            e.id === scanned
                ? decision === "accept"
                    ? "sorted"
                    : decision === "reject"
                        ? "error"
                        : "comparing"
                : forest.has(e.id)
                    ? "sorted"
                    : "idle",
        directed: false,
    }));

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const rawEdges = Array.isArray(task.edges) ? task.edges : [];
    const vertices: string[] = [];
    if (Array.isArray(task.vertices)) {
        for (const v of task.vertices) {
            if (typeof v === "string" && !vertices.includes(v)) {
                vertices.push(v);
            }
        }
    }
    const edges: Edge[] = [];
    rawEdges.forEach((raw, index) => {
        if (!Array.isArray(raw) || raw.length < 3) {
            return;
        }
        const a = raw[0];
        const b = raw[1];
        const w = raw[2];
        if (typeof a !== "string" || typeof b !== "string" || typeof w !== "number" || !Number.isFinite(w)) {
            return;
        }
        for (const v of [a, b]) {
            if (!vertices.includes(v)) {
                vertices.push(v);
            }
        }
        edges.push({ id: index, a, b, w });
    });

    if (vertices.length === 0) {
        yield FR(0, [], [], "Empty graph - there is no spanning forest to build.", 0, {
            components: 0,
            totalWeight: 0,
        });
        return;
    }

    const componentDsu = new DSU();
    for (const v of vertices) {
        componentDsu.add(v);
    }
    for (const e of edges) {
        componentDsu.union(e.a, e.b);
    }
    const roots = new Set(vertices.map((v) => componentDsu.find(v)));
    const componentCount = roots.size;

    let step = 0;
    yield FR(
        step++,
        nodes(vertices),
        linkEdges(edges, new Set(), -1, "none"),
        `Graph has ${vertices.length} vertices in ${componentCount} connected component(s); the forest will contain ${vertices.length - componentCount} edge(s).`,
        0,
        { components: componentCount, vertices: vertices.length, totalWeight: 0, forestEdges: 0 },
    );

    const forest = new Set<number>();
    const buildDsu = new DSU();
    for (const v of vertices) {
        buildDsu.add(v);
    }
    const ordered = [...edges].sort((x, y) => x.w - y.w || x.id - y.id);
    let totalWeight = 0;

    for (const e of ordered) {
        const accepted = buildDsu.union(e.a, e.b);
        if (accepted) {
            forest.add(e.id);
            totalWeight += e.w;
        }
        yield FR(
            step++,
            nodes(vertices),
            linkEdges(edges, forest, e.id, accepted ? "accept" : "reject"),
            `Edge ${e.a}-${e.b} of weight ${e.w}: ${accepted ? `accepted, ${forest.size} forest edge(s), weight ${totalWeight}` : "rejected because it closes a cycle"}.`,
            accepted ? 3 : 4,
            {
                components: componentCount,
                vertices: vertices.length,
                totalWeight,
                forestEdges: forest.size,
                accepted: accepted ? 1 : 0,
            },
        );
    }

    const componentSizes: number[] = [];
    const componentWeights: number[] = [];
    for (const root of roots) {
        const members = vertices.filter((v) => componentDsu.find(v) === root);
        componentSizes.push(members.length);
        let weight = 0;
        for (const e of edges) {
            if (forest.has(e.id) && componentDsu.find(e.a) === root) {
                weight += e.w;
            }
        }
        componentWeights.push(weight);
    }
    const summary = Array.from(roots)
        .map((root, i) => `${componentSizes[i]} vertices / weight ${componentWeights[i]}`)
        .join("; ");

    yield FR(
        step++,
        nodes(vertices),
        linkEdges(edges, forest, -1, "none"),
        `Minimum spanning forest: ${forest.size} edge(s), total weight ${totalWeight}; components ${summary}.`,
        6,
        {
            components: componentCount,
            vertices: vertices.length,
            totalWeight,
            forestEdges: forest.size,
            componentSizes,
            componentWeights,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A minimum spanning tree needs a connected graph, but real networks often fall into separate islands. Treat each island on its own: the best you can do is grow one cheapest tree inside every island. Kruskal's sorted-edge scan gives this for free, because an edge that would connect two already-linked vertices is skipped and each island ends with exactly one tree.",
        invariants: [
            "The chosen edge set is always acyclic: no edge joins two vertices already linked by chosen edges.",
            "Every connected component of the input ends with exactly one tree of that component.",
            "After scanning all edges up to weight w, the chosen edges are a minimum forest for that prefix of edges.",
        ],
        correctness:
            "Kruskal's algorithm is correct for any graph, connected or not. Sorting edges and adding one only when it joins two distinct union-find sets is the cut rule: the lightest edge crossing the cut between the two sets is safe to keep. Because union-find never links vertices in different input components, each component is processed independently and produces a minimum spanning tree there. The union of those trees is a minimum spanning forest by the cut property applied within each component.",
        complexityRationale:
            "Building the components and the forest uses union-find, which is effectively linear, while sorting E edges costs O(E log E), so overall time is O(E log E). The edge list, union-find arrays, and forest set require O(V + E) space.",
        uses: [
            "Designing a minimum-cost network over several disconnected regions",
            "Clustering where each cluster is summarized by a spanning tree",
            "Initialization for dynamic MST algorithms on disconnected inputs",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning tree chapter",
            "Berge, Graphs and Hypergraphs, 1973, spanning trees and forests",
        ],
        workedExample:
            "Suppose vertices A-B-C form one component with edges A-B(1), B-C(2) and vertices D-E form another with edge D-E(4). Kruskal accepts all three edges and rejects any extra edge inside a component. The forest has two trees, total weight 7, and each component has exactly one tree with vertex counts 3 and 2.",
    },
    id: "minimum-spanning-forest",
    name: "Minimum Spanning Forest",
    category: "mst",
    complexity: { time: "O(E log E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["A", "C", 5],
            ["D", "E", 3],
            ["E", "F", 4],
            ["D", "F", 6],
            ["C", "D", 9],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "label the connected components of the graph",
        "sort all edges by increasing weight",
        "start an empty forest and a fresh union-find set per vertex",
        "for each edge in sorted order do the following",
        "accept it when its endpoints lie in different sets and union them",
        "reject it when its endpoints are already connected",
        "done: report one minimum tree per component and the total weight",
    ],
};

export default module;
