/**
 * karger-k-cut.ts - Karger Minimum k-Cut
 *
 * Random contraction down to k supernodes produces a k-way cut. Many seeded
 * trials sample different partitions, and the cheapest one is kept. On small
 * instances an exhaustive partition check verifies the randomized answer.
 *
 * Time: O(trials * m) with a small exhaustive check for tiny graphs.
 * Space: O(n + m).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { vertices?: string[]; edges?: Array<[string, string, number]>; k?: number; seed?: number; trials?: number };
type Edge = [number, number, number];

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
    const n = vertices.length;
    const k = Math.max(1, Math.min(n, Math.floor(task.k ?? 3)));
    const trials = Math.max(1, Math.min(2000, Math.floor(task.trials ?? 600)));
    const random = rng(task.seed ?? 23);
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const edges: Edge[] = edgeList
        .filter(([u, v]) => index.has(u) && index.has(v) && index.get(u) !== index.get(v))
        .map(([u, v, w]) => [index.get(u) ?? 0, index.get(v) ?? 0, w] as Edge);
    const frames: VisualFrame[] = [];
    let step = 0;
    let contractions = 0;

    const cutValue = (groups: number[]): number => {
        let value = 0;
        for (const [a, b, w] of edges) {
            if (groups[a] !== groups[b]) {
                value += w;
            }
        }
        return value;
    };

    const emit = (groups: number[], message: string, line: number, best: number, extra: Record<string, number | string | boolean> = {}): void => {
        const labels = new Map<number, string[]>();
        for (let i = 0; i < n; i += 1) {
            const g = groups[i] ?? 0;
            labels.set(g, [...(labels.get(g) ?? []), vertices[i] ?? "?"]);
        }
        const memberships = new Map<number, number>();
        for (let i = 0; i < n; i += 1) {
            memberships.set(i, groups[i] ?? 0);
        }
        const entities: VisualEntity[] = vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node",
            label: `${label}:part${groups[i] ?? 0}`,
            value: label,
            state: (groups[i] ?? 0) === 0 ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, part: groups[i] ?? 0 },
        }));
        frames.push({
            stepNumber: step,
            entities,
            edges: edgeList.map(([u, v, w], i) => ({
                id: `edge-${i}`,
                sourceId: `node-${u}`,
                targetId: `node-${v}`,
                label: String(w),
                state: groups[index.get(u) ?? 0] !== groups[index.get(v) ?? 0] ? "path" : "idle",
                directed: false,
            })),
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertices: n,
                edges: edgeList.length,
                k,
                contractions,
                bestCut: best,
                parts: labels.size,
                ...extra,
            },
        });
        step += 1;
    };

    if (n < 2 || k === 1) {
        const groups = new Array<number>(n).fill(0);
        emit(groups, k === 1 ? "One part - there is no k-cut to compute." : "Fewer than two vertices - no cut exists.", 0, 0, { bestCut: 0 });
        yield* frames;
        return;
    }

    const contract = (showFrames: boolean): number[] => {
        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (x: number): number => {
            let root = x;
            while (parent[root] !== root) {
                root = parent[root] as number;
            }
            return root;
        };
        let count = n;
        let guard = 0;
        while (count > k && guard < n * n + 10) {
            guard += 1;
            const candidates = edges.filter(([a, b]) => find(a) !== find(b));
            if (candidates.length === 0) {
                break;
            }
            const chosen = candidates[Math.floor(random() * candidates.length)] as Edge;
            const rootA = find(chosen[0]);
            const rootB = find(chosen[1]);
            parent[rootB] = rootA;
            count -= 1;
            contractions += 1;
            if (showFrames) {
                const snapshot = Array.from({ length: n }, (_, i) => find(i));
                emit(snapshot, `Trial 1 contracted vertices ${chosen[0]} and ${chosen[1]} (weight ${chosen[2]}); ${count} parts remain.`, 3, Infinity);
            }
        }
        return Array.from({ length: n }, (_, i) => find(i));
    };

    let bestGroups = new Array<number>(n).fill(0);
    let bestValue = Infinity;
    for (let trial = 0; trial < trials; trial += 1) {
        const groups = contract(trial === 0);
        const value = cutValue(groups);
        if (value < bestValue) {
            bestValue = value;
            bestGroups = groups;
        }
        if (trial === 0 || (trial + 1) % Math.max(1, Math.floor(trials / 5)) === 0) {
            emit(groups, `Trial ${trial + 1}/${trials}: k-cut value ${value}, best ${bestValue}.`, 4, bestValue, { trial: trial + 1 });
        }
    }

    // Exhaustive verification keeps small visual examples exact.
    if (n <= 8) {
        const assignment = new Array<number>(n).fill(0);
        let used = 1;
        const search = (at: number): void => {
            if (at === n) {
                if (used !== k) {
                    return;
                }
                const value = cutValue(assignment);
                if (value < bestValue) {
                    bestValue = value;
                    bestGroups = [...assignment];
                }
                return;
            }
            for (let g = 0; g < Math.min(k, used + 1); g += 1) {
                const introduced = g === used;
                if (introduced) {
                    used += 1;
                }
                assignment[at] = g;
                search(at + 1);
                if (introduced) {
                    used -= 1;
                }
            }
        };
        search(0);
    }

    emit(bestGroups, `Minimum ${k}-cut has value ${bestValue} across ${vertices.length} vertices.`, 6, bestValue, {
        bestCut: bestValue,
        verified: n <= 8,
    });
    yield* frames;
}

const module: AlgorithmModule = {
    id: "karger-k-cut",
    name: "Karger Minimum k-Cut",
    category: "flow",
    complexity: { time: "O(trials·m)", space: "O(n + m)" },
    defaultInput: {
        vertices: ["a", "b", "c", "d", "e", "f"],
        edges: [
            ["a", "b", 3], ["a", "c", 2], ["b", "c", 4], ["b", "d", 1],
            ["c", "d", 5], ["c", "e", 3], ["d", "e", 2], ["d", "f", 4], ["e", "f", 6],
        ],
        k: 3,
        seed: 23,
        trials: 600,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize every vertex as its own part",
        "while more than k parts remain",
        "choose a random edge joining two different parts",
        "merge the two parts and discard internal edges",
        "sum the weights still crossing parts to get the cut value",
        "repeat many independent trials and keep the cheapest k-cut",
        "verify small instances by enumerating all k-way partitions",
        "report the best k-way partition and its value",
    ],
    education: {
        intuition:
            "The minimum k-cut splits a graph into k groups while crossing as little total weight as possible. Random contraction merges vertices until only k groups remain; if none of the contracted edges belonged to the optimal cut, the resulting partition is exactly what we want. Trying many seeded runs turns that chance into a reliable answer.",
        invariants: [
            "Edges inside a merged part never contribute to the cut value.",
            "Every trial always ends with exactly k nonempty parts when the graph is connected enough.",
            "The best value never increases as more trials are examined.",
        ],
        correctness:
            "A contraction sequence returns the optimum whenever it never contracts an edge of some minimum k-cut. Repeating independent seeded trials makes that event likely, and the exhaustive partition enumeration used for small instances guarantees the displayed answer is exact. Each evaluated partition's value is computed directly from the original edges.",
        complexityRationale:
            "One contraction sequence joins n minus k parts and scans the edge list each time, costing O(nm); all trials take O(trials times m) with the given bound. The parent array, edge list, and best partition use O(n + m) space.",
        uses: [
            "Dividing networks into balanced components",
            "Preprocessing for divide-and-conquer graph algorithms",
            "Clustering where the number of groups is fixed in advance",
        ],
        references: [
            "Karger, Global Min-Cuts in RNC and Other Ramifications of a Simple Min-Cut Algorithm, SODA 1993",
            "Goldschmidt and Hochbaum, A Polynomial Algorithm for the k-Cut Problem, 1994",
        ],
        workedExample:
            "On the six-vertex sample graph with k equals three, a trial may merge a with b, c with d, and e with f. If the total weight crossing these groups is nine, that becomes the best cut; further trials or the exhaustive check decide whether a cheaper three-way split exists.",
    },
};

export default module;
