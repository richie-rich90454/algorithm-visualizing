/**
 * havel-hakimi.ts - Havel-Hakimi Graph Realization
 *
 * Given a degree sequence, the Havel-Hakimi test decides whether some simple
 * undirected graph has exactly those degrees and, when possible, builds one.
 * It repeatedly takes the highest-degree remaining vertex, connects it to the
 * next highest-degree vertices, and lowers their targets by one. A negative
 * target or a vertex needing more neighbors than remain fails the test.
 *
 * Time: O(n^2 log n) for the repeated sorting
 * Space: O(n + m) for the vertex list and the edges built
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface RealizationInput {
    degrees: number[];
}

interface Vertex {
    id: number;
    degree: number;
}

function makeEntities(count: number, degrees: number[], states: Map<number, EntityState>): VisualEntity[] {
    if (count === 0) {
        return [
            {
                id: "node-empty",
                type: "node" as const,
                label: "no vertices",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: 0, degree: 0 },
            },
        ];
    }
    return degrees.map((degree, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(degree),
        value: degree,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, degree },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<RealizationInput> | null) ?? {};
    const degrees = Array.isArray(input)
        ? [...(input as number[])]
        : Array.isArray(task.degrees)
          ? [...task.degrees]
          : [3, 3, 2, 2, 2, 2];
    const original = [...degrees];
    let vertices: Vertex[] = degrees.map((degree, id) => ({ id, degree }));
    const edges: VisualEdge[] = [];
    let step = 0;
    let realizable: "pending" | "yes" | "no" = "pending";

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        line: number,
        activeEdges: Set<string>,
    ): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeEntities(original.length, original, states),
            edges: edges.map((edge) => ({
                ...edge,
                state: activeEdges.has(edge.id) ? "active" : "idle",
            })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                remaining: vertices.map((vertex) => vertex.degree),
                edges: edges.length,
                realizable,
                target: original.join(","),
            },
        };
        step += 1;
        return result;
    };

    yield frame(new Map(), "Testing whether the degree sequence can be realized by a simple graph.", 0, new Set());
    if (vertices.some((vertex) => vertex.degree < 0)) {
        realizable = "no";
        yield frame(new Map(), "A negative target degree proves the sequence is not realizable.", 4, new Set());
        return;
    }

    while (vertices.some((vertex) => vertex.degree > 0)) {
        vertices = [...vertices].sort((a, b) => b.degree - a.degree || a.id - b.id);
        const current = vertices[0] as Vertex;
        const demand = current.degree;
        if (demand > vertices.length - 1) {
            realizable = "no";
            yield frame(
                new Map([[current.id, "error"]]),
                `Vertex ${current.id} needs ${demand} neighbors but only ${vertices.length - 1} remain.`,
                4,
                new Set(),
            );
            return;
        }

        const chosen = vertices.slice(1, 1 + demand);
        const states = new Map<number, EntityState>([[current.id, "highlight"]]);
        const activeEdges = new Set<string>();
        for (const neighbor of chosen) {
            neighbor.degree -= 1;
            states.set(neighbor.id, "swapped");
            if (neighbor.degree < 0) {
                realizable = "no";
                break;
            }
            const id = `edge-${Math.min(current.id, neighbor.id)}-${Math.max(current.id, neighbor.id)}`;
            edges.push({
                id,
                sourceId: `node-${current.id}`,
                targetId: `node-${neighbor.id}`,
                label: "",
                state: "active",
                directed: false,
            });
            activeEdges.add(id);
        }
        if (realizable === "no") {
            yield frame(
                states,
                `Lowering neighbor targets made a degree negative; no realization exists.`,
                4,
                activeEdges,
            );
            return;
        }

        vertices = vertices.slice(1);
        yield frame(
            states,
            `Connected vertex ${current.id} to ${demand} highest-degree neighbor(s); targets lowered.`,
            3,
            activeEdges,
        );
    }

    realizable = "yes";
    const doneStates = new Map<number, EntityState>(original.map((_, index) => [index, "sorted" as EntityState]));
    yield frame(
        doneStates,
        `Realization found with ${edges.length} edges matching the target degrees.`,
        5,
        new Set(),
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vertex that still needs many neighbors should spend them on the vertices that also need the most. Havel-Hakimi sorts the remaining targets, connects the largest one to the next largest ones, and repeats. If a vertex ever needs more neighbors than exist, or a target drops below zero, the sequence cannot describe a simple graph.",
        invariants: [
            "Every edge added joins two distinct vertices and no edge is added twice.",
            "Lowering a neighbor target accounts for the edge just created.",
            "The multiset of remaining targets is realizable if and only if the original was.",
        ],
        correctness:
            "If a graph realizes the sequence, the highest-degree vertex can be exchanged with a vertex adjacent to all of its chosen neighbors without changing any degree, so connecting it to the next highest targets preserves realizability. Recursing on the reduced sequence therefore decides the original question. A negative target or excess demand gives a direct contradiction.",
        complexityRationale:
            "Each of the at most n rounds sorts the remaining vertices, costing O(n log n), so the total is O(n^2 log n). The output graph holds at most n(n-1)/2 edges, which together with the vertex list gives O(n + m) space.",
        uses: [
            "Checking whether a claimed network degree profile is feasible",
            "Constructing a witness graph for a graphical sequence",
            "A preprocessing step in graph-generation and network-model tools",
        ],
        references: [
            "Havel, A Remark on the Existence of Finite Graphs, 1955",
            "Hakimi, On the Realizability of a Set of Integers as Degrees, 1962",
        ],
        workedExample:
            "For [3, 3, 2, 2, 2, 2], connect vertex 0 to vertices 1, 2, 3, reducing targets to 2, 1, 1, 2, 2. Sorting gives 2, 2, 2, 1, 1; continuing produces a valid six-vertex graph. For [3, 1, 1] the largest target exceeds the two available neighbors, so the sequence fails.",
    },
    id: "havel-hakimi",
    name: "Havel-Hakimi Graph Realization",
    category: "graph",
    complexity: { time: "O(n^2 log n)", space: "O(n + m)" },
    defaultInput: { degrees: [3, 3, 2, 2, 2, 2] },
    visualType: "graph",
    run,
    pseudocode: [
        "if any target degree is negative, reject the sequence",
        "while some target degree is positive, sort vertices by target descending",
        "take the first vertex and read its target d",
        "if d exceeds the number of remaining vertices, reject the sequence",
        "connect it to the next d vertices and lower each of their targets by one",
        "remove the satisfied vertex from the working set",
        "done: report the constructed graph or failure",
    ],
};

export default module;
