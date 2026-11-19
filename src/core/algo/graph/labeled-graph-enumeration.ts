/**
 * labeled-graph-enumeration.ts - Enumeration of Labeled Simple Graphs
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * On n fixed vertex labels there are n choose 2 possible undirected pairs.
 * Each pair may be present or absent, so a walk through all binary strings of
 * that length enumerates every labeled simple graph exactly once, from the
 * empty graph to the complete graph. This is the canonical brute-force sample
 * space behind random graph models and graph-counting proofs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^C * C) where C = n(n-1)/2, since each graph is built from scratch
 *   Space: O(n + C) for one graph's labels, edges, and entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices keep fixed labels A, B, C, and so on across every frame.
 *   - Present edges are GREEN; the changing bit pattern is shown in meta.
 *   - The final frame reports the total count 2^(n choose 2).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number } | null) ?? {};
    const raw = typeof task.vertices === "number" ? Math.floor(task.vertices) : 4;
    const n = Math.max(1, Math.min(5, raw));
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) pairs.push([labels[i] as string, labels[j] as string]);
    }
    const total = 1 << pairs.length;
    const nodes: VisualEntity[] = makeGraphNodes(labels);
    let step = 0;

    const snap = (mask: number, description: string, line: number, final: boolean): VisualFrame => {
        const edges: VisualEdge[] = pairs.map(([a, b], bit) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: final ? "idle" : (mask >> bit) & 1 ? "sorted" : "idle",
            directed: false,
        }));
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node, state: final ? "path" : "unvisited" })),
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                total,
                index: final ? total - 1 : mask,
                edgeCount: final ? pairs.length : edges.filter((e) => e.state === "sorted").length,
                vertices: n,
                pairs: pairs.length,
                bits: final ? "1".repeat(pairs.length) : mask.toString(2).padStart(pairs.length, "0"),
            },
        };
    };

    yield snap(0, `Enumerating all labeled graphs on ${n} vertices (${pairs.length} possible pairs).`, 0, false);
    step += 1;

    for (let mask = 0; mask < total; mask += 1) {
        const count = pairs.filter((_, bit) => (mask >> bit) & 1).length;
        yield snap(mask, `Graph ${mask + 1} of ${total}: bit pattern ${mask.toString(2).padStart(pairs.length, "0")} has ${count} edge(s).`, 3, false);
        step += 1;
    }

    yield snap(
        total - 1,
        `Enumerated ${total} labeled graphs, from the empty graph to the complete graph with ${pairs.length} edges.`,
        6,
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fix the vertex names once and for all. Each unordered pair of names is a switch that is either on or off. Walking through every combination of those switches lists every possible simple graph on those named vertices, with no repeats and no omissions.",
        invariants: [
            "The vertex labels are identical in every generated graph.",
            "Distinct bit patterns produce distinct edge sets.",
            "The first pattern is the empty graph and the last is the complete graph.",
        ],
        correctness:
            "A simple labeled graph is fully determined by which of the C(n,2) unordered pairs are edges. Encoding that choice as a C-bit binary string gives a bijection between the integers 0 through 2^C - 1 and the set of labeled graphs, so the enumeration visits each graph exactly once and the total count is 2^C.",
        complexityRationale:
            "There are 2^C graphs and building each one reads all C bits, giving O(2^C * C) time with C = n(n-1)/2. Only one graph's edge list and entities are materialized at a time, so space is O(n + C). The visualization clamps n to five to keep the frame count practical.",
        uses: [
            "Exhaustive testing of graph algorithms on all small inputs",
            "Defining the Erdos-Renyi random graph probability space",
            "Counting graph isomorphism classes by enumerating labeled graphs",
        ],
        references: [
            "West, Introduction to Graph Theory, section on labeled versus unlabeled graphs",
            "Bollobas, Modern Graph Theory, counting arguments",
        ],
        workedExample:
            "With three vertices A, B, C there are three pairs, so the enumeration lists eight graphs. Mask 000 is empty, mask 011 contains B-C and A-C, and mask 111 is the triangle; no two masks give the same edge set.",
    },
    id: "labeled-graph-enumeration",
    name: "Labeled Graph Enumeration",
    category: "graph",
    complexity: { time: "O(2^C * C)", space: "O(n + C)" },
    defaultInput: { vertices: 4 },
    visualType: "graph",
    run,
    pseudocode: [
        "let C be the number of unordered vertex pairs",
        "fix the vertex labels in a constant order",
        "for each mask from zero to two to the C minus one",
        "read bit k to decide whether pair k is an edge",
        "emit the graph formed by the selected pairs",
        "continue until every mask has been emitted",
        "verify the empty and complete graphs appear",
        "report the total count of labeled graphs",
    ],
};

export default module;
