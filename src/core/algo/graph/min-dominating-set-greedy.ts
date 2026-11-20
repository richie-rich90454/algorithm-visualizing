/**
 * min-dominating-set-greedy.ts - Minimum Dominating Set (Greedy)
 *
 * A dominating set touches every vertex, either directly or through an edge.
 * The greedy rule repeatedly picks the vertex whose closed neighborhood covers
 * the most still-uncovered vertices, removes those vertices, and continues.
 * It always returns a valid dominating set, though on general graphs it can be
 * larger than the true minimum.
 *
 * Time O(V * E), space O(V).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const raw = task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C"],
    };
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat()])].sort();
    const neighbors = new Map<string, Set<string>>(labels.map((label) => [label, new Set<string>()]));
    for (const [u, vs] of Object.entries(raw)) {
        for (const v of vs) {
            neighbors.get(u)?.add(v);
            neighbors.get(v)?.add(u);
        }
    }

    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(raw);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });
    const setState = (label: string, state: EntityState): void => {
        const node = byId.get(`node-${label}`);
        if (node) node.state = state;
    };
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
        for (const edge of edges) edge.state = "idle";
    };

    if (labels.length === 0) {
        yield snap("Empty graph - the dominating set is empty.", 0, { size: 0, chosen: [] });
        return;
    }

    const uncovered = new Set(labels);
    const chosen: string[] = [];
    yield snap(`Greedy dominating set: cover ${labels.length} vertices with closed neighborhoods.`, 0, {
        size: 0,
        chosen: [],
        uncovered: uncovered.size,
    });
    step += 1;

    while (uncovered.size > 0) {
        let best = "";
        let bestCover = 0;
        for (const v of labels) {
            if (chosen.includes(v)) continue;
            let cover = 0;
            if (uncovered.has(v)) cover += 1;
            for (const nb of neighbors.get(v) ?? []) if (uncovered.has(nb)) cover += 1;
            if (cover > bestCover) {
                bestCover = cover;
                best = v;
            }
        }
        if (best === "") break;

        chosen.push(best);
        const closed = new Set<string>([best, ...(neighbors.get(best) ?? [])]);
        const newlyCovered = [...closed].filter((v) => uncovered.has(v));
        for (const v of newlyCovered) uncovered.delete(v);

        reset();
        for (const v of chosen) setState(v, "sorted");
        for (const v of uncovered) setState(v, "unvisited");
        for (const v of newlyCovered) if (!chosen.includes(v)) setState(v, "visited");
        for (const edge of edges) {
            if (edge.sourceId === `node-${best}` || edge.targetId === `node-${best}`) edge.state = "path";
        }
        yield snap(
            `Pick ${best}: its closed neighborhood covers ${bestCover} uncovered vertex/vertices {${newlyCovered.join(", ")}}.`,
            2,
            { size: chosen.length, chosen: [...chosen], uncovered: uncovered.size, gain: bestCover },
        );
        step += 1;
    }

    reset();
    for (const v of chosen) setState(v, "path");
    for (const edge of edges) {
        const source = edge.sourceId.slice(5);
        const target = edge.targetId.slice(5);
        if (chosen.includes(source) || chosen.includes(target)) edge.state = "active";
    }
    yield snap(
        `Dominating set {${[...chosen].sort().join(", ")}} of size ${chosen.length} covers every vertex.`,
        5,
        { size: chosen.length, chosen: [...chosen], uncovered: uncovered.size },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick the vertex that covers the most ground. A chosen vertex dominates itself and all of its neighbors, so the greedy rule keeps choosing the currently best cover until no vertex is left uncovered. It is the set-cover heuristic specialized to the neighborhoods of a graph.",
        invariants: [
            "Every vertex removed from the uncovered set is dominated by some chosen vertex.",
            "A vertex is chosen at most once, so the result is a set.",
            "When the loop ends every vertex is either chosen or adjacent to a chosen vertex.",
        ],
        correctness:
            "Adding a vertex to the chosen set only removes vertices from its closed neighborhood, all of which are dominated by that vertex. The loop stops only when the uncovered set is empty, so the final set satisfies the definition of a dominating set. The greedy choice need not be globally optimal, hence the size is a valid upper bound on the minimum, not an exact minimum in general.",
        complexityRationale:
            "Each of up to V rounds scans every vertex and its adjacency to compute coverage, costing O(E) per round and O(V * E) overall. The chosen set, uncovered set and neighbor sets use O(V + E) space.",
        uses: [
            "Placing facilities or sensors so every location is within reach",
            "Selecting router nodes in a wireless ad hoc network",
            "Constructing a fast covering set before a more expensive exact search",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 35 (approximation algorithms)",
            "Garey and Johnson, Computers and Intractability, dominating set and set cover",
        ],
        workedExample:
            "On the path A-B-C-D the closed neighborhoods are {A,B}, {A,B,C}, {B,C,D} and {C,D}. The greedy rule first picks B or C, covering three vertices, and then picks the endpoint that covers the last one, producing a dominating set of size two, which is optimal for this path.",
    },
    id: "min-dominating-set-greedy",
    name: "Minimum Dominating Set (Greedy)",
    category: "graph",
    complexity: { time: "O(V·E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "start with every vertex uncovered and an empty set",
        "for each candidate count uncovered vertices in its closed neighborhood",
        "choose the vertex with the largest coverage",
        "add it to the dominating set",
        "mark its closed neighborhood as covered",
        "repeat until no vertex is uncovered",
        "done: the chosen set dominates the whole graph",
    ],
};

export default module;
