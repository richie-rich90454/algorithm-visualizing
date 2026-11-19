/**
 * fredman-tarjan-mst.ts - Fredman-Tarjan MST (Fibonacci Heap Prim).
 *
 * Prim's algorithm with a Fibonacci heap supports amortized O(1) decrease-key
 * and O(log V) extract-min. That improves the dense-graph bound from
 * O(E log V) to O(E + V log V). The heap defers its restructuring work with
 * lazy trees and a consolidation step, cutting a node from its parent whenever
 * its key drops below the parent's key.
 *
 * Time:  O(E + V log V) amortized
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string, number];

interface FibNode {
    key: number;
    label: string;
    degree: number;
    mark: boolean;
    parent: FibNode | null;
    children: FibNode[];
}

class FibonacciHeap {
    private roots: FibNode[] = [];
    private minimum: FibNode | null = null;
    size = 0;

    insert(key: number, label: string): FibNode {
        const node: FibNode = { key, label, degree: 0, mark: false, parent: null, children: [] };
        this.roots.push(node);
        if (!this.minimum || key < this.minimum.key) this.minimum = node;
        this.size += 1;
        return node;
    }

    private link(a: FibNode, b: FibNode): FibNode {
        if (a.key > b.key) [a, b] = [b, a];
        a.children.push(b);
        b.parent = a;
        b.mark = false;
        a.degree += 1;
        return a;
    }

    private consolidate(): void {
        const byDegree = new Map<number, FibNode>();
        for (const root of this.roots) {
            let current = root;
            let degree = current.degree;
            while (byDegree.has(degree)) {
                const other = byDegree.get(degree) as FibNode;
                current = this.link(current, other);
                byDegree.delete(degree);
                degree = current.degree;
            }
            byDegree.set(degree, current);
        }
        this.roots = [...byDegree.values()];
        this.minimum = null;
        for (const root of this.roots) {
            if (!this.minimum || root.key < this.minimum.key) this.minimum = root;
        }
    }

    extractMin(): FibNode | null {
        const z = this.minimum;
        if (!z) return null;
        const index = this.roots.indexOf(z);
        if (index >= 0) this.roots.splice(index, 1);
        for (const child of z.children) {
            child.parent = null;
            this.roots.push(child);
        }
        z.children = [];
        z.degree = 0;
        this.size -= 1;
        if (this.roots.length === 0) this.minimum = null;
        else this.consolidate();
        return z;
    }

    private cut(x: FibNode, y: FibNode): void {
        const index = y.children.indexOf(x);
        if (index >= 0) y.children.splice(index, 1);
        y.degree -= 1;
        x.parent = null;
        x.mark = false;
        this.roots.push(x);
    }

    private cascadingCut(y: FibNode): void {
        const z = y.parent;
        if (z) {
            if (!y.mark) y.mark = true;
            else {
                this.cut(y, z);
                this.cascadingCut(z);
            }
        }
    }

    decreaseKey(x: FibNode, key: number): void {
        if (key >= x.key) return;
        x.key = key;
        const y = x.parent;
        if (y && x.key < y.key) {
            this.cut(x, y);
            this.cascadingCut(y);
        }
        if (this.minimum && x.key < this.minimum.key) this.minimum = x;
    }
}

function kruskalWeight(vertices: string[], edges: Edge[]): number {
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
        count += 1;
        if (count === vertices.length - 1) break;
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
    const adj = new Map<string, Array<[string, number]>>(vertices.map((v) => [v, []]));
    for (const [a, b, w] of edges) {
        adj.get(a)?.push([b, w]);
        adj.get(b)?.push([a, w]);
    }
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

    clear();
    yield snap(
        `Fredman-Tarjan MST on ${vertices.length} vertices: Prim with a Fibonacci heap for fast decrease-key.`,
        0,
        { cost: -1, accepted: 0 },
    );
    step += 1;

    const heap = new FibonacciHeap();
    const handles = new Map<string, FibNode>();
    const key = new Map<string, number>(vertices.map((v) => [v, Infinity]));
    const parent = new Map<string, string>();
    const start = vertices[0] ?? "A";
    key.set(start, 0);
    for (const v of vertices) handles.set(v, heap.insert(key.get(v) as number, v));
    const mst: string[] = [];
    const inHeap = new Set(vertices);
    let weight = 0;

    for (let guard = 0; heap.size > 0 && guard < vertices.length + 5; guard += 1) {
        const min = heap.extractMin();
        if (!min || !Number.isFinite(min.key)) break;
        const u = min.label;
        inHeap.delete(u);
        mst.push(u);
        const par = parent.get(u);
        if (par) weight += key.get(u) as number;
        clear();
        const active = byLabel.get(u);
        if (active) active.state = "active";
        if (par) {
            const edge = visualEdges.find(
                (e) =>
                    (e.sourceId === `node-${par}` && e.targetId === `node-${u}`) ||
                    (e.sourceId === `node-${u}` && e.targetId === `node-${par}`),
            );
            if (edge) edge.state = "path";
        }
        yield snap(
            `Extract ${u} (key ${min.key})${par ? ` and attach via ${par}-${u}` : " as the root"}; the Fibonacci heap consolidates equal-degree trees.`,
            par ? 4 : 2,
            { cost: weight, accepted: mst.length },
        );
        step += 1;
        for (const [v, w] of adj.get(u) ?? []) {
            const handle = handles.get(v);
            if (!inHeap.has(v) || !handle || w >= (key.get(v) ?? Infinity)) continue;
            key.set(v, w);
            parent.set(v, u);
            heap.decreaseKey(handle, w);
        }
    }

    clear();
    for (const v of mst) {
        const n = byLabel.get(v);
        if (n) n.state = "path";
    }
    for (const v of mst) {
        const par = parent.get(v);
        if (!par) continue;
        const edge = visualEdges.find(
            (e) =>
                (e.sourceId === `node-${par}` && e.targetId === `node-${v}`) ||
                (e.sourceId === `node-${v}` && e.targetId === `node-${par}`),
        );
        if (edge) edge.state = "path";
    }
    yield snap(
        `MST complete with weight ${weight}, matching the cut property; Fibonacci heap kept decrease-key amortized constant.`,
        6,
        {
            cost: weight,
            optimal: kruskalWeight(vertices, edges),
            accepted: mst.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Prim grows one tree by repeatedly adding the cheapest edge that leaves it. A Fibonacci heap stores the best known connecting edge for every vertex outside the tree. When a cheaper edge is found, decrease-key cuts that vertex's heap node from its parent tree, deferring structural work until the next extract-min, which makes the update cheap on average.",
        invariants: [
            "For each outside vertex, its key is the cheapest edge seen so far into the tree.",
            "The heap minimum is the globally cheapest connecting edge.",
            "Adding that edge never creates a cycle because its target is outside the tree.",
        ],
        correctness:
            "The cut property says the lightest edge crossing any cut is safe to add. The heap minimum is exactly that edge for the cut around the current tree, so each extraction adds a safe edge. After V minus one additions the tree spans every vertex and is a minimum spanning tree.",
        complexityRationale:
            "Each of V extract-min calls costs O(log V) amortized and each of E decrease-key calls is O(1) amortized via lazy cutting and consolidation, giving O(E + V log V) time; the heap nodes and adjacency use O(V + E) space.",
        uses: [
            "MST on dense graphs where decrease-key dominates",
            "Network design with many edge-weight updates",
            "A canonical example of amortized analysis",
        ],
        references: [
            "Fredman and Tarjan, Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms (1984)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Fibonacci heaps",
        ],
        workedExample:
            "Starting at A, the heap holds C at 2 and B at 4. Extracting C lowers B to 1 and D to 8 through decrease-key cuts. The next extract is B at 1, and the tree keeps growing by the cheapest frontier edge until all six vertices are connected with weight 16.",
    },
    id: "fredman-tarjan-mst",
    name: "Fredman-Tarjan MST (Fibonacci Heap)",
    category: "mst",
    complexity: { time: "O(E + V log V)", space: "O(V + E)" },
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
        "insert every vertex into a Fibonacci heap with infinite key",
        "set the start vertex key to zero and mark it as the tree root",
        "extract the heap minimum vertex u and add it to the tree",
        "attach u using the edge that gave it its current key",
        "for each neighbor v of u still in the heap",
        "if edge u-v is cheaper than v's key, decrease v's key",
        "cut v from its heap parent and cascade if needed",
        "repeat until the heap is empty",
        "done: report the spanning tree weight",
    ],
};

export default module;
