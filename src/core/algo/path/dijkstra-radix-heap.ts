/**
 * dijkstra-radix-heap.ts - Dijkstra with a Radix Heap.
 *
 * A radix heap is a monotone priority queue: extracted keys never decrease.
 * It keeps 33 buckets indexed by the most significant differing bit between a
 * key and the last extracted key. Because Dijkstra extracts vertices in
 * nondecreasing distance order, the radix heap runs in O(E log C) time for
 * integer weights bounded by C, and O(E + V) in the common small-integer case.
 *
 * Time:  O((E + V) log C) for integer weights in [0, C]
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;

interface Item {
    key: number;
    label: string;
}

/** Monotone radix heap for nonnegative integer keys. */
class RadixHeap {
    private buckets: Item[][] = Array.from({ length: 33 }, () => []);
    private last = 0;
    size = 0;

    private static bucket(xor: number): number {
        if (xor === 0) return 0;
        return Math.min(32, 1 + Math.floor(Math.log2(xor)));
    }

    push(key: number, label: string): void {
        if (key < this.last) throw new Error("radix heap requires monotone keys");
        this.buckets[RadixHeap.bucket(key ^ this.last)]?.push({ key, label });
        this.size += 1;
    }

    pop(): Item | undefined {
        if (this.buckets[0]?.length === 0) {
            let i = 1;
            while (i < this.buckets.length && (this.buckets[i]?.length ?? 0) === 0) i += 1;
            if (i === this.buckets.length) return undefined;
            const bucket = this.buckets[i] as Item[];
            let minKey = Infinity;
            for (const item of bucket) minKey = Math.min(minKey, item.key);
            this.last = minKey;
            const moved = bucket.splice(0, bucket.length);
            for (const item of moved) {
                this.buckets[RadixHeap.bucket(item.key ^ this.last)]?.push(item);
            }
        }
        const item = this.buckets[0]?.pop();
        if (item) this.size -= 1;
        return item;
    }
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        graph?: WAdj;
        vertices?: string[];
        edges?: Array<[string, string, number]>;
        start?: string;
        target?: string;
    } | null) ?? {};
    const wadj: WAdj = {};
    let edgeList: Array<[string, string, number]>;
    if (task.graph) {
        edgeList = [];
        for (const [u, adj] of Object.entries(task.graph)) {
            wadj[u] = [...adj];
            for (const [v, w] of adj) {
                edgeList.push([u, v, w]);
                if (!wadj[v]) wadj[v] = [];
            }
        }
    } else {
        edgeList = task.edges ?? [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ];
        for (const [u, v, w] of edgeList) {
            if (!wadj[u]) wadj[u] = [];
            if (!wadj[v]) wadj[v] = [];
            wadj[u]?.push([v, w]);
            wadj[v]?.push([u, w]);
        }
    }
    const labels = task.vertices ?? Object.keys(wadj);
    const start = task.start ?? "A";
    const target = task.target ?? "F";
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(
        task.graph ?? Object.fromEntries(
            labels.map((u) => [u, edgeList.filter(([a]) => a === u).map(([, v, w]) => [v, w] as [string, number])]),
        ),
    );
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const dist = new Map<string, number>(labels.map((v) => [v, Infinity]));
    const pred = new Map<string, string>();
    dist.set(start, 0);
    const heap = new RadixHeap();
    heap.push(0, start);
    let step = 0;
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    const snap = (description: string, codeLineNumber: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    clear();
    yield snap(
        `Dijkstra with a radix heap from ${start}: integer keys are grouped by their most significant differing bit.`,
        0,
        { cost: -1, settled: 0 },
    );
    step += 1;

    let settled = 0;
    for (let guard = 0; heap.size > 0 && guard < 2000; guard += 1) {
        const item = heap.pop();
        if (!item) break;
        if (item.key !== dist.get(item.label)) continue;
        settled += 1;
        clear();
        const active = byLabel.get(item.label);
        if (active) active.state = "active";
        const relaxed: string[] = [];
        for (const [next, w] of wadj[item.label] ?? []) {
            const candidate = item.key + w;
            if (candidate < (dist.get(next) ?? Infinity)) {
                dist.set(next, candidate);
                pred.set(next, item.label);
                heap.push(candidate, next);
                relaxed.push(next);
                const edge = edges.find(
                    (x) =>
                        (x.sourceId === `node-${item.label}` && x.targetId === `node-${next}`) ||
                        (x.sourceId === `node-${next}` && x.targetId === `node-${item.label}`),
                );
                if (edge) edge.state = "comparing";
            }
        }
        yield snap(
            `Settle ${item.label} at distance ${item.key}; ${relaxed.length} neighbor label(s) lowered and pushed into the radix heap.`,
            relaxed.length > 0 ? 3 : 2,
            { cost: Number.isFinite(dist.get(target)) ? Number(dist.get(target)) : -1, settled },
        );
        step += 1;
    }

    clear();
    const path: string[] = [];
    let cursor: string | undefined = target;
    while (cursor !== undefined) {
        path.unshift(cursor);
        if (cursor === start) break;
        cursor = pred.get(cursor);
    }
    if (path[0] === start && Number.isFinite(dist.get(target))) {
        for (const v of path) {
            const n = byLabel.get(v);
            if (n) n.state = "path";
        }
        for (let i = 0; i + 1 < path.length; i += 1) {
            const e = edges.find(
                (x) =>
                    (x.sourceId === `node-${path[i]}` && x.targetId === `node-${path[i + 1]}`) ||
                    (x.sourceId === `node-${path[i + 1]}` && x.targetId === `node-${path[i]}`),
            );
            if (e) e.state = "path";
        }
    }
    const cost = dist.get(target) ?? Infinity;
    yield snap(
        Number.isFinite(cost)
            ? `All buckets drained. Shortest route ${path.join(" -> ")} costs ${cost}.`
            : `All buckets drained. ${target} is unreachable from ${start}.`,
        6,
        {
            cost: Number.isFinite(cost) ? cost : -1,
            optimal: Number.isFinite(cost) ? cost : -1,
            path,
            settled,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A radix heap exploits the fact that Dijkstra pulls vertices in nondecreasing distance order. Keys are stored in 33 buckets according to the highest bit where they differ from the last extracted value. When the lowest bucket empties, the heap redistributes one bucket around the new minimum, avoiding the logarithmic comparisons of a binary heap for small integer weights.",
        invariants: [
            "Every item's key is at least the last extracted key.",
            "All items in bucket i share the same most significant differing bit.",
            "A vertex is settled only when its popped key equals its current distance.",
        ],
        correctness:
            "Redistribution never moves an item to a bucket with a higher index, so the last extracted key is always the smallest live key. Popping the minimum and relaxing outgoing edges therefore follows exactly the same order as a binary-heap Dijkstra, and the standard Dijkstra correctness argument gives shortest distances.",
        complexityRationale:
            "Each item is pushed once per relaxation and moved through at most 33 (log C) buckets, giving O((E + V) log C) time for maximum weight C; the buckets and distance tables take O(V + E) space.",
        uses: [
            "Shortest paths with bounded integer edge weights",
            "High-throughput graph engines where heap comparisons dominate",
            "Monotone priority queues in discrete-event simulation",
        ],
        references: [
            "Ahuja, Mehlhorn, Orlin, and Tarjan, Faster Algorithms for the Shortest Path Problem (1990)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, shortest paths",
        ],
        workedExample:
            "Starting at A with distance 0, edges A-C(2) and A-B(4) are pushed. The minimum key becomes 2, so the heap rebuckets around 2 and next settles C, which lowers B to 3 and D to 10, mirroring binary-heap Dijkstra with cheaper integer operations.",
    },
    id: "dijkstra-radix-heap",
    name: "Dijkstra (Radix Heap)",
    category: "shortest-path",
    complexity: { time: "O((E + V) log C)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ],
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set all distances to infinity and the source to zero",
        "insert the source with key zero into the radix heap",
        "extract the item with the smallest key from the lowest bucket",
        "if its key differs from its distance, discard the stale entry",
        "for each outgoing edge, try to lower the neighbor's distance",
        "insert improved distances into the heap under their new key",
        "when bucket zero is empty, rebucket around the new minimum key",
        "repeat until the heap is empty",
        "done: report the shortest path to the target",
    ],
};

export default module;
