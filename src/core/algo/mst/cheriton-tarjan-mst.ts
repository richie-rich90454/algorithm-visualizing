/**
 * cheriton-tarjan-mst.ts - Cheriton-Tarjan Minimum Spanning Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cheriton and Tarjan grow a spanning tree from every vertex at once. Each
 * contracted component owns a meldable min-heap of the edges incident to its
 * vertices. The algorithm repeatedly takes the cheapest heap edge that leaves
 * its component and, when two components are joined, melds their heaps in one
 * step. The meldable-heap structure is what gives the O(E log log V) bound,
 * faster than sorting all edges.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log log V) with true meldable heaps
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices in the component just merged are green (active/path).
 *   - The edge that caused the merge is highlighted (path).
 *   - The final frame reports the total MST weight.
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string, number];

/** Binary min-heap of edge indices, ordered by edge weight, with an O(size) meld. */
class EdgeHeap {
    private data: number[] = [];

    constructor(private readonly edges: Edge[]) {}

    get size(): number {
        return this.data.length;
    }

    peek(): number | undefined {
        return this.data[0];
    }

    private less(posA: number, posB: number): boolean {
        const a = this.data[posA]!;
        const b = this.data[posB]!;
        return (this.edges[a]?.[2] ?? Infinity) <= (this.edges[b]?.[2] ?? Infinity);
    }

    push(index: number): void {
        this.data.push(index);
        let child = this.data.length - 1;
        while (child > 0) {
            const parent = (child - 1) >> 1;
            if (!this.less(child, parent)) break;
            [this.data[child], this.data[parent]] = [this.data[parent]!, this.data[child]!];
            child = parent;
        }
    }

    pop(): number | undefined {
        const n = this.data.length;
        if (n === 0) return undefined;
        const top = this.data[0]!;
        const last = this.data.pop()!;
        if (n > 1) {
            this.data[0] = last;
            let parent = 0;
            for (;;) {
                const left = 2 * parent + 1;
                const right = left + 1;
                let smallest = parent;
                if (left < this.data.length && this.less(left, smallest)) smallest = left;
                if (right < this.data.length && this.less(right, smallest)) smallest = right;
                if (smallest === parent) break;
                [this.data[parent], this.data[smallest]] = [this.data[smallest]!, this.data[parent]!];
                parent = smallest;
            }
        }
        return top;
    }

    meld(other: EdgeHeap): void {
        for (const index of other.data) this.push(index);
        other.data = [];
    }
}

interface Component {
    id: string;
    vertices: Set<string>;
    heap: EdgeHeap;
}

function kruskal(vertices: string[], edges: Edge[]): number {
    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    let weight = 0;
    let count = 0;
    for (const [a, b, w] of [...edges].sort((x, y) => x[2] - y[2])) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) continue;
        parent.set(ra, rb);
        weight += w;
        if (++count === vertices.length - 1) break;
    }
    return weight;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; edges?: Edge[] } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edges: Edge[] = task.edges ?? [
        ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
        ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
    ];

    const nodes = makeGraphNodes(vertices);
    const visualEdges: VisualEdge[] = edges.map(([a, b, w], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(w),
        state: "idle",
        directed: false,
    }));
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    let step = 0;

    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of visualEdges) e.state = "idle";
    };
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: visualEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    const comps = new Map<string, Component>();
    const owner = new Map<string, string>();
    for (const v of vertices) {
        const heap = new EdgeHeap(edges);
        edges.forEach(([a, b], index) => {
            if (a === v || b === v) heap.push(index);
        });
        comps.set(v, { id: v, vertices: new Set([v]), heap });
        owner.set(v, v);
    }

    clear();
    yield snap(
        `Cheriton-Tarjan starts with ${comps.size} components, each holding a meldable heap of incident edges.`,
        0,
        { cost: 0, accepted: 0, components: comps.size },
    );
    step += 1;

    /** Peek at the cheapest heap edge leaving a component, discarding stale entries. */
    const cheapestLeaving = (comp: Component): number | undefined => {
        const stale: number[] = [];
        let found: number | undefined;
        while (comp.heap.size > 0) {
            const index = comp.heap.peek()!;
            const [a, b] = edges[index]!;
            if (owner.get(a) === owner.get(b)) {
                stale.push(comp.heap.pop()!);
                continue;
            }
            found = index;
            break;
        }
        for (const index of stale) comp.heap.push(index);
        return found;
    };

    const chosen: number[] = [];
    let weight = 0;

    while (comps.size > 1) {
        let pick: { edge: number; compId: string; from: string; to: string; w: number } | null = null;
        for (const comp of comps.values()) {
            const index = cheapestLeaving(comp);
            if (index === undefined) continue;
            const [a, b, w] = edges[index]!;
            const ra = owner.get(a) as string;
            const rb = owner.get(b) as string;
            const to = ra === comp.id ? b : a;
            const from = ra === comp.id ? a : b;
            if (!pick || w < pick.w) pick = { edge: index, compId: comp.id, from, to, w };
        }
        if (!pick) break;

        const compA = comps.get(pick.compId) as Component;
        const compB = comps.get(owner.get(pick.to) as string) as Component;
        if (!compA || !compB || compA.id === compB.id) break;

        compA.heap.meld(compB.heap);
        const mergedVertices = new Set([...compA.vertices, ...compB.vertices]);
        const newId = compA.id < compB.id ? compA.id : compB.id;
        comps.delete(compA.id);
        comps.delete(compB.id);
        comps.set(newId, { id: newId, vertices: mergedVertices, heap: compA.heap });
        for (const v of mergedVertices) owner.set(v, newId);

        chosen.push(pick.edge);
        weight += pick.w;

        clear();
        for (const v of mergedVertices) {
            const n = byLabel.get(v);
            if (n) n.state = "active";
        }
        for (const index of chosen) {
            const e = visualEdges[index];
            if (e) e.state = "path";
        }
        yield snap(
            `Meld heaps across ${pick.from}-${pick.to} of weight ${pick.w}; ${comps.size} component(s) remain.`,
            3,
            { cost: weight, accepted: chosen.length, components: comps.size },
        );
        step += 1;
    }

    clear();
    for (const index of chosen) {
        const e = visualEdges[index];
        if (e) e.state = "path";
    }
    yield snap(
        `Spanning tree complete with weight ${weight} and ${chosen.length} edge(s).`,
        6,
        { cost: weight, optimal: kruskal(vertices, edges), accepted: chosen.length, components: comps.size },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine growing Prim's algorithm from every vertex at the same time. Each component keeps a priority queue of edges leaving it. The cheapest valid edge is taken, the two components are joined, and their queues are melded. Using a meldable heap makes the join essentially free, which is why Cheriton-Tarjan beats sorting the edges.",
        invariants: [
            "Each component's heap contains exactly the edges incident to its vertices, including stale entries.",
            "The chosen edge is the cheapest edge crossing between two distinct components.",
            "Adding a chosen edge never creates a cycle, so the accumulated edges form a forest.",
        ],
        correctness:
            "The cheapest edge leaving a component is the lightest edge of the cut defined by that component, so the cut property says it is safe to add. Melding the two heaps preserves the invariant that every incident edge is represented, and after V minus one merges the single component spans every vertex with minimum total weight.",
        complexityRationale:
            "With a meldable heap, joining two heaps costs O(1) amortized and each extract-min costs O(log log V), giving O(E log log V) total. The components, ownership map, and heaps together use O(V + E) space.",
        uses: [
            "Building spanning trees without a global edge sort",
            "A faster theoretical alternative to Kruskal for dense graphs",
            "Illustrating meldable heaps in a classic graph problem",
        ],
        references: [
            "Cheriton and Tarjan, Finding Minimum Spanning Trees, 1976",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning trees",
        ],
        workedExample:
            "Starting from six vertices, the cheapest leaving edge B-C of weight 1 merges B and C and melds their heaps. The next cheapest leaving edge A-C of weight 2 joins A, and continuing until one component remains yields a tree of weight 16.",
    },
    id: "cheriton-tarjan-mst",
    name: "Cheriton-Tarjan MST",
    category: "mst",
    complexity: { time: "O(E log log V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "create one component per vertex with a heap of incident edges",
        "for each component peek at the cheapest edge leaving it",
        "select the globally cheapest such edge",
        "find the two components at the edge endpoints",
        "meld their heaps into a single component",
        "repeat until one component remains",
        "done: report the spanning tree weight",
    ],
};

export default module;
