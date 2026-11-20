/**
 * dijkstra-approximate.ts - (1+epsilon) Approximate Shortest Paths
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Exact Dijkstra orders vertices by their precise tentative distance. This
 * approximation groups distances into buckets whose radii grow by a factor
 * (1 + epsilon). Vertices are settled bucket by bucket instead of one at a
 * time. A relaxation that lands in an earlier bucket is kept in the current
 * bucket, so the search never walks backward. Every reported distance is the
 * length of a real path, and it is at most (1 + epsilon) times optimal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E) * B) with B distance buckets, about log_{1+eps}(W * V)
 *   Space: O(V + E + B) for distances, buckets, and edge entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Settled vertices are GREEN; frontier vertices are BLUE.
 *   - The edge that last improved a distance flashes ORANGE.
 *   - meta reports the bucket radii, epsilon, and the target estimate.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: WAdj;
            start?: string;
            target?: string;
            epsilon?: number;
        } | null) ?? {};
    const graph: WAdj = task.graph ?? {
        A: [
            ["B", 4],
            ["C", 2],
        ],
        B: [["D", 5]],
        C: [
            ["B", 1],
            ["D", 8],
            ["E", 3],
        ],
        D: [["F", 2]],
        E: [["F", 4]],
        F: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((pairs) => pairs.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeWeightedEdges(graph);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        line: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: line,
        layout: "graph" as const,
        meta,
    });

    if (labels.length === 0) {
        yield snap("Empty graph - no distances to estimate.", 0, {
            settled: 0,
            bucketCount: 0,
            epsilon: 0.5,
        });
        return;
    }

    const epsilon = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 0.5;
    const base = 1 + epsilon;
    const start = task.start && graph[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? labels[labels.length - 1];
    const weights = Object.values(graph).flatMap((pairs) => pairs.map(([, w]) => w));
    const maxWeight = weights.length > 0 ? Math.max(1, ...weights) : 1;
    const maxDist = maxWeight * Math.max(1, labels.length - 1);
    const bucketCount = Math.max(1, Math.ceil(Math.log(maxDist + 1) / Math.log(base)) + 1);
    const bucketOf = (d: number): number =>
        d <= 1 ? 0 : Math.min(bucketCount, Math.floor(Math.log(d) / Math.log(base)));

    const dist = new Map(labels.map((v) => [v, Infinity]));
    const parent = new Map<string, string | null>(labels.map((v) => [v, null]));
    const place = new Map(labels.map((v) => [v, -1]));
    const settled = new Set<string>();
    const buckets: string[][] = Array.from({ length: bucketCount + 1 }, () => []);
    dist.set(start, 0);
    place.set(start, 0);
    buckets[0]?.push(start);

    yield snap(
        `Estimating distances from ${start} with factor ${base.toFixed(2)} across ${bucketCount} buckets.`,
        0,
        { epsilon, base, settled: 0, bucketCount, targetDistance: -1 },
    );
    step += 1;

    let guard = 0;
    const guardLimit = 200 * labels.length * labels.length + 2000;
    for (let i = 0; i <= bucketCount; i += 1) {
        const bucket = buckets[i];
        if (!bucket) continue;
        while (bucket.length > 0) {
            guard += 1;
            if (guard > guardLimit) break;
            let pickAt = 0;
            for (let k = 1; k < bucket.length; k += 1) {
                const a = bucket[k];
                const b = bucket[pickAt];
                if (a !== undefined && b !== undefined && (dist.get(a) as number) < (dist.get(b) as number))
                    pickAt = k;
            }
            const u = bucket.splice(pickAt, 1)[0];
            if (u === undefined || place.get(u) !== i || settled.has(u)) continue;
            settled.add(u);
            clear();
            for (const v of settled) setN(v, "sorted");
            setN(u, "active");
            for (const [v] of graph[u] ?? []) {
                if (settled.has(v)) continue;
                setN(v, "highlight");
            }
            for (const [v, w] of graph[u] ?? []) {
                const nd = (dist.get(u) as number) + w;
                if (nd < (dist.get(v) as number)) {
                    dist.set(v, nd);
                    parent.set(v, u);
                    const j = bucketOf(nd);
                    const t = j < i ? i : j;
                    place.set(v, t);
                    const dest = buckets[t];
                    if (dest) dest.push(v);
                    setE(u, v, "swapped");
                }
            }
            yield snap(
                `Bucket ${i}: settle ${u} at estimate ${dist.get(u)}; ${settled.size} vertex(es) finalized.`,
                3,
                {
                    epsilon,
                    base,
                    bucketCount,
                    settled: settled.size,
                    currentBucket: i,
                    targetDistance: Number.isFinite(dist.get(target)) ? (dist.get(target) as number) : -1,
                },
            );
            step += 1;
        }
    }

    clear();
    const path: string[] = [];
    let cur: string | null = target;
    const seenPath = new Set<string>();
    while (cur !== null && !seenPath.has(cur)) {
        seenPath.add(cur);
        path.unshift(cur);
        cur = parent.get(cur) ?? null;
    }
    const reachable = path.length > 0 && path[0] === start;
    if (reachable) {
        for (const v of path) setN(v, "path");
        for (let k = 0; k + 1 < path.length; k += 1) setE(path[k] as string, path[k + 1] as string, "path");
    }
    const answer = Number.isFinite(dist.get(target)) ? (dist.get(target) as number) : -1;
    yield snap(
        reachable
            ? `Target ${target} estimate ${answer}; every estimate is a real path length within factor ${base.toFixed(2)} of optimal.`
            : `Target ${target} is unreachable from ${start}.`,
        7,
        {
            epsilon,
            base,
            bucketCount,
            settled: settled.size,
            targetDistance: answer,
            path: reachable ? path.join(">") : "",
            labels: labels,
            estimates: labels.map((v) => (Number.isFinite(dist.get(v)) ? (dist.get(v) as number) : -1)),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of a heap ordered by exact distance, put vertices into buckets whose radii grow geometrically. Empty the low buckets first. Because every bucket spans only a small range of distances, a vertex can be wrong by at most the bucket growth factor, which buys a large speedup in exchange for a controlled error.",
        invariants: [
            "Every tentative distance equals the length of some real path, so it never undercuts the true distance.",
            "Buckets are processed in increasing index order and no relaxation ever moves a vertex to an earlier bucket.",
            "A vertex is settled at most once.",
        ],
        correctness:
            "Distances only ever become the sum of inspected positive edge weights, so each reported value is at least the true shortest distance. When a relaxation would place a vertex in an earlier bucket it is kept in the current bucket, so the search never revisits a lower bucket; at the time a bucket is finished, any still-shorter route would have had to come from a vertex in the same or earlier bucket, which has already been inspected. The geometric bucket spacing then bounds the overestimate by the factor 1 + epsilon.",
        complexityRationale:
            "There are B = O(log_{1+eps}(W * V)) buckets where W is the largest edge weight. Each edge relaxation costs constant work plus bucket bookkeeping, giving O((V + E) * B) time; distances, parent links, buckets, and edges use O(V + E + B) space.",
        uses: [
            "Fast approximate routing on very large road networks",
            "Precomputing distance oracles where a small stretch is acceptable",
            "Graph neural network message passing that needs only near-shortest hops",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, single-source shortest paths",
            "Erdmann, Approximation Algorithms for Shortest Paths (bucket-based schemes)",
        ],
        workedExample:
            "With epsilon 1/2 the bucket radii are 1, 1.5, 2.25, and so on. If a vertex is reached at length 2 it sits in bucket 1 and is settled before any vertex at length 3, even though both are close. The reported length is a genuine path length that cannot exceed 1.5 times the optimum.",
    },
    id: "dijkstra-approximate",
    name: "Approximate Dijkstra ((1+epsilon) Buckets)",
    category: "shortest-path",
    complexity: { time: "O((V + E) log_{1+eps}(W V))", space: "O(V + E + B)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 4],
                ["C", 2],
            ],
            B: [["D", 5]],
            C: [
                ["B", 1],
                ["D", 8],
                ["E", 3],
            ],
            D: [["F", 2]],
            E: [["F", 4]],
            F: [],
        },
        start: "A",
        target: "F",
        epsilon: 0.5,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "choose bucket base 1 + epsilon and bucket count from max weight",
        "distance[start] = 0; place start in bucket 0",
        "for each bucket in increasing order",
        "take the closest vertex still placed in this bucket",
        "for each edge to a neighbor compute a candidate distance",
        "if the candidate improves, update distance and parent",
        "put the neighbor in its own bucket or the current one",
        "stop when every bucket is empty",
        "done: report the target estimate and its path",
    ],
};

export default module;
