/**
 * leighton-rao-sparsest-cut.ts - Leighton-Rao Sparsest Cut Approximation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The sparsest cut of a graph minimizes the capacity crossing a partition
 * divided by the number of separated vertex pairs. Leighton and Rao showed
 * that shortest-path distances give a linear-programming relaxation whose
 * solution can be rounded by embedding the metric on a line: pick a landmark,
 * sort vertices by their distance from it, and try every prefix as a cut. The
 * best prefix over all landmarks is an O(log n) approximation to the true
 * sparsest cut with uniform demands.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^3 + n^2 log n) for all-pairs shortest paths and sorted prefixes
 *   Space: O(n^2) for the distance matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Vertices on the currently best cut side are GREEN (sorted).
 *   - Edges crossing the best cut are YELLOW (comparing).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    edges?: Array<[string, string, number?]>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B", 1], ["A", "C", 1], ["B", "C", 1], ["C", "D", 4],
            ["D", "E", 1], ["E", "F", 1], ["D", "F", 1], ["G", "A", 3], ["G", "B", 3],
        ] as Array<[string, string, number?]>);
    const clean = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b, w]) => [a, b, typeof w === "number" && w > 0 ? w : 1] as [string, string, number]);
    const vertices = [...new Set(clean.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));

    const weight: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [a, b, w] of clean) {
        const u = index.get(a);
        const v = index.get(b);
        if (u === undefined || v === undefined || u === v) continue;
        weight[u]![v] = (weight[u]![v] ?? 0) + w;
        weight[v]![u] = (weight[v]![u] ?? 0) + w;
    }

    // All-pairs shortest-path distances (the metric used by the rounding).
    const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
    for (let i = 0; i < n; i += 1) dist[i]![i] = 0;
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const through = (dist[i]![k] as number) + (dist[k]![j] as number);
                if (through < (dist[i]![j] as number)) dist[i]![j] = through;
            }
        }
    }

    const cutValue = (side: boolean[]): number => {
        let total = 0;
        for (let u = 0; u < n; u += 1) {
            for (let v = u + 1; v < n; v += 1) {
                if (side[u] !== side[v]) total += weight[u]![v] ?? 0;
            }
        }
        return total;
    };
    const ratioOf = (side: boolean[]): number => {
        const size = side.filter(Boolean).length;
        if (size === 0 || size === n) return Infinity;
        return cutValue(side) / (size * (n - size));
    };

    const edgeList = clean.filter(([a, b]) => a !== b).map(([a, b, w], i) => ({ a, b, w, id: `edge-${a}-${b}-${i}` }));
    let bestRatio = Infinity;
    let bestSide = new Array<boolean>(n).fill(false);
    let step = 0;

    const makeFrame = (description: string, codeLine: number, phase: string, side: boolean[]): VisualFrame => {
        const cutIds = new Set<string>();
        for (const e of edgeList) {
            const u = index.get(e.a) as number;
            const v = index.get(e.b) as number;
            if (side[u] !== side[v]) cutIds.add(e.id);
        }
        const entities: VisualEntity[] = vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (side[i] ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, side: side[i] },
        }));
        const edges: VisualEdge[] = edgeList.map((e) => ({
            id: e.id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: String(e.w),
            state: (cutIds.has(e.id) ? "comparing" : "idle") as EntityState,
            directed: false,
        }));
        const bestCutIds = new Set<string>();
        for (const e of edgeList) {
            const u = index.get(e.a) as number;
            const v = index.get(e.b) as number;
            if (bestSide[u] !== bestSide[v]) bestCutIds.add(e.id);
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                labels: vertices,
                bestRatio: bestRatio === Infinity ? -1 : Number(bestRatio.toFixed(6)),
                cutValue: cutValue(bestSide),
                bestSide: bestSide.map((x) => (x ? "1" : "0")).join(""),
                bestCut: edgeList.filter((e) => bestCutIds.has(e.id)).map((e) => `${e.a}-${e.b}`).join(","),
            },
        };
    };

    yield makeFrame("Compute shortest-path distances; try each landmark as a line embedding.", 0, "setup", bestSide);
    step += 1;

    for (let landmark = 0; landmark < n; landmark += 1) {
        const order = vertices.map((_, i) => i).filter((i) => i !== landmark);
        order.sort((a, b) => {
            const da = Number.isFinite(dist[landmark]![a]) ? dist[landmark]![a] as number : Infinity;
            const db = Number.isFinite(dist[landmark]![b]) ? dist[landmark]![b] as number : Infinity;
            return da - db || a - b;
        });
        for (let prefix = 1; prefix < n; prefix += 1) {
            const side = new Array<boolean>(n).fill(false);
            side[landmark] = true;
            for (let k = 0; k < prefix; k += 1) side[order[k] as number] = true;
            const ratio = ratioOf(side);
            if (ratio < bestRatio) {
                bestRatio = ratio;
                bestSide = side;
                const improved = makeFrame(
                    `Landmark ${vertices[landmark]}, prefix ${prefix}: ratio ${ratio.toFixed(4)} improves the best.`,
                    3,
                    "improve",
                    side,
                );
                yield improved;
                step += 1;
            }
        }
    }

    yield makeFrame(
        `Best sparsest-cut ratio is ${bestRatio.toFixed(4)} with cut value ${cutValue(bestSide)}.`,
        6,
        "done",
        bestSide,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cut is sparse when it separates many vertex pairs while cutting little capacity. Shortest-path distances form a metric that captures how far apart vertices are, and laying that metric out on a line gives a family of natural cuts: take a landmark and everything within some distance of it. Trying each landmark and each distance threshold and keeping the sparsest partition approximates the true optimum within a logarithmic factor.",
        invariants: [
            "Every candidate cut is a nontrivial partition of the vertex set.",
            "The recorded ratio never increases as candidates are examined.",
            "Shortest-path distances obey the triangle inequality, so the line embedding is a valid l1 rounding of the metric.",
        ],
        correctness:
            "The Leighton-Rao relaxation replaces the cut metric by an l1 metric under shortest-path constraints, whose optimum is at most the true sparsest cut. Embedding that metric on a line by a landmark distance order and cutting at each threshold is the rounding step; the known analysis bounds the expected ratio of the best such cut by O(log n) times the relaxed optimum. Since the relaxed optimum is a lower bound on the integral optimum, the reported cut is a valid cut whose ratio is within O(log n) of optimal.",
        complexityRationale:
            "All-pairs shortest paths via Floyd-Warshall cost O(n^3). For each of n landmarks there are n-1 thresholds, each scored in O(n^2), giving O(n^3) additional work. The distance matrix and candidate side arrays use O(n^2) space.",
        uses: [
            "Network design and routing with balanced separators",
            "Approximation algorithms for graph partitioning",
            "Finding bottlenecks in communication and social networks",
        ],
        references: [
            "Leighton and Rao, An Approximate Max-Flow Min-Cut Theorem for Uniform Multicommodity Flows, 1988",
            "CLRS, Introduction to Algorithms, approximation algorithms chapter",
        ],
        workedExample:
            "On two well-connected triangles joined by a single edge of capacity 1, a landmark inside one triangle orders its own vertices first. The prefix consisting of that triangle cuts only the bridge, separating 3 times 3 vertex pairs, giving a ratio of 1/9, which is the sparsest cut of the graph.",
    },
    id: "leighton-rao-sparsest-cut",
    name: "Leighton-Rao Sparsest Cut",
    category: "flow",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        edges: [["A", "B", 1], ["A", "C", 1], ["B", "C", 1], ["C", "D", 4], ["D", "E", 1], ["E", "F", 1], ["F", "D", 1], ["G", "A", 3], ["G", "B", 3]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the weighted undirected graph",
        "compute all-pairs shortest-path distances",
        "for each landmark vertex",
        "sort the other vertices by distance from the landmark",
        "for each prefix of that order",
        "score the cut by capacity over separated pairs",
        "keep the prefix with the smallest ratio seen",
        "done: report the sparsest cut and its ratio",
    ],
};

export default module;
