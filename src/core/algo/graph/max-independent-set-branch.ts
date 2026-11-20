/**
 * max-independent-set-branch.ts - Maximum Independent Set by Branch and Bound
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An independent set is a set of vertices with no edge between any two of
 * them. This module finds a largest one by branching on a vertex: either take
 * it (and discard all of its neighbors) or skip it. A simple bound prunes a
 * branch when even adding every remaining vertex could not beat the best set
 * found so far.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) worst case, reduced in practice by pruning
 *   Space: O(n) for the recursion stack and the current sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Chosen vertices are GREEN (sorted).
 *   - The vertex under consideration is YELLOW (comparing).
 *   - Edges from that vertex to remaining candidates are BLUE (active).
 */

import type {
    AlgorithmModule,
    EntityState,
    VisualEdge,
    VisualEntity,
    VisualFrame,
} from "@/types";
import { makeGraphNodes } from "./graph-util";

interface IndependentInput {
    graph?: Record<string, string[]>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as IndependentInput | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C", "E"],
        E: ["D", "F"],
        F: ["E"],
        G: [],
    };

    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const neighbors = new Map<string, Set<string>>(labels.map((label) => [label, new Set<string>()]));
    const pairs: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            if (u === v || !neighbors.has(u) || !neighbors.has(v)) {
                continue;
            }
            neighbors.get(u)?.add(v);
            neighbors.get(v)?.add(u);
            const key = u < v ? `${u}|${v}` : `${v}|${u}`;
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push([u < v ? u : v, u < v ? v : u]);
            }
        }
    }

    const baseEdges: VisualEdge[] = pairs.map(([a, b]) => ({
        id: `edge-${a}-${b}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));

    let step = 0;
    const emit = (
        chosen: string[],
        focus: string | null,
        candidates: Set<string>,
        activeEdges: Set<string>,
        description: string,
        codeLineNumber: number,
        extra: VisualFrame["meta"],
    ): VisualFrame => {
        const chosenSet = new Set(chosen);
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
            let state: EntityState = "unvisited";
            if (chosenSet.has(label)) {
                state = "sorted";
            } else if (label === focus) {
                state = "comparing";
            } else if (candidates.has(label)) {
                state = "visited";
            }
            return { ...node, state };
        });
        const edges: VisualEdge[] = baseEdges.map((edge) => ({
            ...edge,
            state: (activeEdges.has(edge.id) ? "active" : "idle") as EntityState,
        }));
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: extra,
        };
    };

    let bestSize = 0;
    let bestSet: string[] = [];
    let nodesExplored = 0;
    let prunes = 0;

    yield emit(
        [],
        null,
        new Set(labels),
        new Set(),
        `Searching a maximum independent set in a ${labels.length}-vertex graph.`,
        0,
        { vertices: labels.length, edges: pairs.length, bestSize: 0, prunes: 0 },
    );

    function pickVertex(remaining: string[]): string {
        let best = remaining[0] as string;
        let bestDegree = -1;
        for (const label of remaining) {
            let degree = 0;
            for (const other of remaining) {
                if (neighbors.get(label)?.has(other)) {
                    degree += 1;
                }
            }
            if (degree > bestDegree) {
                bestDegree = degree;
                best = label;
            }
        }
        return best;
    }

    function* search(remaining: string[], chosen: string[]): Generator<VisualFrame, void, unknown> {
        nodesExplored += 1;
        if (chosen.length + remaining.length <= bestSize) {
            prunes += 1;
            yield emit(
                chosen,
                null,
                new Set(remaining),
                new Set(),
                `Prune: ${chosen.length} chosen plus ${remaining.length} candidates cannot beat ${bestSize}.`,
                1,
                { bestSize, bestSet, prunes, nodesExplored },
            );
            return;
        }
        if (remaining.length === 0) {
            if (chosen.length > bestSize) {
                bestSize = chosen.length;
                bestSet = [...chosen];
            }
            yield emit(
                chosen,
                null,
                new Set(),
                new Set(),
                `Leaf reached: independent set {${chosen.join(", ")}} of size ${chosen.length}.`,
                2,
                { bestSize, bestSet, prunes, nodesExplored },
            );
            return;
        }

        const v = pickVertex(remaining);
        const candidateSet = new Set(remaining);
        const incident = new Set<string>();
        for (const w of remaining) {
            if (neighbors.get(v)?.has(w)) {
                incident.add(v < w ? `edge-${v}-${w}` : `edge-${w}-${v}`);
            }
        }

        const kept = remaining.filter((w) => w !== v && !neighbors.get(v)?.has(w));
        yield emit(
            chosen,
            v,
            candidateSet,
            incident,
            `Branch include ${v}: drop ${v} and its neighbors, leaving ${kept.length} candidate(s).`,
            3,
            { bestSize, bestSet, prunes, nodesExplored },
        );
        yield* search(kept, [...chosen, v]);

        const skipped = remaining.filter((w) => w !== v);
        yield emit(
            chosen,
            v,
            candidateSet,
            incident,
            `Branch exclude ${v}: keep the other ${skipped.length} candidate(s).`,
            4,
            { bestSize, bestSet, prunes, nodesExplored },
        );
        yield* search(skipped, chosen);
    }

    if (labels.length === 0) {
        yield emit(
            [],
            null,
            new Set(),
            new Set(),
            "The graph is empty, so the maximum independent set is empty.",
            6,
            { bestSize: 0, bestSet: [], prunes: 0, nodesExplored: 1 },
        );
        return;
    }

    yield* search(labels, []);

    yield emit(
        bestSet,
        null,
        new Set(),
        new Set(),
        `Maximum independent set {${bestSet.join(", ")}} has size ${bestSize} after ${nodesExplored} node(s).`,
        6,
        { bestSize, bestSet, prunes, nodesExplored },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To pick as many non-adjacent vertices as possible, decide for one vertex at a time whether to take it. Taking a vertex rules out all of its neighbors; skipping it rules out only that vertex. If even taking every remaining vertex would not beat the best answer already found, stop exploring that branch.",
        invariants: [
            "Every set reported as chosen is independent: it contains no adjacent pair.",
            "bestSize is the size of the largest independent set found so far.",
            "A branch is pruned only when chosen count plus remaining count cannot exceed bestSize.",
        ],
        correctness:
            "For the vertex chosen at each node, every independent set either contains it or does not. The include branch removes exactly the vertices that cannot coexist with it, and the exclude branch removes only that vertex, so together the branches cover all independent sets. Pruning is safe because the bound upper-limits the size achievable below that node. Therefore the maximum over all explored leaves is the true maximum independent set size.",
        complexityRationale:
            "Each vertex spawns an include and an exclude branch, so the search tree has at most 2^n leaves and the bound only removes branches. Each node scans the remaining vertices, giving O(2^n) worst-case time with O(n) space for the recursion stack and current sets.",
        uses: [
            "Selecting non-conflicting tasks in scheduling",
            "Choosing an interference-free set of radio channels or frequencies",
            "Maximum independent set as a subroutine for graph coloring heuristics",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, 3rd ed., Ch. 26",
            "Wikipedia, 'Independent set (graph theory)'",
        ],
        workedExample:
            "On the path A-B-C-D, choose A first. Including A removes B, leaving C-D; including C then removes D, giving {A, C} of size two. The alternative of skipping A can also reach {B, D}, so the maximum size is two.",
    },
    id: "max-independent-set-branch",
    name: "Maximum Independent Set (Branch and Bound)",
    category: "graph",
    complexity: { time: "O(2^n)", space: "O(n)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C", "E"],
            E: ["D", "F"],
            F: ["E"],
            G: [],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected neighbor sets of every vertex",
        "if chosen count plus remaining count is at most best, prune",
        "if no candidates remain, update the best set and stop",
        "pick the remaining vertex with the most remaining neighbors",
        "branch one: take it and drop it with all its neighbors",
        "branch two: skip it and keep the other candidates",
        "done: report the largest independent set found",
    ],
};

export default module;
