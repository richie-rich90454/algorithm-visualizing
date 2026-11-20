/**
 * degree-centrality.ts - Degree Centrality
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Degree centrality is the simplest notion of node importance: a vertex is
 * central when it touches many other vertices. The raw score is its degree,
 * and the normalized score divides by n-1 so a vertex joined to everybody
 * scores 1. On a star the hub has centrality 1 while every leaf scores 1/(n-1).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) to build the adjacency and count degrees
 *   Space: O(V + E) for the symmetric adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node flashes while its degree is measured.
 *   - The final frame ranks every vertex by normalized degree.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Pair {
    edges?: Array<[string, string]>;
}

/** Read and validate an undirected edge list from an unknown input. */
function readEdges(raw: unknown): Array<[string, string]> {
    const fallback: Array<[string, string]> = [
        ["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["E", "C"],
    ];
    if (!Array.isArray(raw) || raw.length === 0) {
        return fallback;
    }
    const pairs: Array<[string, string]> = [];
    for (const item of raw) {
        if (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string" && item[0] !== item[1]) {
            pairs.push([item[0], item[1]]);
        }
    }
    return pairs.length > 0 ? pairs : fallback;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Pair | null) ?? {};
    const pairs = readEdges(task.edges);
    const labels = [...new Set(pairs.flatMap(([a, b]) => [a, b]))].sort();
    const adjacency: Record<string, Set<string>> = {};
    for (const label of labels) {
        adjacency[label] = new Set<string>();
    }
    for (const [a, b] of pairs) {
        adjacency[a]?.add(b);
        adjacency[b]?.add(a);
    }

    const nodes = makeGraphNodes(labels);
    const simpleAdjacency: Record<string, string[]> = {};
    for (const label of labels) {
        simpleAdjacency[label] = [...(adjacency[label] ?? [])].sort();
    }
    const edges = makeGraphEdges(simpleAdjacency);
    for (const edge of edges) {
        edge.directed = false;
    }

    const degrees = labels.map((label) => adjacency[label]?.size ?? 0);
    const divisor = Math.max(1, labels.length - 1);
    const centrality = degrees.map((degree) => degree / divisor);
    const leader = centrality.indexOf(Math.max(...centrality));

    const snapshot = (
        states: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
        ranking: string[],
    ): VisualFrame => {
        nodes.forEach((node, index) => {
            const label = labels[index] ?? "";
            node.label = `${label}:${centrality[index]?.toFixed(2) ?? "0.00"}`;
            node.state = states.get(label) ?? "visited";
        });
        for (const edge of edges) {
            edge.state = "idle";
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                labels: [...labels],
                degree: [...degrees],
                centrality: [...centrality],
                ranking,
                leader: labels[leader] ?? "",
            },
        };
    };

    let step = 0;
    const setup = snapshot(new Map(), "Degree centrality counts the neighbors of every vertex.", 0, []);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index] ?? "";
        const degree = degrees[index] ?? 0;
        const score = centrality[index] ?? 0;
        const states = new Map<string, EntityState>([[label, "comparing"]]);
        const frame = snapshot(
            states,
            `Vertex ${label} has degree ${degree}, so its normalized centrality is ${score.toFixed(2)}.`,
            2,
            [],
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    const ranking = labels
        .map((label, index) => ({ label, score: centrality[index] ?? 0 }))
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .map((entry) => `${entry.label}:${entry.score.toFixed(2)}`);
    for (const node of nodes) {
        node.state = "sorted";
    }
    const final = snapshot(new Map(), `Most central vertex: ${labels[leader] ?? ""} with score ${(centrality[leader] ?? 0).toFixed(2)}.`, 4, ranking);
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vertex matters in a network when it has many connections. Degree centrality is just that count, scaled by the largest count possible. For a graph with n vertices a universal vertex touches n-1 others and scores 1, while an isolated vertex scores 0.",
        invariants: [
            "Degree counts each distinct neighbor once, even when parallel edges are supplied.",
            "Normalized centrality always lies between 0 and 1 for n greater than one.",
            "The sum of all raw degrees equals twice the number of undirected edges.",
        ],
        correctness:
            "The adjacency set stores exactly the distinct neighbors of a vertex, so its size is the graph-theoretic degree. Dividing by n-1 maps the minimum possible degree 0 to score 0 and the maximum possible degree n-1 to score 1 monotonically, which is the standard degree-centrality definition.",
        complexityRationale:
            "Building symmetric adjacency touches each edge twice and counting set sizes is linear in the vertices, giving O(V + E) time and O(V + E) space for the stored adjacency.",
        uses: [
            "Finding influential accounts in social networks",
            "Identifying hubs in transportation and communication graphs",
            "A baseline feature for link-prediction and ranking models",
        ],
        references: [
            "Freeman, Centrality in Social Networks: Conceptual Clarification, 1979",
            "Newman, Networks: An Introduction, Chapter 7",
        ],
        workedExample:
            "For the star centered at C with leaves A, B, D, and E on five vertices, C has degree 4 and centrality 4/4 = 1. Each leaf has degree 1 and centrality 1/4 = 0.25, so C is reported as the most central vertex.",
    },
    id: "degree-centrality",
    name: "Degree Centrality",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["E", "C"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the symmetric adjacency of the undirected graph",
        "let n be the number of distinct vertices",
        "for each vertex let d be the size of its neighbor set",
        "set its centrality to d divided by n minus one",
        "rank vertices from highest centrality to lowest",
        "done: report each centrality and the leading vertex",
    ],
};

export default module;
