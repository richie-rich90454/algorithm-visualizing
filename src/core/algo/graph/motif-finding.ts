/**
 * motif-finding.ts - Three-Vertex Motif Census
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A motif census counts how many times each small induced pattern occurs in a
 * graph. This module walks every set of three vertices and classifies it by
 * how many of the three possible edges are present: empty triad, single edge,
 * wedge, or triangle. The four counts sum to the number of triples, which
 * makes the census easy to verify.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) - a constant amount of work per vertex triple
 *   Space: O(V + E) for the symmetrized graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current triple is YELLOW (comparing).
 *   - Edges inside the triple are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualFrame } from "@/types";
import { makeGraphNodes, makeGraphEdges } from "./graph-util";

type Adjacency = Record<string, string[]>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adjacency } | null) ?? {};
    const graph: Adjacency = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["A", "C"],
        E: [],
    };
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [from, targets] of Object.entries(graph)) {
        for (const to of targets) {
            if (from === to || !sets.has(from) || !sets.has(to)) continue;
            sets.get(from)?.add(to);
            sets.get(to)?.add(from);
        }
    }
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(Object.fromEntries([...sets].map(([v, s]) => [v, [...s]])));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
        for (const edge of edges) edge.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    if (labels.length < 3) {
        yield snap(
            `Fewer than three vertices: every triad count is zero.`,
            0,
            { empty: 0, single: 0, wedge: 0, triangle: 0, triples: 0 },
        );
        return;
    }

    const names = ["empty", "single", "wedge", "triangle"];
    const count = [0, 0, 0, 0];
    yield snap(
        `Census of ${labels.length} vertices: ${(labels.length * (labels.length - 1) * (labels.length - 2)) / 6} triples to classify.`,
        0,
        { triples: (labels.length * (labels.length - 1) * (labels.length - 2)) / 6 },
    );
    step += 1;

    let shown = 0;
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            for (let k = j + 1; k < labels.length; k += 1) {
                const a = labels[i] as string;
                const b = labels[j] as string;
                const c = labels[k] as string;
                const trio = [a, b, c];
                let present = 0;
                for (let x = 0; x < 3; x += 1) {
                    for (let y = x + 1; y < 3; y += 1) {
                        if (sets.get(trio[x] as string)?.has(trio[y] as string)) present += 1;
                    }
                }
                count[present] = (count[present] as number) + 1;
                if (shown < 48) {
                    reset();
                    for (const v of trio) {
                        const node = byId.get(`node-${v}`);
                        if (node) node.state = "comparing";
                    }
                    for (let x = 0; x < 3; x += 1) {
                        for (let y = x + 1; y < 3; y += 1) {
                            if (!sets.get(trio[x] as string)?.has(trio[y] as string)) continue;
                            const edge = edges.find((e) =>
                                (e.sourceId === `node-${trio[x]}` && e.targetId === `node-${trio[y]}`) ||
                                (e.sourceId === `node-${trio[y]}` && e.targetId === `node-${trio[x]}`),
                            );
                            if (edge) edge.state = "sorted";
                        }
                    }
                    yield snap(
                        `Triple ${trio.join(", ")} has ${present} edge(s): ${names[present]} motif.`,
                        3,
                        {
                            motif: names[present] as string,
                            present,
                            classified: (count[0] as number) + (count[1] as number) + (count[2] as number) + (count[3] as number),
                        },
                    );
                    step += 1;
                    shown += 1;
                }
            }
        }
    }

    reset();
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Motif census: ${count[0]} empty, ${count[1]} single-edge, ${count[2]} wedge, and ${count[3]} triangle triads.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            empty: count[0] as number,
            single: count[1] as number,
            wedge: count[2] as number,
            triangle: count[3] as number,
            triples: (count[0] as number) + (count[1] as number) + (count[2] as number) + (count[3] as number),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A triad census counts the small induced patterns in a network. Looking at every group of three vertices and counting how many edges connect them gives four buckets: no edge, one edge, a two-edge wedge, and a triangle. Those four counts describe much of a graph's local clustering structure.",
        invariants: [
            "Every three-element subset of vertices is examined exactly once.",
            "A triad's class is determined only by the number of edges inside it.",
            "The four class counts always add up to the number of triples.",
        ],
        correctness:
            "For each triple, the algorithm tests all three possible vertex pairs against the symmetrized adjacency sets, so the recorded edge count is exact. Classifying by that count partitions the set of all triples into four disjoint buckets, and the sum of the bucket sizes must equal the binomial coefficient C(V, 3).",
        complexityRationale:
            "There are O(V^3) triples and each needs three constant-time adjacency tests, so the running time is O(V^3) and the working storage is O(V + E).",
        uses: [
            " social network analysis of local clustering",
            " comparing biological interaction networks",
            " computing clustering coefficients from triad counts",
        ],
        references: [
            "Milo et al., Superfamilies of Evolved and Designed Networks (2004)",
            "Wasserman and Faust, Social Network Analysis: Methods and Applications",
        ],
        workedExample:
            "In a graph with edges A-B, A-C, B-C, C-D, the triple A, B, C is a triangle, A, C, D is a wedge, A, B, D is a single edge, and A, D, E is empty when E is isolated. The census records one triangle, one wedge, one single edge, and one empty triad.",
    },
    id: "motif-finding",
    name: "Three-Vertex Motif Finding (Triad Census)",
    category: "graph",
    complexity: { time: "O(V^3)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["A", "C"],
            E: [],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the input into a simple undirected graph",
        "initialize four counters for edge counts zero through three",
        "for every unordered triple of distinct vertices",
        "count how many of its three pairs are joined by an edge",
        "increment the counter for that edge count",
        "highlight the triple and its internal edges",
        "done: the triad census whose counts sum to the triple total",
    ],
};

export default module;
