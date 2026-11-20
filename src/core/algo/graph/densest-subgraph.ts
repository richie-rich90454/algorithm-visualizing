/**
 * densest-subgraph.ts - Densest k-Subgraph by Exhaustive Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The densest k-subgraph problem asks which k vertices of an undirected graph
 * induce the largest number of edges. This module solves it exactly by
 * enumerating every k-element subset, counting the edges internal to each one,
 * and remembering the best. Density is the induced edge count divided by the
 * maximum possible number of edges among k vertices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C(n, k) * (n + m)) for n vertices and m edges
 *   Space: O(n + m) for the graph plus the current best subset
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices in the candidate subset turn BLUE (active); the others stay
 *     gray (unvisited).
 *   - Edges induced by the subset turn GREEN (path); all other edges idle.
 *   - The final frame paints the optimal subset GREEN (sorted).
 */

import type {
    AlgorithmModule,
    EntityState,
    VisualEdge,
    VisualEntity,
    VisualFrame,
} from "@/types";
import { makeGraphNodes } from "./graph-util";

interface DenseInput {
    graph?: Record<string, string[]>;
    k?: number;
}

/** Canonical key for an undirected edge, independent of endpoint order. */
function edgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Collect sorted vertex labels and the unique undirected edges of a graph. */
function normalize(graph: Record<string, string[]>): {
    labels: string[];
    pairs: Array<[string, string]>;
} {
    const seen = new Map<string, true>();
    const pairs: Array<[string, string]> = [];
    for (const [source, neighbors] of Object.entries(graph)) {
        for (const target of neighbors) {
            if (source === target) {
                continue;
            }
            const key = edgeKey(source, target);
            if (seen.has(key)) {
                continue;
            }
            seen.set(key, true);
            pairs.push([source < target ? source : target, source < target ? target : source]);
        }
    }
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    return { labels, pairs };
}

/** Build undirected edge entities for the current graph. */
function buildEdges(pairs: Array<[string, string]>): VisualEdge[] {
    return pairs.map(([a, b]) => ({
        id: `edge-${a}-${b}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
}

/** Number of set bits in a nonnegative integer. */
function popcount(value: number): number {
    let count = 0;
    let v = value;
    while (v > 0) {
        count += v & 1;
        v >>>= 1;
    }
    return count;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DenseInput | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D", "E"],
        D: ["A", "C", "E"],
        E: ["C", "D"],
        F: [],
    };
    const { labels, pairs } = normalize(graph);
    const n = labels.length;
    const k = Math.max(0, Math.min(n, Math.floor(task.k ?? 3)));
    const maxEdges = (k * (k - 1)) / 2;
    const edges = buildEdges(pairs);

    const emit = (
        step: number,
        selected: Set<string>,
        induced: Set<string>,
        description: string,
        codeLineNumber: number,
        extra: VisualFrame["meta"],
    ): VisualFrame => {
        const baseNodes: VisualEntity[] =
            labels.length > 0
                ? makeGraphNodes(labels)
                : [
                      {
                          id: "node-empty",
                          type: "node",
                          label: "",
                          value: "",
                          state: "unvisited",
                          x: 0,
                          y: 0,
                          width: 0,
                          height: 0,
                          metadata: { label: "" },
                      },
                  ];
        const entities: VisualEntity[] = baseNodes.map((node) => {
            const label = String(node.metadata["label"]);
            return { ...node, state: (selected.has(label) ? "active" : "unvisited") as EntityState };
        });
        const frameEdges: VisualEdge[] = edges.map((edge) => ({
            ...edge,
            state: (induced.has(edge.id) ? "path" : "idle") as EntityState,
        }));
        return {
            stepNumber: step,
            entities,
            edges: frameEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: extra,
        };
    };

    let step = 0;
    yield emit(
        step,
        new Set(),
        new Set(),
        `Searching for the densest ${k}-vertex subset among ${n} vertices and ${pairs.length} edges.`,
        0,
        { vertices: n, edges: pairs.length, k, subsetsChecked: 0, bestEdges: 0 },
    );
    step += 1;

    let bestMask = 0;
    let bestEdges = -1;
    let bestLabels: string[] = [];
    let subsetsChecked = 0;

    if (n === 0) {
        yield emit(
            step,
            new Set(),
            new Set(),
            "The graph is empty, so the only subset is empty and has no edges.",
            5,
            { bestSubset: [], bestEdges: 0, bestDensity: 0, subsetsChecked: 1, k: 0 },
        );
        return;
    }

    for (let mask = 0; mask < 1 << n; mask += 1) {
        if (popcount(mask) !== k) {
            continue;
        }
        subsetsChecked += 1;
        const selected = new Set<string>();
        for (let i = 0; i < n; i += 1) {
            if (mask & (1 << i)) {
                selected.add(labels[i] as string);
            }
        }
        const induced = new Set<string>();
        let count = 0;
        for (const [a, b] of pairs) {
            if (selected.has(a) && selected.has(b)) {
                induced.add(`edge-${a}-${b}`);
                count += 1;
            }
        }
        const density = maxEdges === 0 ? 0 : count / maxEdges;
        if (count > bestEdges) {
            bestEdges = count;
            bestMask = mask;
            bestLabels = [...selected];
        }
        yield emit(
            step,
            selected,
            induced,
            `Subset {${[...selected].join(", ")}} induces ${count} edge(s); density ${density.toFixed(2)}.`,
            3,
            {
                subset: [...selected],
                inducedEdges: count,
                density,
                bestEdges: Math.max(0, bestEdges),
                subsetsChecked,
            },
        );
        step += 1;
    }

    const bestSelected = new Set<string>();
    for (let i = 0; i < n; i += 1) {
        if (bestMask & (1 << i)) {
            bestSelected.add(labels[i] as string);
        }
    }
    const bestInduced = new Set<string>();
    for (const [a, b] of pairs) {
        if (bestSelected.has(a) && bestSelected.has(b)) {
            bestInduced.add(`edge-${a}-${b}`);
        }
    }
    const finalDensity = maxEdges === 0 ? 0 : bestEdges / maxEdges;
    yield emit(
        step,
        bestSelected,
        bestInduced,
        `Densest subset {${bestLabels.join(", ")}} has ${bestEdges} edge(s); density ${finalDensity.toFixed(2)} over ${subsetsChecked} subset(s).`,
        5,
        {
            bestSubset: bestLabels,
            bestEdges: Math.max(0, bestEdges),
            bestDensity: finalDensity,
            subsetsChecked,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The densest group of k people in a social network is the group with the most friendships inside it. With a modest number of vertices we can simply try every possible group of size k, count the internal friendships, and keep the friendliest group we find.",
        invariants: [
            "Every subset of exactly k vertices is examined once.",
            "bestEdges always equals the largest induced edge count seen so far.",
            "An edge is counted only when both of its endpoints lie in the current subset.",
        ],
        correctness:
            "The loop enumerates all C(n, k) subsets. For each subset it counts precisely the edges whose two endpoints are members, which is the definition of an induced edge count. Because every candidate is compared against the running maximum, the subset remaining at the end must attain the global maximum induced edge count.",
        complexityRationale:
            "There are C(n, k) subsets, and for each we scan up to n vertices and m edges, giving O(C(n, k) * (n + m)) time. Only the vertex list, the edge set, and the current best subset are stored, so space is O(n + m).",
        uses: [
            "Finding tightly connected groups in social and communication networks",
            "Detecting protein complexes in biological interaction graphs",
            "Identifying dense clusters as a first step in community detection",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, 3rd ed., Ch. 22",
            "Wikipedia, 'Densest k-subgraph'",
        ],
        workedExample:
            "On a path A-B-C-D with k = 2 the subsets of size two are {A,B}, {B,C} and {C,D}, each with one induced edge, so all three tie with density 1. On a triangle A-B-C plus isolated D with k = 3, only {A,B,C} has three induced edges and is the unique optimum.",
    },
    id: "densest-subgraph",
    name: "Densest k-Subgraph",
    category: "graph",
    complexity: { time: "O(C(n, k) * (n + m))", space: "O(n + m)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D", "E"],
            D: ["A", "C", "E"],
            E: ["C", "D"],
            F: [],
        },
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected edge set from the adjacency lists",
        "enumerate every vertex subset of size k",
        "count edges whose two endpoints lie in the subset",
        "compare the count with the best count seen so far",
        "keep the subset attaining the highest count",
        "done: report the densest subset, count and density",
    ],
};

export default module;
