/**
 * mehlhorn-shortest-path.ts - Mehlhorn Two-Level Bucket SSSP
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When edge weights are small nonnegative integers, a priority queue can be
 * replaced by buckets indexed by distance. Mehlhorn's idea is to use two
 * levels: a coarse block index and a fine offset inside the block. Finding the
 * next vertex scans only the current block and the remaining top blocks,
 * avoiding both a heap's logarithmic factor and Dial's scan over every
 * possible distance. Relaxations insert a vertex into the bucket matching its
 * new tentative distance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E + n * sqrt(C)) with two levels and max edge weight C
 *   Space: O(n + C) for the bucket table and distance array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Graph nodes show the current distance as their value.
 *   - Settled nodes are GREEN, frontier nodes ORANGE, the current node YELLOW.
 *   - Relaxed edges flash BLUE and are reset before the next vertex.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "../graph/graph-util";

const defaultGraph: Record<string, Array<[string, number]>> = {
    A: [
        ["B", 2],
        ["C", 5],
    ],
    B: [
        ["C", 1],
        ["D", 4],
    ],
    C: [["D", 2]],
    D: [],
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, Array<[string, number]>>; start?: string } | null) ?? {};
    const graph = task.graph && typeof task.graph === "object" ? task.graph : defaultGraph;
    const labels = [...new Set([
        ...Object.keys(graph),
        ...Object.values(graph).flatMap((list) => (Array.isArray(list) ? list.map(([v]) => String(v)) : [])),
    ])];
    const clean = Object.fromEntries(
        Object.entries(graph).map(([u, list]) => [
            u,
            (Array.isArray(list) ? list : []).filter(([v, w]) => v !== undefined && Number.isFinite(w) && Number(w) >= 0)
                .map(([v, w]) => [String(v), Number(w)] as [string, number]),
        ]),
    );

    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const stringAdj: Record<string, string[]> = Object.fromEntries(
        Object.entries(clean).map(([u, list]) => [u, list.map(([v]) => v)]),
    );
    const edges = makeGraphEdges(stringAdj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const start = task.start && clean[task.start] !== undefined ? task.start : (labels[0] ?? "A");

    const maxWeight = Math.max(1, ...Object.values(clean).flatMap((list) => list.map(([, w]) => w)));
    const bound = Math.max(2, (labels.length + 1) * (maxWeight + 1));
    let bits = 0;
    while (2 ** bits <= bound) {
        bits += 1;
    }
    const lowBits = Math.max(1, Math.floor(bits / 2));
    const blockSize = 2 ** lowBits;
    const blockCount = Math.ceil((bound + 1) / blockSize) + 2;
    const blocks: Array<Array<Array<string>>> = Array.from({ length: blockCount }, () =>
        Array.from({ length: blockSize }, () => []),
    );

    const dist = new Map<string, number>(labels.map((v) => [v, Infinity]));
    const settled = new Set<string>();
    const frontier = new Set<string>([start]);
    let minBlock = 0;
    let step = 0;
    let relaxations = 0;

    const push = (vertex: string, distance: number): void => {
        const block = Math.floor(distance / blockSize);
        const offset = distance % blockSize;
        while (blocks.length <= block) {
            blocks.push(Array.from({ length: blockSize }, () => []));
        }
        blocks[block]![offset]!.push(vertex);
        if (block < minBlock) {
            minBlock = block;
        }
    };
    const pop = (): { vertex: string; distance: number } | null => {
        for (let b = minBlock; b < blocks.length; b += 1) {
            for (let o = 0; o < blockSize; o += 1) {
                const bucket = blocks[b]![o]!;
                if (bucket.length > 0) {
                    const vertex = bucket.pop()!;
                    minBlock = b;
                    return { vertex, distance: b * blockSize + o };
                }
            }
        }
        return null;
    };

    const frame = (description: string, codeLineNumber: number, active: string): VisualFrame => ({
        stepNumber: step++,
        entities: nodes.map((n) => {
            const v = String(n.metadata["label"]);
            return {
                ...n,
                value: Number.isFinite(dist.get(v) ?? Infinity) ? dist.get(v)! : -1,
                label: `${v}:${Number.isFinite(dist.get(v) ?? Infinity) ? dist.get(v) : "inf"}`,
                state: (v === active
                    ? "comparing"
                    : settled.has(v)
                      ? "sorted"
                      : frontier.has(v)
                        ? "highlight"
                        : "unvisited") as EntityState,
            };
        }),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta: {
            start,
            settled: settled.size,
            relaxations,
            blockSize,
            distances: labels.map((v) => (Number.isFinite(dist.get(v) ?? Infinity) ? dist.get(v)! : -1)),
        },
    });

    if (labels.length === 0) {
        yield frame("Empty graph - no shortest paths to compute.", 0, "");
        return;
    }

    dist.set(start, 0);
    push(start, 0);
    yield frame(`Two-level bucket SSSP from ${start}; blocks hold ${blockSize} distance buckets each.`, 0, "");

    let guard = 0;
    for (;;) {
        guard += 1;
        if (guard > 10000) {
            break;
        }
        const item = pop();
        if (!item) {
            break;
        }
        const { vertex, distance } = item;
        if (settled.has(vertex) || distance !== dist.get(vertex)) {
            continue;
        }
        settled.add(vertex);
        frontier.delete(vertex);
        const current = byId.get(`node-${vertex}`);
        if (current) {
            current.state = "active";
        }
        yield frame(`Settle ${vertex} at distance ${distance} using the smallest non-empty bucket.`, 2, vertex);

        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [next, weight] of clean[vertex] ?? []) {
            const candidate = distance + weight;
            if (candidate < (dist.get(next) ?? Infinity)) {
                dist.set(next, candidate);
                frontier.add(next);
                push(next, candidate);
                relaxations += 1;
                const edge = edges.find(
                    (e) => e.sourceId === `node-${vertex}` && e.targetId === `node-${next}`,
                );
                if (edge) {
                    edge.state = "active";
                }
                yield frame(`Relax ${vertex} to ${next}: tentative distance becomes ${candidate}.`, 4, vertex);
            }
        }
    }

    const reachable = labels.filter((v) => Number.isFinite(dist.get(v) ?? Infinity)).length;
    yield frame(
        `Shortest paths from ${start} settled for ${reachable} reachable vertex(s) after ${relaxations} relaxation(s).`,
        7,
        "",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "With small integer weights, distances are integers and can index an array of buckets. Instead of one huge array, use two: a coarse block number and a fine offset inside that block. The next vertex is the smallest non-empty bucket at or after the current block, so finding a minimum is a short scan rather than a heap operation or a sweep over every possible distance.",
        invariants: [
            "A vertex is placed in the bucket indexed by its current tentative distance.",
            "Once settled, a vertex's distance never changes again.",
            "The scan never moves the lower block bound backward.",
        ],
        correctness:
            "The bucket queue always extracts an unsettled vertex of minimum tentative distance, which is the same requirement Dijkstra places on its priority queue. Because all weights are nonnegative, any route through an unsettled vertex is at least its tentative distance, so settling it is safe; the standard Dijkstra exchange argument then shows every final distance is optimal. Stale entries are ignored by comparing the popped distance with the stored one.",
        complexityRationale:
            "Two levels with block size about sqrt(C) cost O(sqrt(C)) to find the next non-empty bucket and O(1) to insert, so O(E + n sqrt(C)) time for maximum edge weight C. The bucket table and distance map use O(n + C) space.",
        uses: [
            "Shortest paths on road networks with integer travel times",
            "Grid and game maps with small movement costs",
            "A faster alternative to binary heaps when weights are bounded integers",
        ],
        references: [
            "Mehlhorn, Data Structures and Algorithms 2: Graph Algorithms and NP-Completeness, 1984",
            "Dial, Algorithm 360: Shortest-Path Forest with Topological Ordering, 1969",
        ],
        workedExample:
            "From A with A-B cost 2 and A-C cost 5, both A's neighbors are inserted into buckets 2 and 5. B is settled first and relaxes C to 4, so a fresh entry for C appears in bucket 4. That entry is popped before the stale 5, and C's final distance is 4.",
    },
    id: "mehlhorn-shortest-path",
    name: "Mehlhorn Two-Level Bucket Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(E + n sqrt(C))", space: "O(n + C)" },
    defaultInput: { graph: defaultGraph, start: "A" },
    visualType: "graph",
    run,
    pseudocode: [
        "compute the maximum integer edge weight C",
        "size coarse blocks of sqrt(C) fine distance buckets",
        "put the source in bucket zero with distance zero",
        "while some bucket is non-empty",
        "extract the nearest vertex from the lowest non-empty bucket",
        "skip stale entries whose distance has since improved",
        "relax each outgoing edge and insert improved neighbors",
        "done: report the settled distance of every reachable vertex",
    ],
};

export default module;
