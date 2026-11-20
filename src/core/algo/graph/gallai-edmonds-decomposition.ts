/**
 * gallai-edmonds-decomposition.ts - Gallai-Edmonds Decomposition
 *
 * For a maximum matching, a vertex is deficient if some maximum matching
 * leaves it unmatched. Gallai-Edmonds partitions the vertices into D, the
 * deficient vertices, A, the neighbors of D outside D, and C, the remaining
 * vertices. Odd components induced by D are attached to distinct vertices of
 * A, which is why this decomposition controls the structure of all maximum
 * matchings in a graph.
 *
 * Time: O(2^m * m) for the brute-force matching enumeration on small graphs
 * Space: O(n + m) plus the recorded maximum matchings
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GraphInput {
    graph: { nodes: string[]; edges: Array<[string, string]> };
}

interface Matching {
    edges: number[];
    matched: Set<string>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<GraphInput> | null) ?? {};
    const graph = task.graph ?? {
        nodes: ["A", "B", "C", "D", "E"],
        edges: [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "E"],
        ] as Array<[string, string]>,
    };
    const nodes = [...graph.nodes];
    const edges = graph.edges.map((edge) => [...edge] as [string, string]);
    const indexOf = new Map(nodes.map((node, index) => [node, index]));

    const maximum: Matching[] = [];
    let bestSize = -1;
    for (let mask = 0; mask < 2 ** edges.length; mask += 1) {
        const used = new Set<string>();
        const chosen: number[] = [];
        let valid = true;
        for (let e = 0; e < edges.length; e += 1) {
            if (((mask >> e) & 1) === 0) {
                continue;
            }
            const [u, v] = edges[e] as [string, string];
            if (used.has(u) || used.has(v)) {
                valid = false;
                break;
            }
            used.add(u);
            used.add(v);
            chosen.push(e);
        }
        if (!valid) {
            continue;
        }
        if (chosen.length > bestSize) {
            bestSize = chosen.length;
            maximum.length = 0;
        }
        if (chosen.length === bestSize) {
            maximum.push({ edges: chosen, matched: used });
        }
    }

    const deficient = new Set<string>();
    for (const matching of maximum) {
        for (const node of nodes) {
            if (!matching.matched.has(node)) {
                deficient.add(node);
            }
        }
    }
    const adjacent = new Set<string>();
    for (const [u, v] of edges) {
        if (deficient.has(u) && !deficient.has(v)) {
            adjacent.add(v);
        }
        if (deficient.has(v) && !deficient.has(u)) {
            adjacent.add(u);
        }
    }
    const remainder = nodes.filter((node) => !deficient.has(node) && !adjacent.has(node));

    const makeEntities = (states: Map<string, EntityState>): VisualEntity[] =>
        nodes.map((node, index) => ({
            id: `node-${index}`,
            type: "node" as const,
            label: node,
            value: node,
            state: states.get(node) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, name: node },
        }));
    const makeEdges = (active: Set<string>): VisualEdge[] =>
        edges.map(([u, v], index) => ({
            id: `edge-${index}`,
            sourceId: `node-${indexOf.get(u)}`,
            targetId: `node-${indexOf.get(v)}`,
            label: "",
            state: active.has(`edge-${index}`) ? "path" : "idle",
            directed: false,
        }));

    let step = 0;
    const frame = (
        states: Map<string, EntityState>,
        active: Set<string>,
        description: string,
        line: number,
    ): VisualFrame => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeEntities(states),
            edges: makeEdges(active),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                D: [...deficient].sort(),
                A: [...adjacent].sort(),
                C: [...remainder].sort(),
                maxMatching: Math.max(0, bestSize),
                matchings: maximum.length,
            },
        };
        step += 1;
        return result;
    };

    yield frame(
        new Map(),
        new Set(),
        `Enumerating matchings to find every vertex left free by a maximum matching.`,
        0,
    );

    for (const matching of maximum.slice(0, 8)) {
        const active = new Set(matching.edges.map((index) => `edge-${index}`));
        const states = new Map<string, EntityState>();
        for (const node of nodes) {
            if (!matching.matched.has(node)) {
                states.set(node, "highlight");
            }
        }
        yield frame(
            states,
            active,
            `Maximum matching of size ${bestSize} leaves ${[...states.keys()].join(", ") || "no vertex"} free.`,
            2,
        );
    }

    const finalStates = new Map<string, EntityState>();
    for (const node of deficient) {
        finalStates.set(node, "highlight");
    }
    for (const node of adjacent) {
        finalStates.set(node, "active");
    }
    for (const node of remainder) {
        finalStates.set(node, "sorted");
    }
    yield frame(
        finalStates,
        new Set(),
        `Decomposition: D = {${[...deficient].sort().join(", ")}}, A = {${[...adjacent].sort().join(
            ", ",
        )}}, C = {${remainder.join(", ")}}.`,
        5,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Look across all maximum matchings, not just one. Some vertices can be left unmatched in at least one maximum matching; those form D. Their neighbors outside D form A, and everything else forms C. The sets reveal which parts of the graph are flexible and which vertices are always matched.",
        invariants: [
            "Every vertex belongs to exactly one of D, A, and C.",
            "No two vertices of A have a common neighbor in D that would be forced to pair with both.",
            "A vertex in C is matched in every maximum matching.",
        ],
        correctness:
            "A vertex is deficient exactly when dropping it from the graph does not reduce the maximum matching size, which the enumeration of all maximum matchings detects directly. Taking neighbors of D gives A by definition, and the leftover vertices are C. Gallai-Edmonds theory then guarantees that the odd components of D attach to distinct vertices of A, so the partition is the canonical one.",
        complexityRationale:
            "The teaching implementation enumerates all two-to-the-m edge subsets and checks each for being a matching, giving O(2^m * m) time. It stores only the vertex sets and the matching edge lists, so space is O(n + m) beyond the recorded maximum matchings.",
        uses: [
            "Analyzing the structure of all maximum matchings at once",
            "A stepping stone to Tutte's theorem and Edmonds' blossom algorithm",
            "Identifying which vertices are optional in a matching-based assignment",
        ],
        references: [
            "Gallai, Kriterien fur die Existenz eines Faktors, 1959",
            "Lovasz and Plummer, Matching Theory, Chapter on the Gallai-Edmonds decomposition",
        ],
        workedExample:
            "For the path A-B-C-D-E, maximum matchings have size two. One matching {A-B, C-D} leaves E free, another {A-B, D-E} leaves C free, and another {B-C, D-E} leaves A free. Thus D = {A, C, E}, A = {B, D}, and C is empty.",
    },
    id: "gallai-edmonds-decomposition",
    name: "Gallai-Edmonds Decomposition",
    category: "graph",
    complexity: { time: "O(2^m m)", space: "O(n + m)" },
    defaultInput: {
        graph: {
            nodes: ["A", "B", "C", "D", "E"],
            edges: [
                ["A", "B"],
                ["B", "C"],
                ["C", "D"],
                ["D", "E"],
            ],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "enumerate every subset of the graph edges",
        "keep subsets whose edges share no endpoint, recording their size",
        "retain only the matchings of maximum size",
        "mark a vertex deficient if some maximum matching leaves it free",
        "put neighbors of deficient vertices outside D into A",
        "put all remaining vertices into C",
        "done: report the D, A, and C sets",
    ],
};

export default module;
