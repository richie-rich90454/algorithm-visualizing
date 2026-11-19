/**
 * frontier-a-star.ts - Frontier A* (Bucketed Open List).
 *
 * Frontier A* keeps its open set as a "frontier" of buckets indexed by integer
 * f-value rather than a binary heap. All nodes with the same f sit in one
 * bucket, so extraction is a constant-time scan of the bucket keys. This is
 * especially effective when edge weights and heuristics are small integers,
 * as on grid maps and token-passing puzzles.
 *
 * Time:  O(E + V * F) worst case, where F is the range of integer f-values
 * Space: O(V + F)
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

interface Result {
    path: string[];
    cost: number;
    expansions: Array<{ node: string; f: number; frontier: number }>;
}

function neighbors(wadj: WAdj, v: string): Array<[string, number]> {
    const out: Array<[string, number]> = [...(wadj[v] ?? [])];
    for (const [source, adj] of Object.entries(wadj)) {
        if (source === v) continue;
        for (const [target, weight] of adj) if (target === v) out.push([source, weight]);
    }
    return out;
}

function frontierAStar(wadj: WAdj, coords: Coords, start: string, goal: string): Result {
    const h = (v: string): number => {
        const a = coords[v];
        const b = coords[goal];
        if (!a || !b) return 0;
        return Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]));
    };
    const g = new Map<string, number>([[start, 0]]);
    const parent = new Map<string, string>();
    const buckets = new Map<number, string[]>();
    const push = (f: number, label: string): void => {
        const bucket = buckets.get(f);
        if (bucket) bucket.push(label);
        else buckets.set(f, [label]);
    };
    push(h(start), start);
    const expansions: Result["expansions"] = [];

    for (let guard = 0; buckets.size > 0 && guard < 2000; guard += 1) {
        let minF = Infinity;
        for (const key of buckets.keys()) if (key < minF) minF = key;
        const bucket = buckets.get(minF) as string[];
        const node = bucket.pop() as string;
        if (bucket.length === 0) buckets.delete(minF);
        expansions.push({ node, f: minF, frontier: [...buckets.values()].reduce((n, b) => n + b.length, 0) });
        if (node === goal) {
            const path: string[] = [];
            let cursor: string | undefined = goal;
            while (cursor !== undefined) {
                path.unshift(cursor);
                if (cursor === start) break;
                cursor = parent.get(cursor);
            }
            return { path, cost: g.get(goal) as number, expansions };
        }
        for (const [next, weight] of neighbors(wadj, node)) {
            const ng = (g.get(node) as number) + weight;
            if (ng >= (g.get(next) ?? Infinity)) continue;
            g.set(next, ng);
            parent.set(next, node);
            push(ng + h(next), next);
        }
    }
    return { path: [], cost: Infinity, expansions };
}

function dijkstra(wadj: WAdj, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(wadj)) dist.set(v, Infinity);
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of wadj[u] ?? []) dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
    }
    return dist.get(goal) ?? Infinity;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: WAdj; coords?: Coords; start?: string; goal?: string } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 2], ["C", 4]],
        B: [["D", 3], ["E", 6]],
        C: [["D", 1], ["E", 5]],
        D: [["F", 3]],
        E: [["F", 2]],
        F: [],
    };
    const coords: Coords = task.coords ?? {
        A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
    };
    const start = task.start ?? "A";
    const goal = task.goal ?? "F";
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((es) => es.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(wadj);
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const result = frontierAStar(wadj, coords, start, goal);
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
        `Frontier A* from ${start}: open nodes are grouped into buckets by integer f = g + h.`,
        0,
        { cost: -1, optimal: dijkstra(wadj, start, goal), frontier: 1 },
    );
    step += 1;

    for (const exp of result.expansions.slice(0, 30)) {
        clear();
        const active = byLabel.get(exp.node);
        if (active) active.state = "active";
        yield snap(
            `Pop ${exp.node} from the f=${exp.f} bucket; ${exp.frontier} node(s) remain across the frontier buckets.`,
            2,
            { cost: -1, optimal: dijkstra(wadj, start, goal), frontier: exp.frontier, f: exp.f },
        );
        step += 1;
    }

    clear();
    for (const v of result.path) {
        const n = byLabel.get(v);
        if (n) n.state = "path";
    }
    for (let i = 0; i + 1 < result.path.length; i += 1) {
        const e = edges.find(
            (x) =>
                (x.sourceId === `node-${result.path[i]}` && x.targetId === `node-${result.path[i + 1]}`) ||
                (x.sourceId === `node-${result.path[i + 1]}` && x.targetId === `node-${result.path[i]}`),
        );
        if (e) e.state = "path";
    }
    yield snap(
        `Goal expanded: ${result.path.join(" -> ")} costs ${result.cost} after ${result.expansions.length} bucket extraction(s).`,
        7,
        {
            cost: Number.isFinite(result.cost) ? result.cost : -1,
            optimal: dijkstra(wadj, start, goal),
            path: result.path,
            expansions: result.expansions.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Frontier A* organizes the open set as buckets indexed by integer f-value instead of a binary heap. Every node with the same f lives in one bucket, and the next node comes from the lowest nonempty bucket. When weights and heuristics are small integers, this removes comparison and heap-rebalancing cost while keeping A*'s behavior.",
        invariants: [
            "A node is filed in the bucket whose index equals its current f = g + h.",
            "The lowest nonempty bucket always holds a minimum-f open node.",
            "A node's g value only decreases, so later bucket entries supersede older ones.",
        ],
        correctness:
            "Pulling from the lowest nonempty bucket is identical to extracting a minimum from a priority queue. With an admissible heuristic, A* expands the goal with minimum f first, so the reconstructed predecessor chain is a shortest path. The integer ceiling of Euclidean distance is still admissible when every edge cost is at least its Euclidean length.",
        complexityRationale:
            "Finding the lowest nonempty bucket takes O(F) in the simple implementation, so the total is O(E + V F) for an f-value range F; each node and edge is processed once, and buckets plus g values use O(V + F) space.",
        uses: [
            "Grid pathfinding with integer step costs",
            "Puzzle solvers with small bounded heuristics",
            "Teaching the relationship between heaps and bucket queues",
        ],
        references: [
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths (1968)",
            "Dial, Algorithm 360: Shortest-Path Forest with Topological Ordering (1969)",
        ],
        workedExample:
            "From A with h(A)=3, the start enters bucket 3. Expanding A places B in bucket 4 and C in bucket 6. The next extraction comes from bucket 4, and the search proceeds bucket by bucket until the goal is popped from the lowest nonempty bucket.",
    },
    id: "frontier-a-star",
    name: "Frontier A* (Bucketed Open List)",
    category: "shortest-path",
    complexity: { time: "O(E + V * F)", space: "O(V + F)" },
    defaultInput: {
        graph: {
            A: [["B", 2], ["C", 4]],
            B: [["D", 3], ["E", 6]],
            C: [["D", 1], ["E", 5]],
            D: [["F", 3]],
            E: [["F", 2]],
            F: [],
        },
        coords: {
            A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
        },
        start: "A",
        goal: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute integer heuristic h for each vertex from coordinates",
        "place the start in the bucket indexed h start",
        "find the lowest nonempty frontier bucket",
        "pop a node from that bucket and expand it",
        "stop if the node is the goal and reconstruct its path",
        "for each neighbor compute tentative g plus h",
        "if improved, file the neighbor in the corresponding bucket",
        "repeat until no buckets remain",
        "done: report the shortest path and its cost",
    ],
};

export default module;
