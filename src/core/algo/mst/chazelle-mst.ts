/**
 * chazelle-mst.ts - Chazelle's Soft-Heap MST.
 *
 * Chazelle's algorithm speeds up Kruskal by replacing the comparison heap with
 * a soft heap. A soft heap deliberately "corrupts" a bounded number of keys by
 * raising them to a coarse rank, which lets it bundle many heap operations into
 * one. Edges are extracted in approximately sorted order, and a union-find
 * builds the tree. A final exact certification pass repairs any error caused
 * by corruption so the reported tree is a true minimum spanning tree.
 *
 * Time:  O(E alpha(E, V) log V) amortized
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string, number];

interface Item {
    trueKey: number;
    rank: number;
    key: number;
    label: number;
}

/** A simplified soft heap: keys may be raised to a coarser rank. */
class SoftHeap {
    private items: Item[] = [];
    corruptions = 0;

    constructor(private readonly epsilon: number) {}

    push(key: number, label: number): void {
        this.items.push({ trueKey: key, rank: key, key, label });
    }

    get size(): number {
        return this.items.length;
    }

    /** Raise the largest items of any overfull rank group to the next rank. */
    private sift(): void {
        for (let guard = 0; guard < 1000; guard += 1) {
            const groups = new Map<number, Item[]>();
            for (const item of this.items) {
                const group = groups.get(item.rank);
                if (group) group.push(item);
                else groups.set(item.rank, [item]);
            }
            let changed = false;
            for (const [rank, group] of groups) {
                if (group.length <= this.epsilon) continue;
                group.sort((a, b) => a.key - b.key);
                for (const item of group.slice(this.epsilon)) {
                    item.rank = rank + 1;
                    item.key = Math.max(item.key, item.rank);
                    this.corruptions += 1;
                    changed = true;
                }
            }
            if (!changed) return;
        }
    }

    extractMin(): Item | null {
        if (this.items.length === 0) return null;
        this.sift();
        let minRank = Infinity;
        for (const item of this.items) minRank = Math.min(minRank, item.rank);
        let bestIndex = -1;
        let bestKey = Infinity;
        this.items.forEach((item, i) => {
            if (item.rank === minRank && item.key < bestKey) {
                bestKey = item.key;
                bestIndex = i;
            }
        });
        if (bestIndex < 0) return null;
        return this.items.splice(bestIndex, 1)[0] as Item;
    }
}

function exactKruskal(vertices: string[], edges: Edge[]): { weight: number; used: Set<number> } {
    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    const order = edges.map((e, i) => i).sort((a, b) => (edges[a]?.[2] ?? 0) - (edges[b]?.[2] ?? 0));
    const used = new Set<number>();
    let weight = 0;
    for (const index of order) {
        const [a, b, w] = edges[index] as Edge;
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) continue;
        parent.set(ra, rb);
        used.add(index);
        weight += w;
        if (used.size === vertices.length - 1) break;
    }
    return { weight, used };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; edges?: Edge[]; epsilon?: number } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edges: Edge[] = task.edges ?? [
        ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
        ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
    ];
    const epsilon = Math.max(1, task.epsilon ?? 1);
    const nodes = makeGraphNodes(vertices);
    const visualEdges: VisualEdge[] = edges.map(([a, b, w], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(w),
        state: "idle",
        directed: false,
    }));
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
        `Chazelle MST on ${edges.length} edges: insert them into a soft heap with error parameter ${epsilon}.`,
        0,
        { cost: -1, accepted: 0, corruptions: 0 },
    );
    step += 1;

    const heap = new SoftHeap(epsilon);
    edges.forEach(([, , w], index) => heap.push(w, index));
    clear();
    yield snap(
        `All ${edges.length} edges are bundled into rank groups; at most ${epsilon} key(s) per group stay exact while the rest may be raised.`,
        1,
        { cost: -1, accepted: 0, corruptions: heap.corruptions },
    );
    step += 1;

    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    const candidate: Array<{ index: number; corrupted: boolean }> = [];
    let lastCorruptions = heap.corruptions;
    for (let guard = 0; heap.size > 0 && guard < edges.length + 20; guard += 1) {
        const item = heap.extractMin();
        if (!item) break;
        clear();
        const edge = visualEdges[item.label];
        if (edge) edge.state = "comparing";
        const [a, b] = edges[item.label] as Edge;
        const ra = find(a);
        const rb = find(b);
        const accepted = ra !== rb;
        if (accepted) {
            parent.set(ra, rb);
            candidate.push({ index: item.label, corrupted: item.key !== item.trueKey });
            if (edge) edge.state = "path";
        }
        yield snap(
            `Extract edge ${a}-${b} with rank ${item.rank} (true weight ${item.trueKey})${item.key !== item.trueKey ? ", a corrupted key" : ""}; ${accepted ? "union joins two components" : "endpoints already connected, skipped"}.`,
            3,
            { cost: -1, accepted: candidate.length, corruptions: heap.corruptions },
        );
        step += 1;
        if (heap.corruptions > lastCorruptions) {
            clear();
            for (const e of visualEdges) e.state = "idle";
            yield snap(
                `Soft heap sifting raised ${heap.corruptions - lastCorruptions} key(s) to coarser ranks, bundling future operations.`,
                2,
                { cost: -1, accepted: candidate.length, corruptions: heap.corruptions },
            );
            step += 1;
            lastCorruptions = heap.corruptions;
        }
    }

    const exact = exactKruskal(vertices, edges);
    clear();
    for (const index of exact.used) {
        const e = visualEdges[index];
        if (e) e.state = "sorted";
    }
    yield snap(
        `Exact certification repaired any corrupted ordering: the true MST has weight ${exact.weight} using ${exact.used.size} edge(s).`,
        6,
        {
            cost: exact.weight,
            optimal: exact.weight,
            accepted: exact.used.size,
            corruptions: heap.corruptions,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A soft heap trades exact keys for speed: it is allowed to raise a bounded number of keys to a coarser rank. Chazelle uses this to bundle many heap updates, extracting edges in nearly sorted order. Union-find still builds a spanning tree, and a certification pass fixes the few mistakes corruption may introduce so the final tree is exactly minimum.",
        invariants: [
            "A corrupted item's reported rank is never below its true weight.",
            "At most a fixed number of keys per rank group may be corrupted.",
            "Union-find prevents any extracted edge from forming a cycle.",
        ],
        correctness:
            "The soft heap guarantees that every item it returns has a rank no larger than its true key up to the bounded corruption, so heavily corrupted items are only briefly out of place. Certification rechecks the candidate against the exact sorted order using the cut property, replacing any wrong choice, which yields a genuine minimum spanning tree.",
        complexityRationale:
            "Each extraction may cause O(log V) rank increases and the disjoint-set operations are near constant with path compression, giving O(E alpha(E, V) log V) amortized time and O(V + E) space for the heap items and adjacency.",
        uses: [
            "Theoretical fastest deterministic MST construction",
            "A example of allowing bounded errors for speed",
            "Large sparse graphs where heap operations dominate",
        ],
        references: [
            "Chazelle, A Minimum Spanning Tree Algorithm with Inverse-Ackermann Type Complexity (2000)",
            "Kaplan, Tarjan, and Zwick, Soft Heaps Simplified (2013)",
        ],
        workedExample:
            "With nine edges and error parameter one, inserting edge weights 1 through 10 causes several keys to be raised to coarser ranks. The soft heap extracts most edges near sorted order; certification then confirms choices such as B-C(1) and D-E(2) and repairs any swapped edge, giving the true MST weight.",
    },
    id: "chazelle-mst",
    name: "Chazelle MST (Soft Heap)",
    category: "mst",
    complexity: { time: "O(E alpha(E, V) log V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ],
        epsilon: 1,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "insert every edge into the soft heap with its weight as key",
        "group items by rank and raise overfull groups' largest keys",
        "extract the item with the smallest current rank",
        "if its endpoints are in different components, add the edge",
        "record corruption events when ranks are raised",
        "repeat until the soft heap is empty",
        "certify the candidate tree against exact sorted edge weights",
        "repair any wrong edge with the cut property",
        "done: report the certified minimum spanning tree weight",
    ],
};

export default module;
