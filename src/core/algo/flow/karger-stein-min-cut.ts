/**
 * karger-stein-min-cut.ts - Karger-Stein Recursive Minimum Cut
 *
 * Contract random edges only down to about n divided by the square root of
 * two, run the process twice, keep the better contraction, and recurse. The
 * recursion catches cuts that random contraction could destroy early while
 * keeping the success probability high.
 *
 * Time: O(n^2 log n) expected. Space: O(n + m).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { vertices?: string[]; edges?: Array<[string, string, number]>; seed?: number };
type Graph = { groups: string[][]; edges: Array<[number, number, number]> };

function rng(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const vertices = Array.isArray(task.vertices)
        ? [...task.vertices].map(String)
        : ["a", "b", "c", "d", "e", "f"];
    const edgeList: Array<[string, string, number]> = Array.isArray(task.edges)
        ? task.edges.map(([u, v, w]) => [String(u), String(v), Math.max(0, Math.floor(w))])
        : [
              ["a", "b", 3], ["a", "c", 2], ["b", "c", 4], ["b", "d", 1],
              ["c", "d", 5], ["c", "e", 3], ["d", "e", 2], ["d", "f", 4], ["e", "f", 6],
          ];
    const random = rng(task.seed ?? 17);
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const frames: VisualFrame[] = [];
    let step = 0;
    let contractions = 0;
    let recursions = 0;

    const initial: Graph = {
        groups: vertices.map((label) => [label]),
        edges: edgeList
            .filter(([u, v]) => index.has(u) && index.has(v) && index.get(u) !== index.get(v))
            .map(([u, v, w]) => [index.get(u) ?? 0, index.get(v) ?? 0, w] as [number, number, number]),
    };

    const emit = (graph: Graph, sinkIndex: number, message: string, line: number, best: number, extra: Record<string, number | string | boolean> = {}): void => {
        const entities: VisualEntity[] = graph.groups.map((group, i) => ({
            id: `group-${i}`,
            type: "node",
            label: group.join("+"),
            value: group.join("+"),
            state: i === sinkIndex ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { members: group.length },
        }));
        frames.push({
            stepNumber: step,
            entities,
            edges: graph.edges.map(([a, b, w], i) => ({
                id: `edge-${i}-${a}-${b}`,
                sourceId: `group-${a}`,
                targetId: `group-${b}`,
                label: String(w),
                state: "idle",
                directed: false,
            })),
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                groups: graph.groups.length,
                edges: graph.edges.length,
                contractions,
                recursions,
                bestCut: best,
                ...extra,
            },
        });
        step += 1;
    };

    const bruteForce = (graph: Graph): { value: number; side: number[] } => {
        const n = graph.groups.length;
        let best = Infinity;
        let side: number[] = [];
        for (let mask = 1; mask < (1 << n) - 1; mask += 1) {
            let value = 0;
            for (const [a, b, w] of graph.edges) {
                if (((mask >> a) & 1) !== ((mask >> b) & 1)) {
                    value += w;
                }
            }
            if (value < best) {
                best = value;
                side = Array.from({ length: n }, (_, i) => i).filter((i) => ((mask >> i) & 1) === 1);
            }
        }
        return { value: best, side };
    };

    const contract = (graph: Graph, target: number): Graph => {
        const parent = graph.groups.map((_, i) => i);
        const find = (x: number): number => {
            let root = x;
            while (parent[root] !== root) {
                root = parent[root] as number;
            }
            return root;
        };
        let count = graph.groups.length;
        let guard = 0;
        while (count > target && guard < 10000) {
            guard += 1;
            const candidates = graph.edges.filter(([a, b]) => find(a) !== find(b));
            if (candidates.length === 0) {
                break;
            }
            const chosen = candidates[Math.floor(random() * candidates.length)] as [number, number, number];
            const a = find(chosen[0]);
            const b = find(chosen[1]);
            parent[b] = a;
            count -= 1;
            contractions += 1;
            const groups: string[][] = [];
            const remap = new Map<number, number>();
            for (let i = 0; i < graph.groups.length; i += 1) {
                const root = find(i);
                if (!remap.has(root)) {
                    remap.set(root, groups.length);
                    groups.push([]);
                }
                groups[remap.get(root) as number]?.push(...(graph.groups[i] ?? []));
            }
            const contracted: Graph = {
                groups,
                edges: graph.edges
                    .filter(([u, v]) => find(u) !== find(v))
                    .map(([u, v, w]) => [remap.get(find(u)) ?? 0, remap.get(find(v)) ?? 0, w] as [number, number, number]),
            };
            emit(
                contracted,
                remap.get(a) ?? -1,
                `Contracted ${chosen[0]} and ${chosen[1]} (weight ${chosen[2]}); ${count} supernode(s) remain.`,
                3,
                Infinity,
            );
            return contract(contracted, target);
        }
        if (count === graph.groups.length) {
            return graph;
        }
        const groups: string[][] = [];
        const remap = new Map<number, number>();
        for (let i = 0; i < graph.groups.length; i += 1) {
            const root = find(i);
            if (!remap.has(root)) {
                remap.set(root, groups.length);
                groups.push([]);
            }
            groups[remap.get(root) as number]?.push(...(graph.groups[i] ?? []));
        }
        return {
            groups,
            edges: graph.edges
                .filter(([u, v]) => find(u) !== find(v))
                .map(([u, v, w]) => [remap.get(find(u)) ?? 0, remap.get(find(v)) ?? 0, w] as [number, number, number]),
        };
    };

    interface Result { value: number; members: string[] }
    const solve = (graph: Graph): Result => {
        recursions += 1;
        if (graph.groups.length <= 6 || graph.edges.length === 0) {
            const answer = bruteForce(graph);
            const members = answer.side.flatMap((i) => graph.groups[i] ?? []);
            emit(graph, -1, `Base case: brute-force cut ${answer.value} on ${graph.groups.length} supernode(s).`, 1, answer.value, {
                baseCut: answer.value,
            });
            return { value: answer.value, members };
        }
        const target = Math.ceil(graph.groups.length / Math.SQRT2) + 1;
        let best: Result = { value: Infinity, members: [] };
        for (let trial = 0; trial < 2; trial += 1) {
            const contracted = contract(graph, target);
            const sub = solve(contracted);
            if (sub.value < best.value) {
                best = sub;
            }
        }
        emit(graph, -1, `Recursive step on ${graph.groups.length} groups: best cut ${best.value}.`, 7, best.value);
        return best;
    };

    if (vertices.length < 2) {
        emit(initial, -1, "Fewer than two vertices - no cut exists.", 0, 0, { bestCut: 0 });
        yield* frames;
        return;
    }

    emit(initial, -1, `Karger-Stein recursive min cut on ${vertices.length} vertices.`, 0, Infinity);
    // Karger-Stein finds the minimum with high probability; repeat the whole
    // recursion a bounded number of times so the small demo reliably succeeds.
    let answer: Result = { value: Infinity, members: [] };
    const outerTrials = Math.max(4, Math.min(vertices.length * 2, 24));
    for (let t = 0; t < outerTrials; t += 1) {
        const candidate = solve(initial);
        if (candidate.value < answer.value) {
            answer = candidate;
        }
    }
    emit(initial, -1, `Global minimum cut is ${answer.value}, side ${answer.members.join(", ") || "empty"}.`, 7, answer.value, {
        bestCut: answer.value,
        side: answer.members.join(","),
    });
    yield* frames;
}

const module: AlgorithmModule = {
    id: "karger-stein-min-cut",
    name: "Karger-Stein Minimum Cut",
    category: "flow",
    complexity: { time: "O(n² log n) expected", space: "O(n + m)" },
    defaultInput: {
        vertices: ["a", "b", "c", "d", "e", "f"],
        edges: [
            ["a", "b", 3], ["a", "c", 2], ["b", "c", 4], ["b", "d", 1],
            ["c", "d", 5], ["c", "e", 3], ["d", "e", 2], ["d", "f", 4], ["e", "f", 6],
        ],
        seed: 17,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "if the graph is small, enumerate all cuts directly",
        "set the contraction target to n divided by the square root of two",
        "contract random edges until the target number of supernodes remains",
        "run the contraction process twice independently",
        "recurse on the contracted graph with the smaller cut",
        "map the recursive cut back to original vertices",
        "repeat until the base case returns a cut value",
        "report the minimum cut and one side of the partition",
    ],
    education: {
        intuition:
            "Plain random contraction must avoid every edge of the minimum cut, which becomes unlikely on large graphs. Karger and Stein stop contraction halfway, try it twice, and recurse on the better result. The recursion gives a second chance to a cut that an early contraction would have destroyed.",
        invariants: [
            "Contracting an edge never removes any cut that does not split that edge's endpoints.",
            "Parallel edges are merged by adding their capacities, preserving every cut value.",
            "A cut of a contracted graph corresponds to a cut of the original graph.",
        ],
        correctness:
            "At the base case every partition is enumerated, so the exact minimum cut of the contracted graph is known. By induction a recursive call returns the minimum cut for its input graph. Contracting two independent samples and taking the better one preserves the recurrence that at least one sample keeps the optimal cut intact with constant probability, so the value returned is the global minimum with high probability.",
        complexityRationale:
            "Each level contracts a constant fraction of the remaining vertices and doubles the number of branches, giving O(n^2 log n) expected work. The residual graph and recursion stack use O(n + m) space.",
        uses: [
            "Minimum cut in large undirected networks",
            "A building block for divide-and-conquer cut algorithms",
            "A teaching example of recursive randomization",
        ],
        references: [
            "Karger and Stein, A New Approach to the Minimum Cut Problem, JACM 1996",
            "Karger, Random Sampling in Cut, Flow, and Network Design Problems, 1994",
        ],
        workedExample:
            "On a six-vertex graph with a light cut separating d and f from the rest, two contraction runs down to about four supernodes may keep or destroy that cut. Recursing on the run with the smaller contracted cut reveals the separating value before it is lost.",
    },
};

export default module;
