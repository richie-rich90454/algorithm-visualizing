/**
 * common-neighbors-link-prediction.ts - Common Neighbors Link Prediction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The common-neighbors index predicts a future edge between two vertices by
 * counting how many neighbors they already share. A pair with many shared
 * neighbors is likely to become connected. The score is simply the size of the
 * intersection of the two neighbor sets.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * min(deg(u), deg(v))) for P candidate pairs
 *   Space: O(V + E) for the symmetric adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The scored pair turns yellow; shared neighbors turn green.
 *   - The final frame ranks all candidate pairs by score.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Pair {
    edges?: Array<[string, string]>;
    pairs?: Array<[string, string]>;
}

const FALLBACK_EDGES: Array<[string, string]> = [
    ["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"],
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Pair | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0 ? task.edges : FALLBACK_EDGES;
    const edgesIn = rawEdges.filter(
        (pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string" && pair[0] !== pair[1],
    );
    const labels = [...new Set(edgesIn.flatMap(([a, b]) => [a, b]))].sort();
    const adjacency: Record<string, Set<string>> = {};
    for (const label of labels) {
        adjacency[label] = new Set<string>();
    }
    for (const [a, b] of edgesIn) {
        adjacency[a]?.add(b);
        adjacency[b]?.add(a);
    }

    const simpleAdjacency: Record<string, string[]> = {};
    for (const label of labels) {
        simpleAdjacency[label] = [...(adjacency[label] ?? [])].sort();
    }
    const nodes = makeGraphNodes(labels);
    const edges = makeGraphEdges(simpleAdjacency);
    for (const edge of edges) {
        edge.directed = false;
    }

    const pairsIn = Array.isArray(task.pairs) ? task.pairs : [];
    const supplied = pairsIn.filter(
        (pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string"
            && pair[0] !== pair[1] && adjacency[pair[0]] && adjacency[pair[1]] && !adjacency[pair[0]]?.has(pair[1]),
    ).map(([a, b]) => [a, b] as [string, string]);
    const candidates: Array<[string, string]> = supplied.length > 0 ? supplied : (() => {
        const result: Array<[string, string]> = [];
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
                const a = labels[i] ?? "";
                const b = labels[j] ?? "";
                if (!adjacency[a]?.has(b)) {
                    result.push([a, b]);
                }
            }
        }
        return result;
    })();

    const shared = (a: string, b: string): string[] => {
        const setA = adjacency[a] ?? new Set<string>();
        const setB = adjacency[b] ?? new Set<string>();
        return [...setA].filter((vertex) => setB.has(vertex)).sort();
    };
    const scores = candidates.map(([a, b]) => shared(a, b).length);
    const pairLabels = candidates.map(([a, b]) => `${a}-${b}`);
    const leader = scores.indexOf(Math.max(...scores));

    const snapshot = (
        pair: [string, string] | null,
        common: string[],
        description: string,
        codeLineNumber: number,
        ranking: string[],
    ): VisualFrame => {
        for (const node of nodes) {
            node.state = "visited";
        }
        if (pair) {
            for (const label of pair) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "comparing";
                }
            }
            for (const label of common) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "highlight";
                }
            }
        }
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
                pairs: pairLabels,
                scores: [...scores],
                topPair: pairLabels[leader] ?? "",
                topScore: scores[leader] ?? 0,
                ranking,
            },
        };
    };

    let step = 0;
    const setup = snapshot(null, [], "Score each missing link by the number of shared neighbors.", 0, []);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < candidates.length; index += 1) {
        const pair = candidates[index] ?? ["", ""];
        const common = shared(pair[0], pair[1]);
        const frame = snapshot(
            pair,
            common,
            `Pair ${pairLabels[index]}: ${common.length} shared neighbor(s) [${common.join(", ")}].`,
            2,
            [],
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    const ranking = candidates
        .map((pair, index) => ({ pair: pairLabels[index] ?? "", score: scores[index] ?? 0 }))
        .sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair))
        .map((entry) => `${entry.pair}:${entry.score}`);
    for (const node of nodes) {
        node.state = "sorted";
    }
    const final = snapshot(null, [], `Best candidate ${pairLabels[leader] ?? ""} scores ${scores[leader] ?? 0}.`, 4, ranking);
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Friends of friends are likely to become friends. For two vertices that are not yet connected, count how many neighbors they already have in common; a large overlap is evidence that a link should exist. It is the simplest and most widely used structural link-prediction score.",
        invariants: [
            "Only unordered pairs of distinct, currently non-adjacent vertices are scored.",
            "The score of a pair is the size of the intersection of its two neighbor sets.",
            "Every score is a nonnegative integer no larger than n minus two.",
        ],
        correctness:
            "The neighbor sets are stored exactly, so their intersection contains precisely the vertices adjacent to both endpoints. Its cardinality is by definition the common-neighbors index, and ranking pairs by that cardinality ranks them by the predicted likelihood of a future edge under this heuristic.",
        complexityRationale:
            "For each candidate pair we scan the smaller neighbor set and test membership in the other, costing O(min(deg(u), deg(v))). With P candidates the total is O(P times that bound), plus O(V + E) to build the adjacency.",
        uses: [
            "Recommending friends and collaborators in social networks",
            "Predicting missing edges in knowledge graphs",
            "A baseline for evaluating more complex link predictors",
        ],
        references: [
            "Newman, Clustering and Preferential Attachment in Growing Networks, 2001",
            "Liben-Nowell and Kleinberg, The Link-Prediction Problem for Social Networks, 2007",
        ],
        workedExample:
            "In the graph with edges A-B, A-C, B-C, B-D, C-D, and D-E, the pair A-D shares neighbors B and C, so it scores 2. The pair A-E shares nobody and scores 0, making A-D the top predicted link.",
    },
    id: "common-neighbors-link-prediction",
    name: "Common Neighbors Link Prediction",
    category: "graph",
    complexity: { time: "O(P * min(deg(u), deg(v)))", space: "O(V + E)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the symmetric neighbor set of every vertex",
        "list every non-adjacent pair to evaluate",
        "for a candidate pair intersect its two neighbor sets",
        "let the score be the size of that intersection",
        "repeat for all candidate pairs",
        "rank pairs by descending score",
        "done: report the best predicted link",
    ],
};

export default module;
